import { AgentManager } from "./src/engine/agentManager.js";
import { resolve } from "node:path";

async function runTest() {
  const cwd = resolve(".");
  const manager = new AgentManager(cwd);

  console.log("--- TEST 1: Forensic Question (Investigation Mode) ---");
  const forensicGoal = "Forensic Question: What is the MD5 hash of knowledge_base/scoring_playbook.md?";
  try {
    // We expect the Orchestrator to plan an MD5 hashing tool call to the Scout.
    // NOTE: This will still call the LLM and the tools. 
    // We'll let it finish up to the planning phase.
    await manager.run(forensicGoal);
  } catch (err) {
    console.error(`Forensic test error: ${err}`);
  }

  console.log("\n--- TEST 2: Scoring Run (Nationals Mode) ---");
  const scoringGoal = "Execute the full CyberPatriot Scoring Optimization strategy. Search for WMI Event Consumers and SUID binaries.";
  try {
    // We expect the Orchestrator to plan a 'Deep Scan' using the expert playbooks.
    await manager.run(scoringGoal);
  } catch (err) {
    console.error(`Scoring test error: ${err}`);
  }
}

runTest();
