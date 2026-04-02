import { z } from "zod";
import { tool } from "ai";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { appendAuditLog } from "../utils/audit.js";

export const verificationTestInputSchema = z.object({
  testName: z.string().describe("Descriptive name of the test (e.g., check_password_complexity.ps1)"),
  code: z.string().describe("The PowerShell or Bash code to run as a verification check"),
  platform: z.enum(["windows", "linux"]),
});

export type VerificationTestContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createSubmitVerificationTestTool(ctx: VerificationTestContext) {
  return tool({
    description: "Submit an automated verification script that mirrors the competition scoring engine.",
    parameters: verificationTestInputSchema,
    execute: async ({ testName, code, platform }) => {
      const testDir = join(ctx.cwd, "verification_tests");
      mkdirSync(testDir, { recursive: true });

      const filePath = join(testDir, testName);
      writeFileSync(filePath, code, "utf8");

      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "submitVerificationTest", testName, platform },
      });

      return {
        ok: true as const,
        message: `Verification test '${testName}' has been deployed to ${testDir}. User can run this to verify the fix.`,
        path: filePath,
      };
    },
  });
}
