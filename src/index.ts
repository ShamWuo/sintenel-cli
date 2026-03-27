#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { basename, dirname, join, resolve } from "node:path";
import { AgentManager } from "./engine/agentManager.js";
import {
  auditLogPathForCwd,
  exportAuditBundle,
  verifyAuditBundle,
  verifyAuditLog,
} from "./utils/audit.js";

const program = new Command();

program
  .name("sintenel")
  .description(
    "Sintenel-CLI — Multi-agent orchestrator (Orchestrator, Scout, Fixer) for security exercises"
  )
  .version("0.1.0")
  .argument("[goal...]", "High-level goal for the orchestrator")
  .option("-d, --cwd <dir>", "Working directory (default: process.cwd())")
  .action(async (goalParts: string[], opts: { cwd?: string }) => {
    const cwd = resolve(opts.cwd ?? process.cwd());
    const userGoal = goalParts.join(" ").trim();
    if (!userGoal) {
      program.help();
      process.exit(1);
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
      console.error(
        "Missing GOOGLE_GENERATIVE_AI_API_KEY. Copy .env.example to .env and set it."
      );
      process.exit(1);
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
      console.log(`Audit verification: OK (${result.totalEntries} entries)`);
      if (result.terminalHash) {
        console.log(`Terminal hash: ${result.terminalHash}`);
      }
      return;
    }

    console.error(`Audit verification: FAILED (${result.totalEntries} entries)`);
    for (const err of result.errors) {
      console.error(`- ${err}`);
    }
    process.exit(2);
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
      console.error(`Export failed: ${result.error}`);
      process.exit(2);
    }
    console.log(`Bundle exported: ${resolve(out)}`);
    console.log(`Terminal hash: ${result.bundle.terminalHash ?? "(none)"}`);
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
      console.error(`Bundle verification failed: ${result.error}`);
      process.exit(2);
    }
    console.log("Bundle verification: OK");
    console.log(`Audit path: ${result.bundle.auditLogPath}`);
    console.log(`Terminal hash: ${result.bundle.terminalHash ?? "(none)"}`);
  });

await program.parseAsync(process.argv);
