#!/usr/bin/env node

/**
 * Cost Analysis Utility for Sintenel-CLI
 * 
 * Analyzes sentinel-audit.log to calculate actual AI costs and provide insights.
 * 
 * Usage:
 *   node scripts/analyze-costs.js [path-to-audit-log]
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Pricing per 1M tokens (adjust based on current provider pricing)
const PRICING = {
  // Gemini pricing (2026)
  "gemini-3-flash-preview": { input: 0.075, output: 0.30 },
  "gemini-3.1-flash-lite-preview": { input: 0.0375, output: 0.15 },
  "gemini-2.0-flash-lite": { input: 0.015, output: 0.06 },
  
  // OpenAI pricing (example)
  "gpt-4o": { input: 2.50, output: 10.00 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  
  // Anthropic pricing (example)
  "claude-3-5-sonnet-20241022": { input: 3.00, output: 15.00 },
};

function analyzeAuditLog(logPath) {
  const content = readFileSync(logPath, "utf8");
  const lines = content.trim().split("\n");
  
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCost = 0;
  const agentStats = {};
  const modelUsage = {};
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      
      if (entry.kind === "ai" && entry.payload?.usage) {
        const usage = entry.payload.usage;
        const agent = entry.agent || "unknown";
        
        const promptTokens = usage.promptTokens || 0;
        const completionTokens = usage.completionTokens || 0;
        
        totalPromptTokens += promptTokens;
        totalCompletionTokens += completionTokens;
        
        if (!agentStats[agent]) {
          agentStats[agent] = { 
            promptTokens: 0, 
            completionTokens: 0, 
            calls: 0 
          };
        }
        
        agentStats[agent].promptTokens += promptTokens;
        agentStats[agent].completionTokens += completionTokens;
        agentStats[agent].calls++;
      }
    } catch (err) {
      // Skip malformed lines
    }
  }
  
  // Estimate cost (assume default models)
  const estimatedOrchestratorCost = 
    (agentStats.orchestrator?.promptTokens || 0) / 1_000_000 * (PRICING["gemini-3-flash-preview"]?.input || 0.075) +
    (agentStats.orchestrator?.completionTokens || 0) / 1_000_000 * (PRICING["gemini-3-flash-preview"]?.output || 0.30);
  
  const estimatedSubagentPromptTokens = 
    (agentStats.scout?.promptTokens || 0) + (agentStats.fixer?.promptTokens || 0);
  const estimatedSubagentCompletionTokens = 
    (agentStats.scout?.completionTokens || 0) + (agentStats.fixer?.completionTokens || 0);
  
  const estimatedSubagentCost = 
    estimatedSubagentPromptTokens / 1_000_000 * (PRICING["gemini-3.1-flash-lite-preview"]?.input || 0.0375) +
    estimatedSubagentCompletionTokens / 1_000_000 * (PRICING["gemini-3.1-flash-lite-preview"]?.output || 0.15);
  
  totalCost = estimatedOrchestratorCost + estimatedSubagentCost;
  
  console.log("\n=== Sintenel-CLI Cost Analysis ===\n");
  console.log(`Audit Log: ${logPath}\n`);
  
  console.log("Total Usage:");
  console.log(`  Prompt tokens:     ${totalPromptTokens.toLocaleString()}`);
  console.log(`  Completion tokens: ${totalCompletionTokens.toLocaleString()}`);
  console.log(`  Total tokens:      ${(totalPromptTokens + totalCompletionTokens).toLocaleString()}\n`);
  
  console.log("By Agent:");
  for (const [agent, stats] of Object.entries(agentStats)) {
    console.log(`  ${agent}:`);
    console.log(`    Calls:      ${stats.calls}`);
    console.log(`    Prompt:     ${stats.promptTokens.toLocaleString()} tokens`);
    console.log(`    Completion: ${stats.completionTokens.toLocaleString()} tokens`);
  }
  
  console.log(`\nEstimated Cost: $${totalCost.toFixed(4)}`);
  console.log(`  Orchestrator: $${estimatedOrchestratorCost.toFixed(4)}`);
  console.log(`  Sub-agents:   $${estimatedSubagentCost.toFixed(4)}`);
  
  console.log("\nCost per 1K tokens: $" + (totalCost / ((totalPromptTokens + totalCompletionTokens) / 1000)).toFixed(6));
  
  console.log("\n=== Cost Optimization Tips ===");
  
  const avgPromptPerCall = totalPromptTokens / Object.values(agentStats).reduce((sum, s) => sum + s.calls, 0);
  if (avgPromptPerCall > 3000) {
    console.log("  ⚠ High prompt token usage detected. Consider:");
    console.log("    - Using more specific/narrow goals");
    console.log("    - Batching similar tasks together");
  }
  
  const avgCompletionPerCall = totalCompletionTokens / Object.values(agentStats).reduce((sum, s) => sum + s.calls, 0);
  if (avgCompletionPerCall > 1500) {
    console.log("  ⚠ Verbose responses detected. Models may be generating unnecessary detail.");
  }
  
  if ((agentStats.scout?.calls || 0) + (agentStats.fixer?.calls || 0) < 2) {
    console.log("  ✓ Low sub-agent usage. Consider delegating more to Scout/Fixer for cost savings.");
  }
  
  console.log("\nFor more optimization strategies, see COST-OPTIMIZATION.md\n");
}

const logPath = process.argv[2] || resolve(process.cwd(), "sentinel-audit.log");

try {
  analyzeAuditLog(logPath);
} catch (err) {
  console.error(`Error analyzing audit log: ${err.message}`);
  console.error(`\nUsage: node scripts/analyze-costs.js [path-to-audit-log]`);
  process.exit(1);
}
