import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";

export const submitExecutionPlanInputSchema = z.object({
  summary: z.string().min(1).describe("Short summary of the planned work"),
  context: z
    .object({
      objective: z.string().min(1).describe("Primary mission objective"),
      scope: z.string().min(1).describe("In-scope targets and boundaries"),
      risks: z.array(z.string().min(1)).min(1).describe("Known operational or technical risks"),
      rollbackPlan: z.string().min(1).describe("How to recover if a command causes issues"),
    })
    .describe("Execution context used by the operator to make approval decisions"),
  commands: z
    .array(
      z.object({
        kind: z.enum(["recon", "change", "verify"]).describe("Command intent category"),
        purpose: z.string().min(3).max(180),
        command: z.string().min(1).max(500),
      })
    )
    .min(1)
    .max(50)
    .describe("Shell commands you intend to run after operator approval"),
  successCriteria: z
    .array(z.string().min(3))
    .min(1)
    .max(20)
    .describe("Concrete checks that define task completion"),
}).superRefine((plan, ctx) => {
  const normalized = plan.commands.map((c) => c.command.trim().toLowerCase());
  const seen = new Set<string>();
  for (let i = 0; i < normalized.length; i++) {
    const cmd = normalized[i];
    if (seen.has(cmd)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Duplicate command in execution plan",
        path: ["commands", i, "command"],
      });
    }
    seen.add(cmd);
  }

  if (!plan.commands.some((c) => c.kind === "verify")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Execution plan must include at least one verify command",
      path: ["commands"],
    });
  }
});

export type ExecutionPlan = z.infer<typeof submitExecutionPlanInputSchema>;

export type SubmitExecutionPlanContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createSubmitExecutionPlanTool(ctx: SubmitExecutionPlanContext) {
  return tool({
    description:
      "REQUIRED before any executePowerShell use: submit the exact PowerShell commands you will run as a structured plan. The CLI will show a table and wait for Y/N.",
    parameters: submitExecutionPlanInputSchema,
    execute: async (plan) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "submitExecutionPlan", plan },
      });
      return {
        ok: true as const,
        message:
          "Plan recorded. The operator will see a formatted table and must answer Y/N before commands execute.",
      };
    },
  });
}
