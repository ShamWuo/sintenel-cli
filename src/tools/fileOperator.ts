import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, statSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, basename } from "node:path";
import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";
import { resolveUnderRoot } from "../utils/paths.js";

const DEFAULT_MAX_READ_CHARS = 32_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WRITE_SIZE = 5 * 1024 * 1024; // 5MB

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function isBinaryFile(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(8192, content.length));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function replaceFirst(source: string, target: string, replacement: string): string {
  const idx = source.indexOf(target);
  if (idx === -1) return source;
  return source.slice(0, idx) + replacement + source.slice(idx + target.length);
}

function maybeWriteBackup(absPath: string, content: string): string {
  const backupPath = `${absPath}.bak.${Date.now()}`;
  writeFileSync(backupPath, content, "utf8");
  return backupPath;
}

export const fileOperatorInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    path: z.string().min(1).describe("Path relative to working directory"),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
    maxChars: z.number().int().min(1).max(1_000_000).optional(),
  }),
  z.object({
    action: z.literal("write"),
    path: z.string().min(1).describe("Path relative to working directory"),
    content: z.string().describe("Full content to write to the file"),
    createDirectories: z.boolean().optional(),
    backupExisting: z.boolean().optional(),
    expectedFileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  }),
  z.object({
    action: z.literal("patch"),
    path: z.string().min(1).describe("Path relative to working directory"),
    oldSnippet: z.string().min(1).describe("Exact string to replace. Must be unique in the file."),
    newSnippet: z.string().describe("New string to replace oldSnippet with"),
    contextBefore: z.string().optional(),
    contextAfter: z.string().optional(),
    replaceAll: z.boolean().optional(),
    expectedReplacements: z.number().int().min(1).optional(),
    backupExisting: z.boolean().optional(),
    expectedFileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    path: z.string().min(1).describe("Path to the file or directory to delete"),
    recursive: z.boolean().optional().describe("Whether to delete directories recursively (default: false)"),
  }),
  z.object({
    action: z.literal("rename"),
    path: z.string().min(1).describe("Path to the existing file or directory"),
    newPath: z.string().min(1).describe("New path for the file or directory"),
  }),
  z.object({
    action: z.literal("rollback"),
    path: z.string().min(1).describe("Path to the file to rollback from its .bak. timestamped backup"),
  }),
]);

export type FileOperatorContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
  writeAllowed: () => boolean;
  allowDestructiveOps: () => boolean;
};

export function createFileOperatorTool(ctx: FileOperatorContext) {
  return tool({
    description: "Read, write, patch, delete, rename, or rollback files. Rollback restores the most recent .bak file.",
    parameters: fileOperatorInputSchema,
    execute: async (input) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "fileOperator", input },
      });

      if (isAbsolute(input.path)) {
        return { ok: false as const, error: `Absolute paths forbidden: ${input.path}` };
      }

      if (input.action !== "read" && !ctx.writeAllowed()) {
        return { ok: false as const, error: "Write blocked. Confirm plan first." };
      }

      let abs: string;
      try {
        abs = resolveUnderRoot(ctx.cwd, input.path);
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
      }

      if (input.action === "read") {
        if (!existsSync(abs)) return { ok: false as const, error: `File not found: ${input.path}` };
        const stats = statSync(abs);
        if (!stats.isFile()) return { ok: false as const, error: `Not a file: ${input.path}` };
        if (stats.size > MAX_FILE_SIZE) return { ok: false as const, error: `File too large.` };
        
        const rawBuffer = readFileSync(abs);
        if (isBinaryFile(rawBuffer)) return { ok: false as const, error: `Binary file forbidden.` };
        
        const content = rawBuffer.toString("utf8");
        const lines = content.split(/\r?\n/);
        const start = input.startLine ?? 1;
        const end = input.endLine ?? lines.length;
        const selected = lines.slice(start - 1, end).join("\n");
        const maxChars = input.maxChars ?? DEFAULT_MAX_READ_CHARS;
        const truncated = selected.length > maxChars;

        return {
          ok: true as const,
          path: input.path,
          content: truncated ? `${selected.slice(0, maxChars)}\n...[truncated]` : selected,
          truncated,
        };
      }

      if (input.action === "rollback") {
        const dir = dirname(abs);
        const fileName = basename(abs);
        if (!existsSync(dir)) return { ok: false as const, error: `Directory not found for rollback.` };
        
        const backups = readdirSync(dir)
          .filter(f => f.startsWith(`${fileName}.bak.`))
          .sort()
          .reverse();

        if (backups.length === 0) {
          return { ok: false as const, error: `No backups found for ${input.path}` };
        }

        const latestBackup = join(dir, backups[0]);
        try {
          const backupContent = readFileSync(latestBackup, "utf8");
          writeFileSync(abs, backupContent, "utf8");
          return { ok: true as const, path: input.path, restoredFrom: backups[0] };
        } catch (err) {
          return { ok: false as const, error: `Rollback failed: ${err instanceof Error ? err.message : String(err)}` };
        }
      }

      if (input.action === "write") {
        if (Buffer.byteLength(input.content, "utf8") > MAX_WRITE_SIZE) return { ok: false as const, error: `Content too large.` };
        mkdirSync(dirname(abs), { recursive: true });
        let backupPath: string | undefined;
        if ((input.backupExisting ?? false) && existsSync(abs)) {
          backupPath = maybeWriteBackup(abs, readFileSync(abs, "utf8"));
        }
        writeFileSync(abs, input.content, "utf8");
        return { ok: true as const, path: input.path, backupPath };
      }

      if (input.action === "patch") {
        if (!existsSync(abs)) return { ok: false as const, error: `File not found.` };
        const original = readFileSync(abs, "utf8");
        const hasContext = Boolean(input.contextBefore || input.contextAfter);
        const target = hasContext ? `${input.contextBefore ?? ""}${input.oldSnippet}${input.contextAfter ?? ""}` : input.oldSnippet;
        const replacement = hasContext ? `${input.contextBefore ?? ""}${input.newSnippet}${input.contextAfter ?? ""}` : input.newSnippet;

        const matches = countOccurrences(original, target);
        if (matches === 0) return { ok: false as const, error: "Snippet not found." };
        if (!input.replaceAll && !hasContext && matches > 1) return { ok: false as const, error: "Ambiguous patch. Add context." };

        let backupPath: string | undefined;
        if (input.backupExisting ?? false) {
          backupPath = maybeWriteBackup(abs, original);
        }
        const updated = input.replaceAll ? original.split(target).join(replacement) : replaceFirst(original, target, replacement);
        writeFileSync(abs, updated, "utf8");
        return { ok: true as const, path: input.path, replacements: input.replaceAll ? matches : 1, backupPath };
      }

      if (input.action === "delete" || input.action === "rename") {
         if (!ctx.allowDestructiveOps()) return { ok: false as const, error: "Destructive ops disabled." };
         if (input.action === "delete") {
            rmSync(abs, { recursive: input.recursive ?? false, force: true });
            return { ok: true as const, path: input.path, deleted: true };
         } else {
            const newAbs = resolveUnderRoot(ctx.cwd, input.newPath);
            mkdirSync(dirname(newAbs), { recursive: true });
            renameSync(abs, newAbs);
            return { ok: true as const, path: input.path, newPath: input.newPath, renamed: true };
         }
      }

      return { ok: false as const, error: `Unsupported action: ${(input as any).action}` };
    },
  });
}
