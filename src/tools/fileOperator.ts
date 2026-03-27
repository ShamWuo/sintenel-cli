import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, statSync, lstatSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";
import { resolveUnderRoot } from "../utils/paths.js";

const DEFAULT_MAX_READ_CHARS = 120_000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WRITE_SIZE = 5 * 1024 * 1024; // 5MB

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function isBinaryFile(content: Buffer): boolean {
  // Check first 8KB for null bytes (common indicator of binary content)
  const sample = content.subarray(0, Math.min(8192, content.length));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function findLineNumber(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split(/\r?\n/).length;
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

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
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
]);

export type FileOperatorContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
  /** Reads allowed anytime; write/patch require approval in the orchestrator flow. */
  writeAllowed: () => boolean;
  /** Controls delete/rename actions, disabled by default. */
  allowDestructiveOps: () => boolean;
};

export function createFileOperatorTool(ctx: FileOperatorContext) {
  return tool({
    description: "Read, write, patch, delete, or rename files in working directory. Prevents path traversal.",
    parameters: fileOperatorInputSchema,
    execute: async (input) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { 
          tool: "fileOperator", 
          input: {
            ...input,
            // Truncate large content in audit logs to save space
            ...(input.action === "write" && input.content.length > 1000 
              ? { content: `${input.content.slice(0, 1000)}...[${input.content.length} chars total]` }
              : {}),
            ...(input.action === "patch" && input.oldSnippet.length > 500
              ? { oldSnippet: `${input.oldSnippet.slice(0, 500)}...[truncated]` }
              : {}),
            ...(input.action === "patch" && input.newSnippet.length > 500
              ? { newSnippet: `${input.newSnippet.slice(0, 500)}...[truncated]` }
              : {}),
          }
        },
      });

      // Validate relative paths
      if (isAbsolute(input.path)) {
        return {
          ok: false as const,
          error: `Absolute paths not allowed: ${input.path}`,
        };
      }

      // Check for UNC paths on Windows
      if (input.path.startsWith("\\\\") || input.path.startsWith("//")) {
        return {
          ok: false as const,
          error: `UNC paths not allowed: ${input.path}`,
        };
      }

      if (input.action !== "read" && !ctx.writeAllowed()) {
        return {
          ok: false as const,
          error: "Write blocked. Confirm plan with Y first.",
        };
      }

      let abs: string;
      try {
        abs = resolveUnderRoot(ctx.cwd, input.path);
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      // Check for symlinks
      try {
        if (existsSync(abs)) {
          const stats = lstatSync(abs);
          if (stats.isSymbolicLink()) {
            return {
              ok: false as const,
              error: `Symlinks not allowed: ${input.path}`,
            };
          }
        }
      } catch (err) {
        return {
          ok: false as const,
          error: `Failed to check path: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      if (input.action === "read") {
        if (!existsSync(abs)) {
          return { ok: false as const, error: `File not found: ${input.path}` };
        }

        let stats;
        try {
          stats = statSync(abs);
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to read file metadata: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if (!stats.isFile()) {
          return { ok: false as const, error: `Not a file: ${input.path}` };
        }

        if (stats.size > MAX_FILE_SIZE) {
          return {
            ok: false as const,
            error: `File too large (${stats.size} bytes). Max: ${MAX_FILE_SIZE} bytes (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`,
          };
        }

        let rawBuffer: Buffer;
        try {
          rawBuffer = readFileSync(abs);
        } catch (err) {
          return {
            ok: false as const,
            error: `Read failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if (isBinaryFile(rawBuffer)) {
          return {
            ok: false as const,
            error: `Binary file: ${input.path}. Text files only.`,
          };
        }

        let content: string;
        try {
          content = rawBuffer.toString("utf8");
        } catch (err) {
          return {
            ok: false as const,
            error: `UTF-8 decode failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const lines = content.split(/\r?\n/);
        const start = input.startLine ?? 1;
        const end = input.endLine ?? lines.length;
        
        if (start < 1 || end < 1) {
          return { ok: false as const, error: "Line numbers must be >= 1." };
        }

        if (start > lines.length) {
          return {
            ok: false as const,
            error: `startLine (${start}) > file length (${lines.length}).`,
          };
        }

        if (start > end) {
          return { ok: false as const, error: "startLine must be <= endLine." };
        }

        const selected = lines.slice(start - 1, end).join("\n");
        const maxChars = input.maxChars ?? DEFAULT_MAX_READ_CHARS;
        const truncated = selected.length > maxChars;
        return {
          ok: true as const,
          path: input.path,
          startLine: start,
          endLine: end,
          totalLines: lines.length,
          size: stats.size,
          content: truncated ? `${selected.slice(0, maxChars)}\n...[truncated]` : selected,
          truncated,
        };
      }

      if (input.action === "write") {
        if (input.expectedFileSha256 && existsSync(abs)) {
          try {
            const current = readFileSync(abs, "utf8");
            const currentHash = sha256Hex(current);
            if (currentHash.toLowerCase() !== input.expectedFileSha256.toLowerCase()) {
              return {
                ok: false as const,
                error: "Write precondition failed: expectedFileSha256 mismatch.",
              };
            }
          } catch (err) {
            return {
              ok: false as const,
              error: `Precondition check failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
        if (Buffer.byteLength(input.content, "utf8") > MAX_WRITE_SIZE) {
          return {
            ok: false as const,
            error: `Content too large (${Buffer.byteLength(input.content, "utf8")} bytes). Max: ${MAX_WRITE_SIZE} bytes`,
          };
        }

        try {
          if (input.createDirectories ?? true) {
            mkdirSync(dirname(abs), { recursive: true });
          }
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to create dirs: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        let backupPath: string | undefined;
        if ((input.backupExisting ?? false) && existsSync(abs)) {
          try {
            backupPath = maybeWriteBackup(abs, readFileSync(abs, "utf8"));
          } catch (err) {
            return {
              ok: false as const,
              error: `Backup failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        try {
          writeFileSync(abs, input.content, "utf8");
        } catch (err) {
          return {
            ok: false as const,
            error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const lines = input.content.split(/\r?\n/).length;
        return {
          ok: true as const,
          path: input.path,
          bytes: Buffer.byteLength(input.content, "utf8"),
          lines,
          backupPath,
        };
      }

      if (input.action === "delete") {
        if (!ctx.allowDestructiveOps()) {
          return {
            ok: false as const,
            error: "Destructive ops disabled. Set SINTENEL_ALLOW_DESTRUCTIVE_OPS=true.",
          };
        }
        if (!existsSync(abs)) {
          return { ok: false as const, error: `Path not found: ${input.path}` };
        }

        try {
          const stats = statSync(abs);
          if (stats.isDirectory() && !(input.recursive ?? false)) {
            return {
              ok: false as const,
              error: `Cannot delete directory without recursive=true: ${input.path}`,
            };
          }
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to check path: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        try {
          rmSync(abs, { recursive: input.recursive ?? false, force: true });
          return { ok: true as const, path: input.path, deleted: true };
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      if (input.action === "rename") {
        if (!ctx.allowDestructiveOps()) {
          return {
            ok: false as const,
            error: "Destructive ops disabled. Set SINTENEL_ALLOW_DESTRUCTIVE_OPS=true.",
          };
        }
        if (!existsSync(abs)) {
          return { ok: false as const, error: `Path not found: ${input.path}` };
        }

        if (isAbsolute(input.newPath)) {
          return {
            ok: false as const,
            error: `Absolute paths not allowed for newPath: ${input.newPath}`,
          };
        }

        let newAbs: string;
        try {
          newAbs = resolveUnderRoot(ctx.cwd, input.newPath);
        } catch (err) {
          return {
            ok: false as const,
            error: `Invalid newPath: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if (existsSync(newAbs)) {
          return { ok: false as const, error: `Destination already exists: ${input.newPath}` };
        }

        try {
          mkdirSync(dirname(newAbs), { recursive: true });
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to create destination directory: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        try {
          renameSync(abs, newAbs);
          return { ok: true as const, path: input.path, newPath: input.newPath, renamed: true };
        } catch (err) {
          return {
            ok: false as const,
            error: `Failed to rename: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // patch
      if (input.action === "patch") {
        if (!existsSync(abs)) {
          return { ok: false as const, error: `File not found: ${input.path}` };
        }

        let stats;
        try {
          stats = statSync(abs);
        } catch (err) {
          return {
            ok: false as const,
            error: `Stat failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if (!stats.isFile()) {
          return { ok: false as const, error: `Not a file: ${input.path}` };
        }

        if (stats.size > MAX_FILE_SIZE) {
          return {
            ok: false as const,
            error: `File too large (${stats.size} bytes). Max: ${MAX_FILE_SIZE} bytes`,
          };
        }

        let original: string;
        try {
          const rawBuffer = readFileSync(abs);
          if (isBinaryFile(rawBuffer)) {
            return {
              ok: false as const,
              error: `Binary file: ${input.path}. Text files only.`,
            };
          }
          original = rawBuffer.toString("utf8");
        } catch (err) {
          return {
            ok: false as const,
            error: `Read failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if (input.expectedFileSha256) {
          const currentHash = sha256Hex(original);
          if (currentHash.toLowerCase() !== input.expectedFileSha256.toLowerCase()) {
            return {
              ok: false as const,
              error: "Patch precondition failed: expectedFileSha256 mismatch.",
            };
          }
        }

        const hasContext = Boolean(input.contextBefore || input.contextAfter);
        const target = hasContext
          ? `${input.contextBefore ?? ""}${input.oldSnippet}${input.contextAfter ?? ""}`
          : input.oldSnippet;
        const replacement = hasContext
          ? `${input.contextBefore ?? ""}${input.newSnippet}${input.contextAfter ?? ""}`
          : input.newSnippet;

        const matches = countOccurrences(original, target);
        if (matches === 0) {
          const firstMatchIndex = original.indexOf(input.oldSnippet);
          if (firstMatchIndex !== -1) {
            const lineNum = findLineNumber(original, firstMatchIndex);
            return {
              ok: false as const,
              error: `oldSnippet not found with context. Found alone at line ~${lineNum}.`,
            };
          }
          return {
            ok: false as const,
            error: "oldSnippet not found. Check exact whitespace/indentation.",
          };
        }

        if (!input.replaceAll && !hasContext && matches > 1) {
          const firstIndex = original.indexOf(target);
          const firstLine = findLineNumber(original, firstIndex);
          return {
            ok: false as const,
            error: `oldSnippet appears ${matches}x (first: line ~${firstLine}). Add context or set replaceAll=true.`,
          };
        }

        if (
          typeof input.expectedReplacements === "number" &&
          input.expectedReplacements !== matches
        ) {
          return {
            ok: false as const,
            error: `Count mismatch: expected ${input.expectedReplacements}, found ${matches}.`,
          };
        }

        let backupPath: string | undefined;
        if (input.backupExisting ?? false) {
          try {
            backupPath = maybeWriteBackup(abs, original);
          } catch (err) {
            return {
              ok: false as const,
              error: `Backup failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        const updated = input.replaceAll
          ? original.split(target).join(replacement)
          : replaceFirst(original, target, replacement);

        if (Buffer.byteLength(updated, "utf8") > MAX_WRITE_SIZE) {
          return {
            ok: false as const,
            error: `Result too large (${Buffer.byteLength(updated, "utf8")} bytes). Max: ${MAX_WRITE_SIZE} bytes`,
          };
        }

        try {
          writeFileSync(abs, updated, "utf8");
        } catch (err) {
          return {
            ok: false as const,
            error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const originalLines = original.split(/\r?\n/).length;
        const updatedLines = updated.split(/\r?\n/).length;
        const linesChanged = Math.abs(updatedLines - originalLines);

        return {
          ok: true as const,
          path: input.path,
          bytes: Buffer.byteLength(updated, "utf8"),
          lines: updatedLines,
          linesChanged: linesChanged > 0 ? linesChanged : undefined,
          replacements: input.replaceAll ? matches : 1,
          backupPath,
        };
      }

      return { ok: false as const, error: `Unsupported action: ${(input as any).action}` };
    },
  });
}
