import "dotenv/config";
import { Command } from "commander";
import { basename, dirname, join, resolve } from "node:path";
import { AgentManager } from "./engine/agentManager.js";
import { getApiKey, saveApiKey, deleteApiKey } from "./utils/secrets.js";

import {
  auditLogPathForCwd,
  exportAuditBundle,
  verifyAuditBundle,
  verifyAuditLog,
} from "./utils/audit.js";

import inquirer from "inquirer";
import chalk from "chalk";
import { confirmYesNo } from "./utils/confirm.js";
import { ui } from "./utils/ui.js";

const program = new Command();

async function startInteractiveREPL(cwd: string) {
  let manager = new AgentManager(cwd);
  
  ui.printHeader("SINTENEL INTERACTIVE MODE");
  console.log(chalk.dim("Type your security goals or use /help for commands. Type 'exit' to quit.\n"));

  const askGoal = async () => {
    let combinedGoal = "";
    for (;;) {
      const { goal } = await inquirer.prompt([
        {
          type: "input",
          name: "goal",
          message: combinedGoal ? chalk.dim("...") : chalk.blue.bold("sintenel"),
          prefix: combinedGoal ? " " : chalk.cyan("◈"),
          transformer: (input: string) => chalk.white(input),
        },
      ]);
      const trimmed = (goal as string).trim();
      if (trimmed.endsWith("\\")) {
        // Line continuation mode
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
    if (lowerGoal === "exit" || lowerGoal === "quit") {
      break;
    }

    if (lowerGoal === "/help" || lowerGoal === "help") {
      ui.printSection("Available Commands");
      console.log(chalk.cyan("  /clear") + "   - Clear terminal screen");
      console.log(chalk.cyan("  /reset") + "   - Reset conversation context (start fresh)");
      console.log(chalk.cyan("  /history") + " - View conversation history");
      console.log(chalk.cyan("  /usage") + "   - View session token usage");
      console.log(chalk.cyan("  /score") + "   - Maximize CyberPatriot points (Score Run)");
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
      ui.printSuccess("Conversation context reset. Starting fresh.");
      continue;
    }

    if (lowerGoal === "/history") {
      ui.printSection("Conversation History");
      const msgs = manager.getMessages();
      if (msgs.length <= 1) {
        console.log(chalk.dim("No history yet."));
      } else {
        for (const m of msgs) {
          if (m.role === "system") continue;
          const label = m.role === "user" ? chalk.blue("USER") : chalk.magenta("AGENT");
          console.log(`${label}: ${typeof m.content === "string" ? m.content.slice(0, 100) + (m.content.length > 100 ? "..." : "") : "[Complex object]"}`);
        }
      }
      continue;
    }

    if (lowerGoal === "/usage") {
      ui.printUsageStats(manager.getUsage());
      continue;
    }

    if (lowerGoal === "/score") {
      ui.printSection("INITIATING CYBERPATRIOT SCORING RUN");
      const scoringGoal = "Execute the full CyberPatriot Scoring Optimization strategy. Systematically audit user accounts, password policies, firewall state, and suspicious services based on the knowledge_base/scoring_playbook.md. Your mission is to gain as many points as possible through stable hardening and investigation.";
      try {
        await manager.run(scoringGoal);
      } catch (err) {
        ui.printError(`Scoring run error: ${err}`);
      }
      continue;
    }

    try {
      await manager.run(goal);
    } catch (err) {
      ui.printError(`Execution error: ${err}`);
      if (process.env.DEBUG === "true") console.error(err);
    }
  }
  
  console.log(chalk.blue.bold("\nGoodbye, Agent."));
}

program
  .name("sintenel")
  .description(
    "Sintenel-CLI — Multi-agent orchestrator (Orchestrator, Scout, Fixer) for security exercises"
  )
  .version("0.1.0")
  .argument("[goal...]", "High-level goal for the orchestrator (leave empty for interactive mode)")
  .option("-d, --cwd <dir>", "Working directory (default: process.cwd())")
  .action(async (goalParts: string[], opts: { cwd?: string }) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    const userGoal = goalParts.join(" ").trim();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
      const storedKey = await getApiKey();
      if (storedKey) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = storedKey;
      } else {
        ui.printError("Missing GOOGLE_GENERATIVE_AI_API_KEY.");
        console.log(chalk.dim("Please set it in your .env file or run " + chalk.yellow("sintenel setup") + " to store it securely."));
        process.exit(1);
      }
    }

    if (!userGoal) {
      await startInteractiveREPL(cwd);
      return;
    }

    await new AgentManager(cwd).run(userGoal);
  });

program
  .command("verify-audit")
  .description("Verify tamper-evident audit log chain")
  .option("-d, --cwd <dir>", "Working directory (used to locate sentinel-audit.log)")
  .option("-f, --file <path>", "Explicit audit log path")
  .option("--hmac-key <key>", "HMAC key for signed audit verification")
  .action((opts: { cwd?: string; file?: string; hmacKey?: string }) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    const logPath = opts.file ? resolve(opts.file) : auditLogPathForCwd(cwd);
    const key = opts.hmacKey ?? process.env.SINTENEL_AUDIT_HMAC_KEY;
    const result = verifyAuditLog(logPath, key);

    if (result.ok) {
      ui.printSuccess(`Audit verification: OK (${result.totalEntries} entries)`);
      if (result.terminalHash) {
        console.log(chalk.dim(`Terminal hash: ${result.terminalHash}`));
      }
      return;
    }

    ui.printError(`Audit verification: FAILED (${result.totalEntries} entries)`);
    for (const err of result.errors) {
      console.error(chalk.red(`- ${err}`));
    }
    process.exitCode = 2;
    return;
  });

program
  .command("export-audit-bundle")
  .description("Export signed audit bundle for offline verification")
  .option("-d, --cwd <dir>", "Working directory (used to locate sentinel-audit.log)")
  .option("-f, --file <path>", "Explicit audit log path")
  .option("-o, --out <path>", "Bundle output path (.audit-bundle.json)")
  .option("--hmac-key <key>", "HMAC key for bundle signature")
  .action((opts: { cwd?: string; file?: string; out?: string; hmacKey?: string }) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    const auditPath = opts.file ? resolve(opts.file) : auditLogPathForCwd(cwd);
    const out =
      opts.out ??
      join(dirname(auditPath), `${basename(auditPath, ".log")}.audit-bundle.json`);
    const key = opts.hmacKey ?? process.env.SINTENEL_AUDIT_HMAC_KEY;
    const result = exportAuditBundle(auditPath, resolve(out), key);
    if (!result.ok) {
      ui.printError(`Export failed: ${result.error}`);
      process.exit(2);
    }
    ui.printSuccess(`Bundle exported: ${resolve(out)}`);
    console.log(chalk.dim(`Terminal hash: ${result.bundle.terminalHash ?? "(none)"}`));
  });

program
  .command("verify-audit-bundle")
  .description("Verify signed audit bundle integrity")
  .argument("<bundlePath>", "Path to .audit-bundle.json")
  .option("--hmac-key <key>", "HMAC key for signature verification")
  .action((bundlePath: string, opts: { hmacKey?: string }) => {
    const key = opts.hmacKey ?? process.env.SINTENEL_AUDIT_HMAC_KEY;
    const result = verifyAuditBundle(resolve(bundlePath), key);
    if (!result.ok) {
      ui.printError(`Bundle verification failed: ${result.error}`);
      process.exitCode = 2;
      return;
    }
    ui.printSuccess("Bundle verification: OK");
    console.log(chalk.dim(`Audit path: ${result.bundle.auditLogPath}`));
    console.log(chalk.dim(`Terminal hash: ${result.bundle.terminalHash ?? "(none)"}`));
  });

program
  .command("setup")
  .description("Securely save your Google AI API key to the OS credential manager")
  .action(async () => {
    ui.printHeader("SINTENEL SETUP");
    const { key } = await inquirer.prompt([
      {
        type: "password",
        name: "key",
        message: "Enter your Google AI API Key:",
        mask: "*"
      }
    ]);

    if (!key?.trim()) {
      ui.printError("Key cannot be empty.");
      process.exit(1);
    }

    try {
      await saveApiKey(key.trim());
      ui.printSuccess("API key securely stored in your OS credential manager.");
      console.log(chalk.dim("You can now safely delete the key from your .env file."));
    } catch (err) {
      ui.printError(`Failed to save key: ${err}`);
      process.exit(1);
    }
  });

program
  .command("logout")
  .description("Remove your securely stored API key")
  .action(async () => {
    if (await confirmYesNo("Are you sure you want to remove the stored API key?")) {
      await deleteApiKey();
      ui.printSuccess("API key removed from OS credential manager.");
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});

