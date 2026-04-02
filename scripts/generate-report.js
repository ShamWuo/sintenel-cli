#!/usr/bin/env node

/**
 * Report Generator for Sintenel-CLI
 * 
 * Parses sentinel-audit.log to generate a comprehensive security and forensic report.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";

function generateReport(logPath, outputPath) {
  if (!existsSync(logPath)) {
    console.error(chalk.red(`Error: Audit log not found at ${logPath}`));
    process.exit(1);
  }

  const raw = readFileSync(logPath, "utf8");
  const lines = raw.trim().split("\n");
  
  const findings = [];
  const remediations = [];
  const forensics = [];
  const stateChanges = [];
  const systemEvents = [];
  let currentGoal = "";
  let startTime = "";
  let endTime = "";

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (!startTime) startTime = entry.ts;
      endTime = entry.ts;

      if (entry.kind === "system" && entry.payload?.event === "session_start") {
        currentGoal = entry.payload.goal;
      }

      if (entry.kind === "ai") {
        const text = entry.payload.text || "";
        // Extract findings and remediations from AI reports
        if (entry.agent === "scout") {
          const findingMatches = text.match(/### Finding: (.*)/g);
          if (findingMatches) {
            findings.push(...findingMatches.map(m => m.replace("### Finding: ", "")));
          }
        }
        if (entry.agent === "fixer") {
          const fixMatches = text.match(/### Fixed: (.*)/g);
          if (fixMatches) {
            remediations.push(...fixMatches.map(m => m.replace("### Fixed: ", "")));
          }
        }
      }

      if (entry.kind === "tool" && entry.payload?.tool === "diffAuditState") {
        // Find the result of this tool call in subsequent messages if needed, 
        // but often the tool execution returns the data we want to log.
        // For simplicity, we'll look for entries where the agent reported the diff.
      }

      if (entry.kind === "ai" && entry.agent === "orchestrator") {
        const text = entry.payload.text || "";
        if (text.includes("Audit state comparison complete")) {
          stateChanges.push(text);
        }
      }
        if (entry.payload?.stdout?.includes("MD5") || entry.payload?.stdout?.includes("SHA256")) {
          forensics.push({
            ts: entry.ts,
            command: entry.payload.command,
            output: entry.payload.stdoutSnippet || entry.payload.stdout
          });
        }
      }
    } catch (err) {
      // skip
    }
  }

  const report = `
# Sintenel-CLI Security & Forensic Report
**Generated on:** ${new Date().toLocaleString()}
**Session Goal:** ${currentGoal || "Unknown"}
**Duration:** ${startTime} to ${endTime}

---

## 🛡️ Security Findings
${findings.length > 0 ? findings.map(f => `- ${f}`).join("\n") : "_No specific findings categorized by agent._"}

## 🛠️ Remediations Applied
${remediations.length > 0 ? remediations.map(r => `- ${r}`).join("\n") : "_No specific remediations categorized by agent._"}

## 🔄 System State Changes (Initial vs Current)
${stateChanges.length > 0 ? stateChanges.join("\n\n") : "_No state comparison performed._"}

## 🕵️ Forensic Evidence
${forensics.length > 0 ? forensics.map(f => `### ${f.ts}\n**Command:** \`${f.command}\`\n**Output:**\n\`\`\`\n${f.output}\n\`\`\``).join("\n\n") : "_No forensic evidence gathered._"}

---
*Report generated automatically by Sintenel-CLI*
`;

  writeFileSync(outputPath, report, "utf8");
  console.log(chalk.green(`Report successfully generated at ${outputPath}`));
}

const logPath = process.argv[2] || "sentinel-audit.log";
const outputPath = process.argv[3] || "sentinel-report.md";

generateReport(logPath, outputPath);
