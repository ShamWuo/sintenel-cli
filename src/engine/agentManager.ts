import { streamText, tool, type CoreMessage } from "ai";
import chalk from "chalk";
import { google } from "@ai-sdk/google";
import { appendAuditLog } from "../utils/audit.js";
import { confirmYesNo } from "../utils/confirm.js";
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
import { ui } from "../utils/ui.js";
import { z } from "zod";
import { createHash } from "node:crypto";
import { createExtractReadmeTool } from "../tools/extractReadme.js";
import { createSubmitVerificationTestTool } from "../tools/submitVerificationTest.js";
import { createVerifyBaselineTool } from "../tools/verifyBaseline.js";
import { createGenerateFirewallPolicyTool } from "../tools/generateFirewallPolicy.js";

/** Gemini 3 Flash (preview). Override with GEMINI_MODEL. */
const DEFAULT_MODEL = "gemini-3-flash-preview";

/** Lightweight model for sub-agents. Override with AI_SUBAGENT_MODEL. */
const DEFAULT_SUBAGENT_MODEL = "gemini-3.1-flash-lite-preview";

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
  const tools: Record<string, any> = {
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
      writeAllowed: args.name === "scout" ? () => false : args.executionAllowed,
      allowDestructiveOps: args.allowDestructiveOps,
    }),
  };

  if (args.name === "scout") {
    tools.extractReadme = createExtractReadmeTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
    });
    tools.verifyBaseline = createVerifyBaselineTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
    });
  }

  if (args.name === "fixer") {
    tools.submitVerificationTest = createSubmitVerificationTestTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
    });
    tools.generateFirewallPolicy = createGenerateFirewallPolicyTool({
      cwd: args.cwd,
      audit: appendAuditLog,
      agent: args.name,
    });
  }

  const agentName = args.name.toUpperCase();
  ui.startSpinner(`[${agentName}] Analyzing task...`);

  try {
    const result = await streamText({
      model: getModel({ subagent: true }),
      messages: [
        { role: "system", content: system },
        { role: "user", content: args.task },
      ],
      tools,
      maxSteps: 20,
      maxTokens: MAX_OUTPUT_TOKENS_SUBAGENT,
      temperature: 0.3,
    });

    let fullText = "";
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") fullText += chunk.textDelta;
      else if (chunk.type === "tool-call") ui.updateSpinner(`[${agentName}] Running tool: ${chalk.bold.yellow(chunk.toolName)}...`);
      else if (chunk.type === "tool-result") ui.updateSpinner(`[${agentName}] Tool ${chunk.toolName} complete. Thinking...`);
    }

    ui.stopSpinner(true, `[${agentName}] Task complete.`);
    const usage = await result.usage;
    const finishReason = await result.finishReason;

    appendAuditLog(args.cwd, {
      kind: "ai",
      agent: args.name,
      payload: { text: fullText, finishReason, usage },
    });

    return { text: `### [${agentName}] Task Report\n${fullText}`, usage };
  } catch (err) {
    ui.stopSpinner(false, `[${agentName}] Execution failed.`);
    throw err;
  }
}

export class AgentManager {
  private messages: CoreMessage[] = [{ role: "system", content: ORCHESTRATOR_SYSTEM }];
  private totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  constructor(private readonly cwd: string) {}
  public getMessages() { return this.messages; }
  public getUsage() { return this.totalUsage; }

  async run(userGoal: string): Promise<void> {
    this.messages.push({ role: "user", content: userGoal });
    const result = await runOrchestratorSession({ 
      cwd: this.cwd, 
      messages: this.messages,
      totalUsage: this.totalUsage 
    });
    if (result.usage) {
      this.totalUsage.promptTokens += result.usage.promptTokens;
      this.totalUsage.completionTokens += result.usage.completionTokens;
      this.totalUsage.totalTokens += result.usage.totalTokens;
    }
  }
}

export interface SessionResult { usage: { promptTokens: number; completionTokens: number; totalTokens: number }; }

export async function runOrchestratorSession(args: {
  cwd: string;
  messages: CoreMessage[];
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}): Promise<SessionResult> {
  const { cwd, messages, totalUsage } = args;
  const userGoal = (messages.filter(m => m.role === "user").pop()?.content as string) || "";

  const strictMode = process.env.SINTENEL_STRICT_MODE !== "false";
  const highAssuranceApproval = strictMode || process.env.SINTENEL_HIGH_ASSURANCE_APPROVAL === "true";
  const destructiveOpsEnabled = !strictMode && process.env.SINTENEL_ALLOW_DESTRUCTIVE_OPS === "true";

  appendAuditLog(cwd, {
    kind: "system",
    payload: { event: "session_start", goal: userGoal, strictMode, highAssuranceApproval, destructiveOpsEnabled },
  });

  let planApproved = false;
  let approvedCommands = new Set<string>();
  const maxExecutionsPerCommand = Number(process.env.SINTENEL_MAX_EXECUTIONS_PER_COMMAND ?? "3");
  const commandExecutionCount = new Map<string, number>();
  const maxSessionTurns = Number(process.env.SINTENEL_MAX_SESSION_TURNS ?? "18");

  const executionAllowed = () => planApproved;
  const isCommandApproved = (command: string) => approvedCommands.has(normalizeCommand(command));
  const canExecuteCommandNow = (command: string) => (commandExecutionCount.get(normalizeCommand(command)) ?? 0) < maxExecutionsPerCommand;
  const onCommandExecuted = (command: string) => {
    const key = normalizeCommand(command);
    commandExecutionCount.set(key, (commandExecutionCount.get(key) ?? 0) + 1);
  };
  const allowDestructiveOps = () => destructiveOpsEnabled;

  const delegateSchema = z.object({ task: z.string().min(1).describe("Task for sub-agent") });

  const tools = {
    submitExecutionPlan: createSubmitExecutionPlanTool({ cwd, audit: appendAuditLog, agent: "orchestrator" }),
    executePowerShell: createExecutePowerShellTool({ cwd, audit: appendAuditLog, agent: "orchestrator", executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted }),
    fileOperator: createFileOperatorTool({ cwd, audit: appendAuditLog, agent: "orchestrator", writeAllowed: executionAllowed, allowDestructiveOps }),
    delegateToScout: tool({
      description: "Delegate recon to Scout.",
      parameters: delegateSchema,
      execute: async ({ task }) => {
        if (!executionAllowed()) return { ok: false as const, error: "Plan required." };
        const { text } = await runSubAgent({ name: "scout", task, cwd, executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted, allowDestructiveOps: () => false });
        return { ok: true as const, report: text };
      }
    }),
    delegateToFixer: tool({
      description: "Delegate patching to Fixer.",
      parameters: delegateSchema,
      execute: async ({ task }) => {
        if (!executionAllowed()) return { ok: false as const, error: "Plan required." };
        const { text } = await runSubAgent({ name: "fixer", task, cwd, executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted, allowDestructiveOps });
        return { ok: true as const, report: text };
      }
    }),
  };

  let turnCount = 0;
  for (;;) {
    turnCount++;
    if (turnCount > maxSessionTurns) return { usage: totalUsage };
    const messagesToSend = turnCount > 2 ? pruneMessages(messages, 15) : messages;
    ui.printAgentHeader('Orchestrator');
    const result = await streamText({ model: getModel(), messages: messagesToSend, tools, maxSteps: 25, maxTokens: MAX_OUTPUT_TOKENS, temperature: 0.4 });
    let turnResponseText = '';
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        turnResponseText += chunk.textDelta;
        ui.printStreamChunk(chunk.textDelta);
      }
    }
    const response = await result.response;
    for (const msg of response.messages) messages.push(msg);
    const usage = await result.usage;
    if (usage) {
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
    }
    const steps = await result.steps;
    const pendingPlan = !planApproved ? extractExecutionPlan({ steps }) : null;
    if (pendingPlan) {
      const rows: PlanRow[] = pendingPlan.commands.map(c => ({ kind: c.kind, purpose: c.purpose, command: c.command }));
      printPlanTable(pendingPlan, rows);
      const ok = await confirmYesNo("Execute plan? [Y/N]: ");
      if (!ok) return { usage: totalUsage };
      planApproved = true;
      approvedCommands = new Set(pendingPlan.commands.map(e => normalizeCommand(e.command)));
      messages.push({ role: "user", content: "Operator approved Y." });
      continue;
    }
    if (turnResponseText && (await result.finishReason) === "stop") break;
  }
  return { usage: totalUsage };
}
