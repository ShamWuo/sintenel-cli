import "dotenv/config";
import { Command } from "commander";
import { resolve } from "node:path";
import { AgentManager } from "./engine/agentManager.js";
import { getApiKey, saveApiKey } from "./utils/secrets.js";
import inquirer from "inquirer";
import chalk from "chalk";
import { ui } from "./utils/ui.js";
import { selfHealSystem } from "./utils/self-heal.js";

const program = new Command();

async function startInteractiveREPL(cwd: string) {
  let manager = new AgentManager(cwd);
  ui.printHeader("SINTENEL INTERACTIVE MODE");
  console.log(chalk.dim("Type your security goals or use /help for commands. Type 'exit' to quit.\n"));

  const askGoal = async () => {
    let combinedGoal = "";
    for (;;) {
      const { goal } = await inquirer.prompt([{
        type: "input",
        name: "goal",
        message: combinedGoal ? chalk.dim("...") : chalk.blue.bold("sintenel"),
        prefix: combinedGoal ? " " : chalk.cyan("◈"),
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
      console.log(chalk.cyan("  /usage") + "   - Token usage");
      console.log(chalk.cyan("  exit") + "      - End session\n");
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

    try {
      await manager.run(goal);
    } catch (err) {
      ui.printError(`Execution error: ${err}`);
    }
  }
}

program
  .name("sintenel")
  .description("AI-powered security orchestrator")
  .version("0.1.0")
  .argument("[goal...]", "High-level goal")
  .option("-d, --cwd <dir>", "Working directory")
  .action(async (goalParts: string[], opts: { cwd?: string }) => {
    await selfHealSystem();
    const cwd = resolve(opts.cwd ?? process.cwd());
    const userGoal = goalParts.join(" ").trim();

    // Debugging hint if the tool finishes too early
    if (userGoal) {
       ui.printInfo(`◈ [SESSION STARTING] Running goal: "${userGoal}"`);
    }

    // Key loading logic
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
      const storedKey = await getApiKey();
      if (storedKey) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = storedKey;
      } else {
        ui.printError("Missing API Key. Run 'node dist/sintenel.cjs setup' to save it.");
        process.exit(1);
      }
    }

    if (!userGoal) {
      await startInteractiveREPL(cwd);
      return;
    }

    try {
      const manager = new AgentManager(cwd);
      await manager.run(userGoal);
      ui.printSuccess("◈ [SESSION COMPLETE]");
    } catch (err) {
      ui.printError(`◈ [FAIL] ${err}`);
      process.exit(1);
    }
  });

program
  .command("setup")
  .description("Save API key")
  .action(async () => {
    ui.printHeader("SINTENEL SETUP");
    const { key } = await inquirer.prompt([{
      type: "password",
      name: "key",
      message: "Enter API Key:",
      mask: "*"
    }]);
    await saveApiKey(key.trim());
    ui.printSuccess("API key stored.");
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red("◈ [FATAL ERROR]"), err);
  process.exit(1);
});
