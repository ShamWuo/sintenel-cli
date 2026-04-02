import { z } from "zod";
import { tool } from "ai";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { appendAuditLog } from "../utils/audit.js";

export const extractReadmeInputSchema = z.object({
  readmePath: z.string().default("README.txt").describe("Path to the README file (usually README.txt on Desktop)"),
});

export type ExtractReadmeContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createExtractReadmeTool(ctx: ExtractReadmeContext) {
  return tool({
    description: "Extract authorized users, admins, and required services from the README file. Essential for avoiding penalties.",
    parameters: extractReadmeInputSchema,
    execute: async ({ readmePath }) => {
      const fullPath = join(ctx.cwd, readmePath);
      
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "extractReadme", path: readmePath },
      });

      if (!existsSync(fullPath)) {
        return {
          ok: false as const,
          error: `README file not found at ${readmePath}. Please check the Desktop or home directory manually.`,
        };
      }

      try {
        const content = readFileSync(fullPath, "utf8");
        
        // Return the content. The LLM is better at parsing the messy human-written 
        // READMEs found in CP images than a rigid regex.
        return {
          ok: true as const,
          content,
          instruction: "Parse this content carefully. Extract: 1. Authorized Users, 2. Authorized Administrators, 3. Required Services/Ports, 4. Critical Business Functions.",
        };
      } catch (err: any) {
        return {
          ok: false as const,
          error: `Failed to read README: ${err.message}`,
        };
      }
    },
  });
}
