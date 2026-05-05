# Sintenel-CLI: Nationals-Tier Security Orchestrator

**Sintenel-CLI** is an AI-powered, multi-agent security assistant designed for high-stakes vulnerability research, forensic investigation, and automated remediation. It transforms generic AI capabilities into "expert-level" security operations for CyberPatriot and real-world blue/red teaming.

---

- Ghost Hunter Recon (Scout): Detects "invisible" persistence like WMI Event Subscriptions, IFEO Debugger hijacks, and SUID/SGID misconfigurations.
- Surgical Remediation (Fixer): Applies high-accuracy patches (e.g., permissions resets, service quoting) with mandatory "State-Check -> Verify" loops.
- National-Winner Strategy (Orchestrator): Enforces the optimal "Forensics First" order of operations and "Skeptical Auditing" for hidden vulnerabilities.
- Premium Interactive REPL: Real-time AI processing with "Markdown Snapping," multi-line input support (\), and session management.
- One-Click Sentinel: Self-healing bootstrap (launch-sintenel.bat) that works even on hardened or malware-infected systems.

---

---

## Quick Start (The "No-Install" Method)
Sintenel-CLI is designed for extreme convenience. You don't even need to clone this repo or have Node.js installed.

### 1. Option A: Standalone Executable (Easiest)
**Download** the latest `Sintenel.exe` from the [Releases](https://github.com/ShamWuo/sintenel-cli/releases) page.
1. Move it to any folder.
2. Double-click it to start.
3. (Optional) Add it to your PATH to run `Sintenel` from anywhere.

### 2. Option B: One-Line Installer
Paste this into your PowerShell terminal to download and set up Sintenel automatically:
```powershell
irm https://raw.githubusercontent.com/ShamWuo/sintenel-cli/master/scripts/install.ps1 | iex
```

---

### For Developers (Source Code)
If you wish to modify the source:
1.  `git clone ...`
2.  `npm install`
3.  `npm run compile` to generate your own binaries.

---

---

### Resilience: The "Guaranteed Launch" System
Sintenel is designed for extreme environmental resilience...

**Linux:**
1. Ensure the `dist` folder and `sintenel` wrapper are in the same directory.
2. Run: `chmod +x ./sintenel && ./sintenel "Your objective here"`

### 2. Development & Deployment
If you wish to modify the source or deploy from scratch:
```bash
git clone https://github.com/ShamWuo/sintenel-cli.git
cd sintenel-cli
npm install
npm run bundle  # Generates the standalone dist/sintenel.cjs
npm start -- "Audit all users" # Runs the bundled production code
```

### 3. Model Configuration
The CLI is optimized for the **Gemini 3** series.
- **Orchestrator**: `gemini-3-flash` (Fast, logical, high context)
- **Sub-Agents**: `gemini-3.1-flash-lite` (Cost-efficient, tool-specialized)

> [!NOTE]
> **Quota Warning**: The Google AI Free Tier has a **20 Requests Per Minute (RPM)** limit. If you reach this limit, the CLI will display a countdown until your quota resets.

### Terminal Usage (Power Users)
If you prefer working directly in the terminal, use these commands:

| Action | Command |
| :--- | :--- |
| **Interactive Mode** | `node dist/sintenel.cjs` |
| **Direct Goal** | `node dist/sintenel.cjs "Audit all users"` |
| **Setup Key** | `node dist/sintenel.cjs setup` |
| **Clear Key** | `node dist/sintenel.cjs logout` |

> [!TIP]
> **PowerShell Users**: If `node` is not in your PATH, the provided `.ps1` and `.bat` scripts will automatically find it for you. Use `.\launch-sintenel.bat` for the most reliable terminal experience.

### THE GUARANTEED LAUNCH (Bypassing All Restrictions)
If the system is heavily hardened, infected, or has `cmd.exe` blocked, use the **One-Click Launcher**:

- **Windows**: Run `launch-sintenel.bat`.
- **PowerShell**: `.\sintenel.ps1 "Your objective"`

This bootstrap will:
1.  **Auto-repair** Registry blocks on `cmd.exe`.
2.  **Auto-discover** `node.exe` even if it's not in the PATH.
3.  **Self-relaunch** to bypass PowerShell execution policies.

**PRO TIP (Scoring Target):**
If `cmd.exe` is blocked, you can often fix it via PowerShell to gain access back:
```powershell
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System" -Name "DisableCMD" -Value 0
```

---

## 🛠 Operational Modes

### 1. Scoring Run (`/score`)
Automatically initiates a high-speed, "Nationals-Tier" security audit.
- **Phase 1**: Forensic artifact discovery (hashes/logs).
- **Phase 2**: Policy Bashing (GPO, Firewall, Account Policies).
- **Phase 3**: Persistence Hunting (WMI, IFEO, Registry Phantoms).
- **Phase 4**: Surgical Hardening & Verification.

### 2. Forensic Investigation Mode
Triggered by goals starting with "Forensic Question" or requesting metadata.
- **Restriction**: **STRICTLY PROHIBITED** from modifying the system. All write operations are blocked.
- **Report**: Consolidated Question, Answer, and Evidence (MD5/SHA256) format.

### 3. Interactive REPL Commands
- `/score` - Start a full CyberPatriot point maximization run.
- `/clear` - Clear the terminal.
- `/reset` - Start a fresh conversation context.
- `/history` - View the session's turn-by-turn history.
- `/usage` - View real-time token and cost stats.

---

### Quota & Speed control
If you are using a **Paid Tier** or **Google Cloud (Vertex AI)** account, you can disable the conservative 20s-40s "Free Tier" cooldowns.

| Mode | Env Var | Behavior |
| :--- | :--- | :--- |
| **Standard** | `SINTENEL_RETRY_MODE=standard` | Base 10s wait (Safe for 20 RPM Free Tier) |
| **Aggressive** | `SINTENEL_RETRY_MODE=aggressive` | Base 2s wait (For Paid/Cloud accounts) |
| **Off** | `SINTENEL_RETRY_MODE=off` | Fail immediately on 429 quota errors |

**Development Progress:**
- [x] Implement Dynamic Backoff in `agentManager.ts`
    - [x] Add `SINTENEL_RETRY_MODE` support (standard, aggressive, off)
    - [x] Refactor `withRetry` to use mode-based delays
    - [x] Improve error detection for 429 vs 503
- [x] Update Documentation
    - [x] Add `SINTENEL_RETRY_MODE` to `README.md`
- [x] Verification
    - [x] Run test/build to ensure no syntax errors (Verified)

---

## 🛡 Security & Safety

- **Execution Plans**: Every action is preceded by a detailed plan requiring operator approval (Y/N).
- **Tamper-Evident Logs**: All actions are hashed and logged to `sentinel-audit.log` for a cryptographically signed chain of custody.
- **Surgical Consistency**: Uses `.bak` backups for all system config changes (PAM, SSH, Registry).
- **Atomic Verification**: Every fix is automatically followed by a verification command to confirm success.

---

## Expert Playbooks
Sintenel-CLI's "DNA" is built on elite CyberPatriot checklists:
- `knowledge_base/scoring_playbook.md`: High-value point maximization logic.
- `knowledge_base/playbook_windows.md`: Registry security and SECPOL IDs.
- `knowledge_base/playbook_linux.md`: UID 0 auditing and kernel hardening.
- `knowledge_base/forensics_guide.md`: Artifact discovery and hashing.

---

**Built by security engineers for those who refuse to lose on the final 15 points.**
