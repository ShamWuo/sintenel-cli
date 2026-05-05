import "dotenv/config";
import { Command } from "commander";
import { resolve } from "node:path";
import { AgentManager } from "./engine/agentManager.js";
import { getApiKey, saveApiKey } from "./utils/secrets.js";
import inquirer from "inquirer";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { ui } from "./utils/ui.js";
import { selfHealSystem } from "./utils/self-heal.js";

const program = new Command();

async function startInteractiveREPL(cwd: string) {
  let manager = new AgentManager(cwd);
  ui.printHeader("SINTENEL INTERACTIVE MODE");
  console.log(chalk.dim("Type your security goals or use /help for commands. Type 'exit' to quit.\n"));

  const checkAuth = async () => {
    const providers: ("gemini" | "openai" | "anthropic")[] = ["gemini", "openai", "anthropic"];
    let anyKey = false;

    for (const p of providers) {
      const envKey = p === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${p.toUpperCase()}_API_KEY`;
      if (!process.env[envKey]?.trim()) {
        const stored = await getApiKey(p);
        if (stored) {
          process.env[envKey] = stored;
          anyKey = true;
        }
      } else {
        anyKey = true;
      }
    }

    if (!anyKey) {
      ui.printWarning("No API Keys found. Type '/auth' to configure a provider.");
    }
  };

  await checkAuth();

  const askGoal = async () => {
    let combinedGoal = "";
    for (;;) {
      const { goal } = await inquirer.prompt([{
        type: "input",
        name: "goal",
        message: combinedGoal ? chalk.dim("...") : chalk.blue.bold("sintenel"),
        prefix: combinedGoal ? " " : chalk.cyan(">"),
        transformer: (input: string) => chalk.white(input),
      }]);
      const trimmed = (goal as string).trim();
      if (trimmed.endsWith("\\")) {
        combinedGoal += trimmed.slice(0, -1) + "\n";
        continue;
      }
      combinedGoal += trimmed;
      break;
    }
    return combinedGoal.trim();
  };

  for (;;) {
    const goal = await askGoal();
    if (!goal) continue;
    const lowerGoal = goal.toLowerCase();
    if (lowerGoal === "exit" || lowerGoal === "quit") break;

    if (lowerGoal === "/help" || lowerGoal === "help") {
      ui.printSection("Available Commands");
      console.log(chalk.cyan("  /clear") + "   - Clear terminal screen");
      console.log(chalk.cyan("  /reset") + "   - Reset conversation context");
      console.log(chalk.cyan("  /auth") + "    - Setup API Key interactively");
      console.log(chalk.cyan("  /usage") + "   - Token usage");
      console.log(chalk.cyan("  /model") + "   - Current active models");
      console.log(chalk.cyan("  exit") + "      - End session\n");
      continue;
    }

    if (lowerGoal === "/auth" || lowerGoal === "auth") {
      const modelId = process.env.GEMINI_MODEL || "gemini-1.5-flash";
      let provider: "gemini" | "openai" | "anthropic" = "gemini";
      
      if (modelId.startsWith("gpt") || modelId.startsWith("o1")) provider = "openai";
      else if (modelId.startsWith("claude")) provider = "anthropic";

      ui.printInfo(`Configuring credentials for active provider: ${chalk.bold.cyan(provider.toUpperCase())}`);
      
      const { key } = await inquirer.prompt([{
        type: "password",
        name: "key",
        message: `Paste your ${provider} API Key:`,
        mask: "*",
        validate: (input: string) => input.length > 5 || "Invalid key length."
      }]);

      await saveApiKey(provider, key);
      ui.printSuccess(`${provider} API Key saved securely.`);
      await checkAuth();
      continue;
    }

    if (lowerGoal === "/clear") {
      process.stdout.write("\x1Bc");
      ui.printHeader("SINTENEL INTERACTIVE MODE");
      continue;
    }
    if (lowerGoal === "/reset") {
      manager = new AgentManager(cwd);
      ui.printSuccess("Context reset.");
      continue;
    }

    if (lowerGoal === "/usage") {
      ui.printUsageStats(manager.getUsage());
      continue;
    }

    if (lowerGoal === "/model") {
      try {
        const provider = await select({
          message: "Select AI Provider (Use Arrow Keys):",
          choices: [
            { name: chalk.blue("Google Gemini"), value: "gemini" },
            { name: chalk.green("OpenAI"), value: "openai" },
            { name: chalk.magenta("Anthropic (Claude)"), value: "anthropic" },
            { name: "Cancel", value: "cancel" }
          ]
        });

        if (provider === "cancel") continue;

        const modelChoices = {
          gemini: [
            { name: "Gemini 3.1 Pro (Advanced Reasoning & Coding)", value: "gemini-3.1-pro-preview" },
            { name: "Gemini 3 Flash (High Performance)", value: "gemini-3-flash-preview" },
            { name: "Gemini 3.1 Flash-Lite (Fast & Cost-Efficient)", value: "gemini-3.1-flash-lite-preview" },
            { name: "Gemini 2.5 Pro (Deep Reasoning)", value: "gemini-2.5-pro" },
            { name: "Gemini 2.5 Flash (Price-Performance Balance)", value: "gemini-2.5-flash" },
            { name: "Gemini 2.5 Flash-Lite (Fastest 2.5 Model)", value: "gemini-2.5-flash-lite" }
          ],
          openai: [
            { name: "GPT-4o (Frontier Model)", value: "gpt-4o" },
            { name: "GPT-4o Mini (Efficient & Fast)", value: "gpt-4o-mini" },
            { name: "o1-preview (Advanced Reasoning)", value: "o1-preview" },
            { name: "o1-mini (Reasoning Mini)", value: "o1-mini" }
          ],
          anthropic: [
            { name: "Claude 3.5 Sonnet (Best Balance)", value: "claude-3-5-sonnet-latest" },
            { name: "Claude 3.5 Haiku (Extremely Fast)", value: "claude-3-5-haiku-latest" },
            { name: "Claude 3 Opus (Maximum Intelligence)", value: "claude-3-opus-latest" }
          ]
        };

        const model = await select({
          message: `Select ${provider.toUpperCase()} model:`,
          choices: [
            ...(modelChoices[provider as keyof typeof modelChoices]),
            { name: "Back", value: "back" }
          ]
        });

        if (model === "back") {
          // Re-trigger the /model logic
          process.nextTick(() => { /* handled by loop */ });
          continue; 
        }

        process.env.GEMINI_MODEL = model;
        ui.printSuccess(`Model switched to: ${chalk.bold.cyan(model)}`);
        await checkAuth();
      } catch (e) {
        // Handle SIGINT/Cancel
      }
      continue;
    }

    try {
      await manager.run(goal);
    } catch (err) {
      ui.printError(`Execution error: ${err}`);
    }
  }
}

async function runSetupWizard() {
  ui.printSection("Sintenel API Setup");
  const { provider } = await inquirer.prompt([{
    type: "list",
    name: "provider",
    message: "Which AI provider do you want to configure?",
    choices: [
      { name: "Google Gemini", value: "gemini" },
      { name: "OpenAI (GPT-4o, etc.)", value: "openai" },
      { name: "Anthropic (Claude 3.5, etc.)", value: "anthropic" },
      { name: "Back", value: "back" }
    ]
  }]);

  if (provider === "back") return;

  const { key } = await inquirer.prompt([{
    type: "password",
    name: "key",
    message: `Paste your ${provider} API Key:`,
    mask: "*",
    validate: (input: string) => input.length > 5 || "Invalid key length."
  }]);

  await saveApiKey(provider, key);
  ui.printSuccess(`${provider} API Key saved securely.`);
}

program
  .name("sintenel")
  .description("AI-powered security orchestrator")
  .version("0.1.0");

program
  .command("setup")
  .description("Configure API keys interactively")
  .action(async () => {
    await runSetupWizard();
  });

program
  .argument("[goal...]", "High-level goal")
  .option("-d, --cwd <dir>", "Working directory")
  .action(async (goalParts: string[], opts: { cwd?: string }) => {
    await selfHealSystem();
    const cwd = resolve(opts.cwd ?? process.cwd());
    const userGoal = goalParts.join(" ").trim();

    // Load keys early
    const providers: ("gemini" | "openai" | "anthropic")[] = ["gemini", "openai", "anthropic"];
    for (const p of providers) {
      const envKey = p === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${p.toUpperCase()}_API_KEY`;
      if (!process.env[envKey]) {
        const stored = await getApiKey(p);
        if (stored) process.env[envKey] = stored;
      }
    }

    if (!userGoal) {
      await startInteractiveREPL(cwd);
      return;
    }

    const hasAnyKey = providers.some(p => {
      const envKey = p === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${p.toUpperCase()}_API_KEY`;
      return !!process.env[envKey];
    });

    if (!hasAnyKey) {
      ui.printWarning("\n[API] No API Keys found. Let's set up Sintenel now!");
      await runSetupWizard();
      // Re-check after setup
      for (const p of providers) {
        const envKey = p === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${p.toUpperCase()}_API_KEY`;
        const stored = await getApiKey(p);
        if (stored) process.env[envKey] = stored;
      }
      
      const stillNoKey = !providers.some(p => {
        const envKey = p === "gemini" ? "GOOGLE_GENERATIVE_AI_API_KEY" : `${p.toUpperCase()}_API_KEY`;
        return !!process.env[envKey];
      });

      if (stillNoKey) {
        ui.printError("No provider configured. Please provide an API key to continue.");
        process.exit(1);
      }
    }

    try {
      const manager = new AgentManager(cwd);
      await manager.run(userGoal);
    } catch (err) {
      ui.printError(`Execution error: ${err}`);
    }
  });

program.parseAsync(process.argv).catch((err: any) => {
  ui.printError(`Fatal error: ${err}`);
  process.exit(1);
});
