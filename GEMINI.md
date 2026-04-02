# GEMINI.md

## Project Overview
**Sintenel-CLI** is an AI-powered multi-agent security orchestrator designed for automated vulnerability scanning, forensic investigation, and remediation. It uses a tiered agent architecture with human-in-the-loop safety gates to ensure that security tasks are performed reliably and transparently.

### Key Technologies
- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (ES Modules)
- **AI Engine:** Vercel AI SDK with Google Gemini (3 Flash for orchestration, 3.1 Flash Lite for sub-agents)
- **Security:** Zod (validation), Hash-chained audit logs, Role-based agent permissions
- **Testing:** Vitest

## Architecture & Agents
Sintenel-CLI operates using a hierarchical delegation model:

1.  **Orchestrator (`src/agents/orchestrator.ts`):** The strategic planner. It analyzes goals, assesses risks, and generates an **Execution Plan**. It cannot modify files directly; it must delegate to specialized sub-agents.
2.  **Scout (`src/agents/scout.ts`):** A read-only reconnaissance specialist. It scans the file system and runs safe shell commands to identify issues.
3.  **Fixer (`src/agents/fixer.ts`):** The remediation specialist. It applies patches and verifies them with tests. It can only write to files after the Orchestrator's plan is approved by the user.

### Core Security Tools
- **`fileOperator`:** Safe file operations with path validation (prevents directory traversal) and automatic backups.
- **`executeShell` / `executePowerShell`:** Executes commands with timeout protection, output buffering, and policy enforcement (allow/deny lists).
- **`submitExecutionPlan`:** Mandatory tool call for the Orchestrator to present a summary, risks, and proposed commands for user approval.

## Operational Modes

### Standard Mode
Used for general security audits and fixes.
- **Workflow:** Analyze → Plan → Approve → Scout/Fix → Report.
- **Goal:** Identify and patch vulnerabilities (e.g., SQL Injection, Hardcoded Secrets).

### Forensic Investigation Mode
Activated when a goal starts with "Forensic Question" or asks for specific metadata.
- **Restrictions:** **STRICTLY PROHIBITED** from modifying the system. All `Fixer` tools and write operations are blocked.
- **Reporting Format:**
    - **Question:** Repetition of the prompt.
    - **Answer:** Specific value (Hash, Path, Username, etc.).
    - **Evidence:** Supporting logs, timestamps, or metadata.

## Development Workflows
### Deep Recon Strategy (Mandatory)
Agents MUST prioritize the pre-written security audit and forensic scripts for initial system assessment:
- **Phase 0 (Master Audit):** Run `scripts/security/audit_linux.sh` or `audit_windows.ps1`.
- **Phase 1 (Forensic Deep Dive):** For forensic goals, run `scripts/security/collect_forensics.sh` or `collect_forensics.ps1` BEFORE any modifications.
- **Goal:** Use these to build a comprehensive "Security Map" and solve forensic challenges early.

### Top-Tier Hardening Tools
- **README Extraction:** Use `extractReadme` to define the "Authorized State" (users, services, ports).
- **Baseline Verification:** Use `verifyBaseline` to find anomalies (unauthorized users/SUIDs) compared to clean OS manifests (`ubuntu_2204`, `windows_10`).
- **Firewall Whitelisting:** Use `generateFirewallPolicy` to create strict Netsh/UFW rules based on README authorized ports.

### Parallel Execution Strategy
...

Agents should leverage the system's ability to execute tool calls in parallel:
- **Multi-Terminal Recon:** Scout should run multiple independent `executeShell` calls in a single turn to gather data faster.
- **Batch Remediation:** Fixer should apply independent patches and their verification checks simultaneously.
- **Background Simulation:** Treat multiple parallel tool calls as independent background processes that return data collectively.

### Standard Command Library (Mandatory)
Agents MUST use the commands defined in `knowledge_base/command_library.md` for all system interactions. 
- **Standard-First:** Prioritize built-in, platform-native tools (e.g., `net user`, `ufw`, `systemctl`) over custom or "advanced" AI-invented scripts.
- **Surgical Actions:** Use the specific "Surgical Fix" commands to ensure system stability and point preservation.
- **Recon-led Fixes:** Always perform a Recon command to verify state before applying a Fix.

### Environment Setup
Create a `.env` file with:
```env
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3-flash-preview
AI_SUBAGENT_MODEL=gemini-3.1-flash-lite-preview
```

### Key Commands
- `npm install`: Install dependencies.
- `npm run build`: Compile TypeScript.
- `npm run dev -- "goal"`: Run in development mode.
- `npm test`: Run the test suite (45+ tests).
- `npm run test:coverage`: Generate coverage reports.
- `npm run benchmark`: Performance tests.
- `npm run analyze-costs`: Cost analysis script.

### Development Conventions
- **Surgical Changes:** Use `patch` in `fileOperator` for minimal, targeted code changes.
- **Audit Trails:** All actions are logged to `sentinel-audit.log`. Use `appendAuditLog` for any new tool or system event.
- **Safety Gates:** Never disable `resolveUnderRoot` or `evaluateCommandPolicy` without explicit architectural review.
- **Testing:** New features or fixes MUST include corresponding tests in `src/**/*.test.ts`.

## Security Boundaries
- **Path Security:** All file paths must be resolved using `resolveUnderRoot()` to ensure they stay within the workspace.
- **Policy Enforcement:** Shell commands are checked against a policy before execution.
- **Human Approval:** No "change" kind commands can be executed without explicit user confirmation of the Execution Plan.
