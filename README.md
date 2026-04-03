# Sintenel-CLI: Nationals-Tier Security Orchestrator ◈

**Sintenel-CLI** is an AI-powered, multi-agent security assistant designed for high-stakes vulnerability research, forensic investigation, and automated remediation. It transforms generic AI capabilities into "expert-level" security operations for CyberPatriot and real-world blue/red teaming.

---

## ⚡ Key Transformations

- **🕵️ Ghost Hunter Recon (Scout)**: Detects "invisible" persistence like WMI Event Subscriptions, IFEO Debugger hijacks, and SUID/SGID misconfigurations.
- **⚔️ Surgical Remediation (Fixer)**: Applies high-accuracy patches (e.g., permissions resets, service quoting) with mandatory "State-Check -> Verify" loops.
- **🧠 National-Winner Strategy (Orchestrator)**: Enforces the optimal "Forensics First" order of operations and "Skeptical Auditing" for hidden vulnerabilities.
- **✨ Premium Interactive REPL**: Real-time AI processing with "Markdown Snapping," multi-line input support (`\`), and session management.
- **🚀 One-Click Sentinel**: Self-healing bootstrap (`launch-sintenel.bat`) that works even on hardened or malware-infected systems.

---

---

## ⚡ Quick Start (The "Guaranteed" Method)
Sintenel-CLI is designed for extreme environmental resilience, working even on hardened or malware-infected systems.

### 1️⃣ Initial Setup
**Double-click** `setup-sintenel.bat`. This will launch the interactive setup wizard to securely store your API Key.
*   *Alternatively, in terminal:* `node dist/sintenel.cjs setup`

### 2️⃣ Launching the App
**Double-click** `launch-sintenel.bat`. This launches the orchestrator and enters interactive mode.
*   *Alternatively, in terminal:* `.\launch-sintenel.bat "Your security goal here"`

---

### 🛡️ Resilience: The "Guaranteed Launch" System
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

### 💻 Terminal Usage (Power Users)
If you prefer working directly in the terminal, use these commands:

| Action | Command |
| :--- | :--- |
| **Interactive Mode** | `node dist/sintenel.cjs` |
| **Direct Goal** | `node dist/sintenel.cjs "Audit all users"` |
| **Setup Key** | `node dist/sintenel.cjs setup` |
| **Clear Key** | `node dist/sintenel.cjs logout` |

> [!TIP]
> **PowerShell Users**: If `node` is not in your PATH, the provided `.ps1` and `.bat` scripts will automatically find it for you. Use `.\launch-sintenel.bat` for the most reliable terminal experience.

### 6. 🔥 THE GUARANTEED LAUNCH (Bypassing All Restrictions)
If the system is heavily hardened, infected, or has `cmd.exe` blocked, use the **One-Click Launcher**:

- **Windows**: Run `launch-sintenel.bat`.
- **PowerShell**: `.\sintenel.ps1 "Your objective"`

This bootstrap will:
1.  **Auto-repair** Registry blocks on `cmd.exe`.
2.  **Auto-discover** `node.exe` even if it's not in the PATH.
3.  **Self-relaunch** to bypass PowerShell execution policies.

**🔐 PRO TIP (Scoring Target):**
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

## 🛡 Security & Safety

- **Execution Plans**: Every action is preceded by a detailed plan requiring operator approval (Y/N).
- **Tamper-Evident Logs**: All actions are hashed and logged to `sentinel-audit.log` for a cryptographically signed chain of custody.
- **Surgical Consistency**: Uses `.bak` backups for all system config changes (PAM, SSH, Registry).
- **Atomic Verification**: Every fix is automatically followed by a verification command to confirm success.

---

## 📚 Expert Playbooks
Sintenel-CLI's "DNA" is built on elite CyberPatriot checklists:
- `knowledge_base/scoring_playbook.md`: High-value point maximization logic.
- `knowledge_base/playbook_windows.md`: Registry security and SECPOL IDs.
- `knowledge_base/playbook_linux.md`: UID 0 auditing and kernel hardening.
- `knowledge_base/forensics_guide.md`: Artifact discovery and hashing.

---

**Built by security engineers for those who refuse to lose on the final 15 points.** ⚡
