import { z } from "zod";
import { tool } from "ai";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { appendAuditLog } from "../utils/audit.js";

export const verifyBaselineInputSchema = z.object({
  category: z.enum(["users", "groups", "services", "suid_binaries"]).describe("The category to verify"),
  currentList: z.array(z.string()).describe("The list of items currently found on the system"),
  osBaseline: z.enum(["ubuntu_2204", "windows_10"]).describe("The baseline OS to compare against"),
});

export type VerifyBaselineContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createVerifyBaselineTool(ctx: VerifyBaselineContext) {
  return tool({
    description: "Compare current system state (users, services, etc.) against a clean OS baseline to find anomalies.",
    parameters: verifyBaselineInputSchema,
    execute: async ({ category, currentList, osBaseline }) => {
      const fileName = osBaseline === "ubuntu_2204" ? "baseline_linux_ubuntu_2204.json" : "baseline_windows_10.json";
      const baselinePath = join(ctx.cwd, "scripts", "security", fileName);
      
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "verifyBaseline", category, osBaseline },
      });

      if (!existsSync(baselinePath)) {
        return {
          ok: false as const,
          error: `Baseline file not found at ${baselinePath}.`,
        };
      }

      try {
        const baselineData = JSON.parse(readFileSync(baselinePath, "utf8"));
        const baselineKey = {
          users: osBaseline === "ubuntu_2204" ? "authorized_users" : "standard_users",
          groups: osBaseline === "ubuntu_2204" ? "authorized_groups" : "standard_groups",
          services: osBaseline === "ubuntu_2204" ? "standard_services" : "standard_services",
          suid_binaries: "standard_suid_binaries"
        }[category];

        const standardItems = new Set(baselineData[baselineKey] || []);
        const anomalies = currentList.filter(item => !standardItems.has(item));

        return {
          ok: true as const,
          category,
          anomalies,
          summary: `Found ${anomalies.length} anomalies in category ${category} compared to ${osBaseline} baseline.`
        };
      } catch (err: any) {
        return {
          ok: false as const,
          error: `Failed to process baseline: ${err.message}`,
        };
      }
    },
  });
}
