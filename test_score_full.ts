import { AgentManager } from "./src/engine/agentManager.js";
import { resolve } from "node:path";

async function runScoreTest() {
  const cwd = resolve(".");
  const manager = new AgentManager(cwd);

  console.log("--- STARTING MASTER SCORING RUN (Supervised) ---");
  const scoringGoal = "Execute the full CyberPatriot Scoring Optimization strategy. Systematically audit all accounts, policies, and persistence. your goal is to find AND fix vulnerabilities recorded in the knowledge_base/scoring_playbook.md.";
  
  try {
    // This will run the orchestrator.
    // It should plan a BATCH of recon tasks first.
    await manager.run(scoringGoal);
  } catch (err) {
    console.error(`Scoring run error: ${err}`);
  }
}

runScoreTest();
