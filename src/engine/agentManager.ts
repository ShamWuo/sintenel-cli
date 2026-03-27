import { generateText, tool, type CoreMessage } from "ai";
import { google } from "@ai-sdk/google";
import { appendAuditLog } from "../utils/audit.js";
import { confirmApprovalChallenge, confirmYesNo } from "../utils/confirm.js";
import { createExecutePowerShellTool } from "../tools/executePowerShell.js";
import { createFileOperatorTool } from "../tools/fileOperator.js";
import {
  createSubmitExecutionPlanTool,
  submitExecutionPlanInputSchema,
  type ExecutionPlan,
} from "../tools/submitExecutionPlan.js";
import { FIXER_SYSTEM } from "../agents/fixer.js";
import { ORCHESTRATOR_SYSTEM } from "../agents/orchestrator.js";
import { SCOUT_SYSTEM } from "../agents/scout.js";
import { evaluateCommandPolicy } from "../policy/commandPolicy.js";
import { ui } from "../utils/ui.js";
import { z } from "zod";
import { createHash } from "node:crypto";

/** Gemini 3 Flash (preview). Override with GEMINI_MODEL. */
const DEFAULT_MODEL = "gemini-3-flash-preview";

/** Lightweight model for sub-agents. Override with AI_SUBAGENT_MODEL. */
const DEFAULT_SUBAGENT_MODEL = "gemini-3.1-flash-lite-preview";

/** Maximum output tokens to limit response size and cost. */
const MAX_OUTPUT_TOKENS = 4096;
const MAX_OUTPUT_TOKENS_SUBAGENT = 2048;

function getModel(options?: { subagent?: boolean }) {
  const modelId = options?.subagent 
    ? (process.env.AI_SUBAGENT_MODEL?.trim() || DEFAULT_SUBAGENT_MODEL)
    : (process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL);

  return google(modelId);
}

export type PlanRow = { kind: "recon" | "change" | "verify"; purpose: string; command: string };

function normalizeCommand(command: string): string {
  return command.trim();
}

function extractExecutionPlan(result: {
  steps: ReadonlyArray<{
    toolCalls: ReadonlyArray<{ toolName: string; args?: unknown }>;
  }>;
}): ExecutionPlan | null {
  for (const step of result.steps) {
    for (const tc of step.toolCalls) {
      if (tc.toolName !== "submitExecutionPlan") continue;
      const parsed = submitExecutionPlanInputSchema.safeParse(tc.args);
      if (parsed.success) return parsed.data;
    }
  }
  return null;
}

function printPlanTable(plan: ExecutionPlan, rows: PlanRow[]): void {
  const fingerprint = createHash("sha256")
    .update(rows.map((r) => `${r.purpose}\n${r.command}`).join("\n---\n"), "utf8")
    .digest("hex");
  
  ui.printHeader('EXECUTION PLAN (PENDING CONFIRMATION)');
  
  ui.printInfo(`Summary: ${plan.summary}`);
  ui.printInfo(`Objective: ${plan.context.objective}`);
  ui.printInfo(`Scope: ${plan.context.scope}`);
  ui.printInfo(`Rollback: ${plan.context.rollbackPlan}`);
  
  const table = ui.createTable(['Kind', 'Purpose', 'Command']);
  for (const r of rows) {
    table.push([r.kind, r.purpose, r.command]);
  }
  ui.printTable(table);
  
  if (plan.context.risks.length > 0) {
    ui.printSection('Risks');
    for (const risk of plan.context.risks) {
      ui.printWarning(risk);
    }
  }
  if (plan.successCriteria.length > 0) {
    ui.printSection('Success criteria');
    for (const item of plan.successCriteria) {
      ui.printInfo(`- ${item}`);
    }
  }
  
  ui.printInfo(`Plan fingerprint: ${fingerprint.slice(0, 16)}...${fingerprint.slice(-16)}`);
  console.log('');
}

/**
 * Detects if agent is stuck in a loop (repeating similar messages).
 */
function isAgentStuck(messages: CoreMessage[]): boolean {
  if (messages.length < 6) return false;
  
  const recentAssistant = messages
    .slice(-6)
    .filter(m => m.role === "assistant")
    .map(m => typeof m.content === "string" ? m.content : "")
    .filter(c => c.length > 0);
  
  if (recentAssistant.length < 3) return false;
  
  // Check if last 3 messages are very similar (edit distance or length similarity)
  const lengths = recentAssistant.slice(-3).map(m => m.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.every(len => Math.abs(len - avgLength) < avgLength * 0.1);
  
  return variance;
}

/**
 * Prunes conversation history to reduce token usage while keeping essential context.
 * Keeps: system message, initial user goal, last N messages.
 */
function pruneMessages(messages: CoreMessage[], keepLast: number = 10): CoreMessage[] {
  if (messages.length <= keepLast + 2) return messages;
  
  const system = messages.find(m => m.role === "system");
  const userGoal = messages.find((m, i) => m.role === "user" && i > 0);
  const recent = messages.slice(-keepLast);
  
  const pruned: CoreMessage[] = [];
  if (system) pruned.push(system);
  if (userGoal && !recent.includes(userGoal)) pruned.push(userGoal);
  pruned.push(...recent.filter(m => m !== system && m !== userGoal));
  
  return pruned;
}

async function runSubAgent(args: {
  name: "scout" | "fixer";
  task: string;
  cwd: string;
  executionAllowed: () => boolean;
  isCommandApproved: (command: string) => boolean;
  canExecuteCommandNow: (command: string) => boolean;
  onCommandExecuted: (command: string) => void;
  allowDestructiveOps: () => boolean;
}): Promise<{ text: string; usage?: any }> {
  const system = args.name === "scout" ? SCOUT_SYSTEM : FIXER_SYSTEM;
  const tools = {
    executePowerShell: createExecutePowerShellTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
      executionAllowed: args.executionAllowed,
      isCommandApproved: args.isCommandApproved,
      canExecuteCommandNow: args.canExecuteCommandNow,
      onCommandExecuted: args.onCommandExecuted,
    }),
    fileOperator: createFileOperatorTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
      writeAllowed:
        args.name === "scout" ? () => false : args.executionAllowed,
      allowDestructiveOps: args.allowDestructiveOps,
    }),
  };

  const result = await generateText({
    model: getModel({ subagent: true }),
    messages: [
      { role: "system", content: system },
      { role: "user", content: args.task },
    ],
    tools,
    maxSteps: 20, // Reduced from 25
    maxTokens: MAX_OUTPUT_TOKENS_SUBAGENT,
    temperature: 0.3, // Lower temperature for focused, deterministic responses
  });

  const text = result.text ?? "";
  appendAuditLog(args.cwd, {
    kind: "ai",
    agent: args.name,
    payload: {
      text,
      finishReason: result.finishReason,
      usage: result.usage,
    },
  });
  return { text, usage: result.usage };
}

/**
 * Central engine: orchestrates the multi-agent loop, plan/confirm gate, and audit logging.
 */
export class AgentManager {
  constructor(private readonly cwd: string) {}

  async run(userGoal: string): Promise<void> {
    return runOrchestratorSession({ cwd: this.cwd, userGoal });
  }
}

export async function runOrchestratorSession(args: {
  cwd: string;
  userGoal: string;
}): Promise<void> {
  const { cwd, userGoal } = args;

  const strictMode = process.env.SINTENEL_STRICT_MODE !== "false";
  const highAssuranceApproval =
    strictMode || process.env.SINTENEL_HIGH_ASSURANCE_APPROVAL === "true";
  const destructiveOpsEnabled =
    !strictMode && process.env.SINTENEL_ALLOW_DESTRUCTIVE_OPS === "true";

  appendAuditLog(cwd, {
    kind: "system",
    payload: {
      event: "session_start",
      goal: userGoal,
      strictMode,
      highAssuranceApproval,
      destructiveOpsEnabled,
    },
  });

  let planApproved = false;
  let approvedCommands = new Set<string>();
  let planRequestAttempts = 0;
  const maxExecutionsPerCommand = Number(process.env.SINTENEL_MAX_EXECUTIONS_PER_COMMAND ?? "3");
  const commandExecutionCount = new Map<string, number>();
  const maxSessionTurns = Number(process.env.SINTENEL_MAX_SESSION_TURNS ?? "18");

  const executionAllowed = () => planApproved;
  const isCommandApproved = (command: string) =>
    approvedCommands.has(normalizeCommand(command));
  const canExecuteCommandNow = (command: string) =>
    (commandExecutionCount.get(normalizeCommand(command)) ?? 0) < maxExecutionsPerCommand;
  const onCommandExecuted = (command: string) => {
    const key = normalizeCommand(command);
    commandExecutionCount.set(key, (commandExecutionCount.get(key) ?? 0) + 1);
  };
  const allowDestructiveOps = () => destructiveOpsEnabled;

  const delegateSchema = z.object({
    task: z.string().min(1).describe("Task for sub-agent"),
  });

  const tools = {
    submitExecutionPlan: createSubmitExecutionPlanTool({
      cwd,
      audit: appendAuditLog,
      agent: "orchestrator",
    }),
    executePowerShell: createExecutePowerShellTool({
      cwd,
      audit: appendAuditLog,
      agent: "orchestrator",
      executionAllowed,
      isCommandApproved,
      canExecuteCommandNow,
      onCommandExecuted,
    }),
    fileOperator: createFileOperatorTool({
      cwd,
      audit: appendAuditLog,
      agent: "orchestrator",
      writeAllowed: executionAllowed,
      allowDestructiveOps,
    }),
    delegateToScout: tool({
      description: "Delegate recon to Scout (read-only: listings, files, netstat).",
      parameters: delegateSchema,
      execute: async ({ task }) => {
        appendAuditLog(cwd, {
          kind: "tool",
          agent: "orchestrator",
          payload: { tool: "delegateToScout", task },
        });
        if (!executionAllowed()) {
          return {
            ok: false as const,
            error: "Delegation blocked. Submit plan first.",
          };
        }
        const { text } = await runSubAgent({
          name: "scout",
          task,
          cwd,
          executionAllowed,
          isCommandApproved,
          canExecuteCommandNow,
          onCommandExecuted,
          allowDestructiveOps: () => false,
        });
        return { ok: true as const, report: text };
      },
    }),
    delegateToFixer: tool({
      description: "Delegate patching to Fixer (writes, runs verification).",
      parameters: delegateSchema,
      execute: async ({ task }) => {
        appendAuditLog(cwd, {
          kind: "tool",
          agent: "orchestrator",
          payload: { tool: "delegateToFixer", task },
        });
        if (!executionAllowed()) {
          return {
            ok: false as const,
            error: "Delegation blocked. Submit plan first.",
          };
        }
        const { text } = await runSubAgent({
          name: "fixer",
          task,
          cwd,
          executionAllowed,
          isCommandApproved,
          canExecuteCommandNow,
          onCommandExecuted,
          allowDestructiveOps,
        });
        return { ok: true as const, report: text };
      },
    }),
  };

  const messages: CoreMessage[] = [
    { role: "system", content: ORCHESTRATOR_SYSTEM },
    { role: "user", content: userGoal },
  ];

  // Plan & confirm loop: allow another model turn after Y to run tools and delegates.
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let turnCount = 0;
  const MAX_CONTEXT_MESSAGES = 15; // Prune context after this many messages
  
  for (;;) {
    turnCount++;
    if (turnCount > maxSessionTurns) {
      ui.printError(`Session exceeded max turns (${maxSessionTurns}). Aborting safely.`);
      appendAuditLog(cwd, {
        kind: "system",
        payload: { event: "session_end", reason: "max_turns_exceeded", turnCount, maxSessionTurns },
      });
      return;
    }
    
    // Prune context to reduce token usage on long sessions
    const messagesToSend = turnCount > 2 ? pruneMessages(messages, MAX_CONTEXT_MESSAGES) : messages;
    
    const result = await generateText({
      model: getModel(),
      messages: messagesToSend,
      tools,
      maxSteps: 25, // Reduced from 30
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4, // Focused responses, less rambling
    });

    for (const msg of result.response.messages) {
      messages.push(msg);
    }

    if (result.text) {
      ui.printAgent('Orchestrator', result.text);
    }

    // Track cumulative usage
    if (result.usage) {
      totalUsage.promptTokens += result.usage.promptTokens || 0;
      totalUsage.completionTokens += result.usage.completionTokens || 0;
      totalUsage.totalTokens += result.usage.totalTokens || 0;
    }

    appendAuditLog(cwd, {
      kind: "ai",
      agent: "orchestrator",
      payload: {
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
        cumulativeUsage: totalUsage,
      },
    });

    // Early stopping if agent is stuck
    if (planApproved && isAgentStuck(messages)) {
      console.log("\n[Warning] Agent appears stuck in loop. Terminating to save costs.");
      appendAuditLog(cwd, {
        kind: "system",
        payload: { event: "session_end", reason: "stuck_detected", totalUsage },
      });
      return;
    }

    const pendingPlan = !planApproved ? extractExecutionPlan(result) : null;

    if (pendingPlan) {
      planRequestAttempts = 0;
      const policyViolations = pendingPlan.commands
        .map((entry) => ({
          command: entry.command,
          decision: evaluateCommandPolicy(entry.command),
        }))
        .filter(
          (
            x
          ): x is {
            command: string;
            decision: { allowed: false; reason: string };
          } => !x.decision.allowed
        );
      if (policyViolations.length > 0) {
        appendAuditLog(cwd, {
          kind: "system",
          payload: {
            event: "plan_policy_rejected",
            violations: policyViolations.map((v) => ({
              command: v.command,
              reason: v.decision.reason,
            })),
          },
        });
        messages.push({
          role: "user",
          content: `Execution plan rejected by command policy. Violations:\n${policyViolations
            .map((v) => `- ${v.command}: ${v.decision.reason}`)
            .join("\n")}\nProvide a revised plan with policy-compliant commands only.`,
        });
        continue;
      }
      const rows: PlanRow[] = pendingPlan.commands.map((c) => ({
        kind: c.kind,
        purpose: c.purpose,
        command: c.command,
      }));
      printPlanTable(pendingPlan, rows);

      const ok = await confirmYesNo("Execute planned shell commands and continue? [Y/N]: ");
      const challengeOk = highAssuranceApproval ? await confirmApprovalChallenge() : true;
      appendAuditLog(cwd, {
        kind: "system",
        payload: {
          event: "plan_confirmation",
          approved: ok,
          challengeApproved: challengeOk,
          highAssuranceApproval,
        },
      });

      if (!ok || !challengeOk) {
        ui.printError("Session aborted by operator.");
        appendAuditLog(cwd, {
          kind: "system",
          payload: { event: "session_end", reason: "plan_rejected" },
        });
        return;
      }

      planApproved = true;
      approvedCommands = new Set(
        pendingPlan.commands.map((entry) => normalizeCommand(entry.command))
      );
      commandExecutionCount.clear();
      for (const entry of pendingPlan.commands) {
        commandExecutionCount.set(normalizeCommand(entry.command), 0);
      }
      messages.push({
        role: "user",
        content:
          "Operator replied Y: you may execute approved PowerShell commands, call delegateToScout / delegateToFixer as needed, and complete the goal.",
      });
      continue;
    }

    if (!planApproved) {
      planRequestAttempts += 1;
      if (planRequestAttempts >= 3) {
        console.log(
          "Unable to get a valid execution plan with context after multiple attempts. Session aborted."
        );
        appendAuditLog(cwd, {
          kind: "system",
          payload: { event: "session_end", reason: "missing_plan_context" },
        });
        return;
      }
      messages.push({
        role: "user",
        content:
          "Before any command or delegation, call submitExecutionPlan with context { objective, scope, risks, rollbackPlan } and complete command list.",
      });
      continue;
    }

    if (result.finishReason !== "stop") {
      appendAuditLog(cwd, {
        kind: "system",
        payload: { event: "non_stop_finish", finishReason: result.finishReason },
      });
    }
    
    // Log final usage summary
    ui.printHeader('SESSION COMPLETE');
    ui.printUsageStats(totalUsage);
    
    // Estimate cost (assumes Gemini pricing)
    const inputCost = (totalUsage.promptTokens / 1_000_000) * 0.075;
    const outputCost = (totalUsage.completionTokens / 1_000_000) * 0.30;
    const estimatedCost = inputCost + outputCost;
    ui.printCostEstimate(totalUsage.totalTokens, estimatedCost);
    
    break;
  }

  appendAuditLog(cwd, {
    kind: "system",
    payload: { event: "session_end", reason: "complete", totalUsage },
  });
}
