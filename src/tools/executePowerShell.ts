import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";
import { assertSafePowerShellCommand } from "../utils/safeShell.js";
import { evaluateCommandPolicy } from "../policy/commandPolicy.js";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 45_000;

export const executePowerShellInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .max(500)
    .describe("PowerShell command to run (non-interactive)"),
});

export type ExecutePowerShellContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
  /** When false, tool rejects execution (plan not confirmed). */
  executionAllowed: () => boolean;
  /** Returns true only when command is part of approved execution plan. */
  isCommandApproved: (command: string) => boolean;
  /** Per-command execution budget gate (anti-loop/replay). */
  canExecuteCommandNow: (command: string) => boolean;
  /** Called when command actually executes (success/failure). */
  onCommandExecuted: (command: string) => void;
};

export function createExecutePowerShellTool(ctx: ExecutePowerShellContext) {
  return tool({
    description: "Run approved PowerShell command in working directory. Requires plan confirmation.",
    parameters: executePowerShellInputSchema,
    execute: async ({ command }) => {
      if (/[^\x09\x20-\x7E]/.test(command)) {
        return {
          ok: false as const,
          error: "Command contains non-printable characters",
        };
      }

      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "executePowerShell", command },
      });

      if (!ctx.executionAllowed()) {
        return {
          ok: false as const,
          error: "Execution blocked. Submit plan and get Y approval first.",
        };
      }

      if (!ctx.isCommandApproved(command)) {
        return {
          ok: false as const,
          error: "Command not in approved plan. Re-submit with this command included.",
        };
      }
      if (!ctx.canExecuteCommandNow(command)) {
        return {
          ok: false as const,
          error: "Command execution budget exceeded for this approved command.",
        };
      }

      const safe = assertSafePowerShellCommand(command);
      if (!safe.ok) {
        return {
          ok: false as const,
          error: safe.reason,
          matchedPattern: safe.matchedPattern,
        };
      }

      const policy = evaluateCommandPolicy(command);
      if (!policy.allowed) {
        return {
          ok: false as const,
          error: policy.reason,
        };
      }

      const shell = process.platform === "win32" ? "powershell.exe" : "pwsh";
      const args =
        process.platform === "win32"
          ? [
              "-NoProfile",
              "-NonInteractive",
              "-ExecutionPolicy",
              "Bypass",
              "-Command",
              command,
            ]
          : ["-NoProfile", "-NonInteractive", "-Command", command];

      try {
        const { stdout, stderr } = await execFileAsync(shell, args, {
          cwd: ctx.cwd,
          maxBuffer: 8 * 1024 * 1024,
          timeout: COMMAND_TIMEOUT_MS,
          killSignal: "SIGKILL",
          windowsHide: true,
        });
        
        const stdoutStr = String(stdout ?? "");
        const stderrStr = String(stderr ?? "");
        
        // Truncate for audit log only (return full to agent)
        ctx.audit(ctx.cwd, {
          kind: "command",
          agent: ctx.agent,
          payload: {
            tool: "executePowerShell",
            command,
            stdoutSnippet: stdoutStr.length > 4000 ? `${stdoutStr.slice(0, 4000)}\n...[${stdoutStr.length} chars]` : stdoutStr,
            stderrSnippet: stderrStr.length > 2000 ? `${stderrStr.slice(0, 2000)}\n...[${stderrStr.length} chars]` : stderrStr,
          },
        });
        
        return {
          ok: true as const,
          stdout: stdoutStr,
          stderr: stderrStr,
        };
      } catch (err: unknown) {
        const e = err as {
          stdout?: string;
          stderr?: string;
          message?: string;
          code?: string | number;
        };
        ctx.audit(ctx.cwd, {
          kind: "command",
          agent: ctx.agent,
          payload: {
            tool: "executePowerShell",
            command,
            error: e.message,
            code: e.code,
          },
        });
        return {
          ok: false as const,
          stdout: e.stdout ?? "",
          stderr: e.stderr ?? "",
          error: e.message ?? String(err),
          code: e.code,
        };
      } finally {
        ctx.onCommandExecuted(command);
      }
    },
  });
}
