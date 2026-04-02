import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";

const execFileAsync = promisify(execFile);
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_AI_OUTPUT_CHARS = 20_000; // Cap output to AI to save costs (~5k tokens)

export const executeShellInputSchema = z.object({
  command: z
    .string()
    .min(1)
    .describe("Shell command to run (bash/sh on Unix, PowerShell on Windows)"),
  shell: z.enum(["auto", "bash", "sh", "powershell", "pwsh"]).optional().describe("Shell to use (default: auto-detect)"),
});

export type ExecuteShellContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
  executionAllowed: () => boolean;
  isCommandApproved: (command: string) => boolean;
};

function getShell(requested?: string): { shell: string; args: string[] } {
  if (requested === "bash") {
    return { shell: "bash", args: ["-c"] };
  }
  if (requested === "sh") {
    return { shell: "sh", args: ["-c"] };
  }
  if (requested === "pwsh") {
    return { shell: "pwsh", args: ["-NoProfile", "-NonInteractive", "-Command"] };
  }
  if (requested === "powershell") {
    return { 
      shell: process.platform === "win32" ? "powershell.exe" : "pwsh",
      args: process.platform === "win32" 
        ? ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"]
        : ["-NoProfile", "-NonInteractive", "-Command"]
    };
  }

  // Auto-detect
  if (process.platform === "win32") {
    return { 
      shell: "powershell.exe",
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command"]
    };
  } else {
    return { shell: "bash", args: ["-c"] };
  }
}

export function createExecuteShellTool(ctx: ExecuteShellContext) {
  return tool({
    description: "Run approved shell command (auto-detects bash/PowerShell). Requires plan confirmation.",
    parameters: executeShellInputSchema,
    execute: async ({ command, shell: requestedShell }) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "executeShell", command, shell: requestedShell },
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

      const { shell, args } = getShell(requestedShell);

      try {
        const { stdout, stderr } = await execFileAsync(shell, [...args, command], {
          cwd: ctx.cwd,
          maxBuffer: 8 * 1024 * 1024,
          timeout: COMMAND_TIMEOUT_MS,
          killSignal: "SIGKILL",
          windowsHide: true,
          shell: false,
        });

        const stdoutStr = String(stdout ?? "");
        const stderrStr = String(stderr ?? "");

        ctx.audit(ctx.cwd, {
          kind: "command",
          agent: ctx.agent,
          payload: {
            tool: "executeShell",
            command,
            shell,
            stdoutSnippet: stdoutStr.length > 4000 ? `${stdoutStr.slice(0, 4000)}\n...[${stdoutStr.length} chars]` : stdoutStr,
            stderrSnippet: stderrStr.length > 2000 ? `${stderrStr.slice(0, 2000)}\n...[${stderrStr.length} chars]` : stderrStr,
          },
        });

        // TRUNCATE FOR AI COST OPTIMIZATION
        let truncatedStdout = stdoutStr;
        let warning = "";
        if (stdoutStr.length > MAX_AI_OUTPUT_CHARS) {
          truncatedStdout = stdoutStr.slice(0, MAX_AI_OUTPUT_CHARS) + `\n\n[TRUNCATED: Output too large (${stdoutStr.length} chars). Use more specific filters or grep to see missing data.]`;
          warning = "Output truncated for cost efficiency.";
        }

        return {
          ok: true as const,
          stdout: truncatedStdout,
          stderr: stderrStr,
          shell,
          warning: warning || undefined,
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
            tool: "executeShell",
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
      }
    },
  });
}
