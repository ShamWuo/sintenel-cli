import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";

export const diffAuditStateInputSchema = z.object({
  initialState: z.record(z.any()).describe("The JSON payload from the first audit script run"),
  currentState: z.record(z.any()).describe("The JSON payload from the most recent audit script run"),
});

export type DiffAuditStateContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createDiffAuditStateTool(ctx: DiffAuditStateContext) {
  return tool({
    description: "Compare initial and current system audit states to verify remediations and identify remaining issues.",
    parameters: diffAuditStateInputSchema,
    execute: async ({ initialState, currentState }) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "diffAuditState" },
      });

      const diff: Record<string, any> = {};

      // Helper to find differences in simple arrays (Users, Admins, etc.)
      const getArrayDiff = (initial: string[], current: string[]) => {
        const removed = initial.filter(x => !current.includes(x));
        const added = current.filter(x => !initial.includes(x));
        return { removed, added };
      };

      // 1. Check Users
      if (initialState.Users && currentState.Users) {
        const initialNames = initialState.Users.map((u: any) => u.Name);
        const currentNames = currentState.Users.map((u: any) => u.Name);
        diff.Users = getArrayDiff(initialNames, currentNames);
      }

      // 2. Check Admins
      if (initialState.Admins && currentState.Admins) {
        diff.Admins = getArrayDiff(initialState.Admins, currentState.Admins);
      }

      // 3. Check Insecure Services
      if (initialState.InsecureServices && currentState.InsecureServices) {
        diff.Services = getArrayDiff(initialState.InsecureServices, currentState.InsecureServices);
      }

      // 4. Check Listening Ports
      if (initialState.ListeningPorts && currentState.ListeningPorts) {
        diff.Ports = getArrayDiff(initialState.ListeningPorts, currentState.ListeningPorts);
      }

      return {
        ok: true as const,
        diff,
        summary: "Audit state comparison complete. Review 'removed' items to confirm remediation and 'added' items for potential new issues."
      };
    },
  });
}
