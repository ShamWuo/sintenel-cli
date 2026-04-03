import { generateText, streamText, tool, type CoreMessage } from "ai";
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
import { createDiffAuditStateTool } from "../tools/diffAuditState.js";

const DEFAULT_MODEL = "gemini-3.1-flash-lite-preview"; 
const DEFAULT_SUBAGENT_MODEL = "gemini-3.1-flash-lite-preview"; 
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
  for (const r of rows) table.push([r.kind, r.purpose, r.command]);
  ui.printTable(table);
  
  if (plan.context.risks.length > 0) {
    ui.printSection('Risks');
    for (const risk of plan.context.risks) ui.printWarning(risk);
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
    tools.extractReadme = createExtractReadmeTool({ cwd: args.cwd, audit: appendAuditLog, agent: args.name });
    tools.verifyBaseline = createVerifyBaselineTool({ cwd: args.cwd, audit: appendAuditLog, agent: args.name });
  }

  if (args.name === "fixer") {
    tools.submitVerificationTest = createSubmitVerificationTestTool({ cwd: args.cwd, audit: appendAuditLog, agent: args.name });
    tools.generateFirewallPolicy = createGenerateFirewallPolicyTool({ cwd: args.cwd, audit: appendAuditLog, agent: args.name });
  }

  const agentName = args.name.toUpperCase();
  ui.startSpinner(`[${agentName}] Analyzing task...`);

  try {
    const result = await streamText({
      model: getModel({ subagent: true }),
      messages: [{ role: "system", content: system }, { role: "user", content: args.task }],
      tools,
      maxSteps: 20,
      maxTokens: MAX_OUTPUT_TOKENS_SUBAGENT,
      temperature: 0.3,
    });

    let fullText = "";
    for await (const chunk of result.fullStream) {
      if (chunk.type === "text-delta") fullText += chunk.textDelta;
      else if (chunk.type === "tool-call") ui.updateSpinner(`[${agentName}] Running tool: ${chalk.bold.yellow(chunk.toolName)}...`);
    }

    ui.stopSpinner(true, `[${agentName}] Task complete.`);
    const usage = await result.usage;
    appendAuditLog(args.cwd, { kind: "ai", agent: args.name, payload: { text: fullText, usage } });
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
    const result = await runOrchestratorSession({ cwd: this.cwd, messages: this.messages, totalUsage: this.totalUsage });
    if (result.usage) {
      this.totalUsage.promptTokens += result.usage.promptTokens;
      this.totalUsage.completionTokens += result.usage.completionTokens;
      this.totalUsage.totalTokens += result.usage.totalTokens;
    }
  }
}

export async function runOrchestratorSession(args: {
  cwd: string;
  messages: CoreMessage[];
  totalUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}): Promise<{ usage: any }> {
  console.log("◈ [DEBUG] Internal: Orchestration session logic entered.");
  const { cwd, messages, totalUsage } = args;
  const maxSessionTurns = Number(process.env.SINTENEL_MAX_SESSION_TURNS || "18");

  let planApproved = false;
  let approvedCommands = new Set<string>();
  let planRequestAttempts = 0;
  const commandExecutionCount = new Map<string, number>();

  const executionAllowed = () => planApproved;
  const isCommandApproved = (cmd: string) => approvedCommands.has(normalizeCommand(cmd));
  const canExecuteCommandNow = (cmd: string) => (commandExecutionCount.get(normalizeCommand(cmd)) || 0) < 3;
  const onCommandExecuted = (cmd: string) => {
    const key = normalizeCommand(cmd);
    commandExecutionCount.set(key, (commandExecutionCount.get(key) || 0) + 1);
  };

  const tools = {
    submitExecutionPlan: createSubmitExecutionPlanTool({ cwd, audit: appendAuditLog, agent: "orchestrator" }),
    executePowerShell: createExecutePowerShellTool({ cwd, audit: appendAuditLog, agent: "orchestrator", executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted }),
    fileOperator: createFileOperatorTool({ cwd, audit: appendAuditLog, agent: "orchestrator", writeAllowed: executionAllowed, allowDestructiveOps: () => false }),
    diffAuditState: createDiffAuditStateTool({ cwd, audit: appendAuditLog, agent: "orchestrator" }),
    delegateToScout: tool({
      description: "Delegate recon to Scout.",
      parameters: z.object({ task: z.string() }),
      execute: async ({ task }) => {
        if (!planApproved) return { ok: false as const, error: "Plan required." };
        return { ok: true as const, report: (await runSubAgent({ name: "scout", task, cwd, executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted, allowDestructiveOps: () => false })).text };
      }
    }),
    delegateToFixer: tool({
      description: "Delegate patching to Fixer.",
      parameters: z.object({ task: z.string() }),
      execute: async ({ task }) => {
        if (!planApproved) return { ok: false as const, error: "Plan required." };
        return { ok: true as const, report: (await runSubAgent({ name: "fixer", task, cwd, executionAllowed, isCommandApproved, canExecuteCommandNow, onCommandExecuted, allowDestructiveOps: () => true })).text };
      }
    }),
  };

  for (let turn = 1; turn <= maxSessionTurns; turn++) {
    try {
      ui.startSpinner('Connecting to Gemini...');
      const result = await generateText({ 
        model: getModel(), 
        messages: turn > 1 ? pruneMessages(messages, 15) : messages, 
        tools, 
        maxSteps: 1 
      });

      ui.clearSpinner();
      const response = result.response;
      for (const msg of response.messages) messages.push(msg);
      
      const turnText = result.text || "";
      if (turnText) {
        ui.printAgentHeader('Orchestrator');
        ui.printStreamChunk(turnText + "\n");
      }

      const steps = result.steps;
      const usage = result.usage;
      if (usage) { 
        totalUsage.promptTokens += usage.promptTokens; 
        totalUsage.completionTokens += usage.completionTokens; 
        totalUsage.totalTokens += usage.totalTokens; 
      }

      const plan = !planApproved ? extractExecutionPlan({ steps }) : null;

      if (plan) {
        planRequestAttempts = 0;
        printPlanTable(plan, plan.commands.map(c => ({ kind: c.kind, purpose: c.purpose, command: c.command })));
        if (await confirmYesNo("Execute plan? [Y/N]: ")) {
          planApproved = true;
          approvedCommands = new Set(plan.commands.map(c => normalizeCommand(c.command)));
          messages.push({ role: "user", content: "Operator approved Y." });
          continue;
        } else {
          return { usage: totalUsage };
        }
      }

      // Detect stall: No tools, no plan, no progress.
      const hasTools = steps.flatMap(s => s.toolCalls).length > 0;
      if (!planApproved && !hasTools && !plan && !turnText.trim()) {
        ui.printWarning("Model returned an empty response. Aborting session to prevent loop.");
        return { usage: totalUsage };
      }

      if (!planApproved && turnText) {
        if (steps.flatMap(s => s.toolCalls).some(tc => tc.toolName !== "submitExecutionPlan")) {
          messages.push({ role: "user", content: "MANDATORY: Call submitExecutionPlan first before any other tools." });
          continue;
        }
        planRequestAttempts++;
        if (planRequestAttempts >= 3) {
          ui.printError("Unable to get a valid execution plan. Aborting.");
          return { usage: totalUsage };
        }
        messages.push({ role: "user", content: "Before proceeding, you MUST call 'submitExecutionPlan' with a detailed Phase-based plan." });
        continue;
      }

      const finishReason = result.finishReason;
      if (finishReason === "stop" || finishReason === "length") {
        if (!hasTools && !plan && !turnText.trim()) {
          return { usage: totalUsage };
        }
      }
    } catch (err) {
      ui.printError(`Session error: ${err}`);
      break;
    }
  }
  return { usage: totalUsage };
}
