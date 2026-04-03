# GEMINI.md

## Project Overview
**Sintenel-CLI** is an AI-powered multi-agent security orchestrator designed for automated vulnerability scanning, forensic investigation, and remediation. It uses a tiered agent architecture with human-in-the-loop safety gates to ensure that security tasks are performed reliably and transparently.

### Key Technologies
- **Runtime:** Node.js (v20+)
- **Language:** TypeScript (ES Modules)
- **AI Engine:** Vercel AI SDK with Google Gemini 3 (Flash for orchestration, 3.1 Flash Lite for sub-agents).
- **Quota Resilience:** Automated **Exponential Backoff** handling for 429 quota (free-tier 20 RPM) errors.
- **Resilience:** Self-healing PowerShell bootstrap, Registry-based CMD repair, Node.js auto-discovery.
- **Security:** In-app **Setup Wizard**, Keytar/local-fallback encryption, Hash-chained audit logs.
- **Testing:** Vitest.

## 🚀 The "Guaranteed Launch" System
Sintenel-CLI is designed for extreme environmental resilience. If the system is hardened or infected:
1. **`launch-sintenel.bat`**: The primary one-click entry point. Bypasses Group Policy blocks and automatically repairs `cmd.exe`.
2. **`setup-sintenel.bat`**: One-click onboarding. Configures API keys safely without manual `.env` file editing.
3. **`sintenel.ps1`**: The Master Bootstrap. 
   - **Self-Healing**: Automatically re-enables `cmd.exe` via Registry (`DisableCMD=0`).
   - **Discovery**: Proactively finds `node.exe` even if PATH is corrupted (searches Common Files, Program Files, and local app data).
   - **Onboarding**: Intercepts missing keys and launches the setup wizard automatically.

1.  **Orchestrator (`src/agents/orchestrator.ts`):** The strategic planner. Uses `gemini-3-flash`. It analyzes goals, assesses risks, and generates an **Execution Plan**. It cannot modify files directly; it must delegate to specialized sub-agents.
2.  **Scout (`src/agents/scout.ts`):** A read-only reconnaissance specialist. Uses `gemini-3.1-flash-lite`. It scans the file system and runs safe shell commands to identify issues.
3.  **Fixer (`src/agents/fixer.ts`):** The remediation specialist. Uses `gemini-3.1-flash-lite`. It applies patches and verifies them with tests. It can only write to files after the Orchestrator's plan is approved by the user.

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

### High-Difficulty Vulnerability Targets (CyberPatriot Max Score)
Agents MUST be prepared to identify and remediate these advanced persistence and privilege escalation vectors:

1.  **Stealth Windows Persistence:**
    *   **WMI Event Subscriptions**: `Get-WMIObject -Namespace root\subscription`. Look for triggers on system idle or logons.
    *   **Registry "Logon Scripts"**: Beyond Run keys, audit `HKCU:\Environment\UserInitMprLogonScript` and `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\Userinit`.
    *   **IFEO Hijacking**: Verify `Image File Execution Options` (e.g., `sethc.exe` or `utilman.exe` mapped to `cmd.exe`).
    *   **Service Hijacking**: Identify unquoted service paths (`gwmi win32_service | Where-Object { $_.PathName -notlike '"*' -and $_.PathName -like '* *' }`).
    *   **Hidden Net Users**: Audit `Get-LocalUser` and check for users with a `$` suffix or those hidden from the Welcome screen via Registry.

2.  **Advanced Linux Persistence:**
    *   **Pam Bypass**: Audit `/etc/pam.d/common-auth` for `auth [success=1 default=ignore] pam_unix.so nullok`.
    *   **LD_PRELOAD Rootkits**: Check `/etc/ld.so.preload` for unauthorized libraries.
    *   **Kernel Hijacks**: Check `/etc/modules-load.d/` for unauthorized kernel modules.
    *   **Cron Obfuscation**: Check `/etc/cron.d/` for hidden (`.`) files and verify `crontab -l -u root` for all users.
    *   **SUID/SGID "Living Off the Land"**: Flag `find`, `nmap`, `perl`, `python`, and `ruby` if they have SUID bits enabled.

3.  **Authorized State Enforcement:**
    *   **README Extraction**: Use `extractReadme` to define the "Authorized State" (users, services, ports).
    *   **Baseline Verification**: Use `verifyBaseline` to find anomalies (unauthorized users/SUIDs) compared to clean OS manifests.
    *   **Firewall Whitelisting**: Use `generateFirewallPolicy` to create strict Netsh/UFW rules.
    *   **Audit Diffing**: Use `diffAuditState` after remediation to provide proof of security improvement.
    *   **Forensic Evidence**: Run `scripts/security/collect_forensics.*` scripts to gather deep login and history artifacts.

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
