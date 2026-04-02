# Forensic Investigation Guide (CyberPatriot)

This guide provides the optimal "Order of Operations" for solving forensic challenges while preserving system integrity.

## 1. Initial Assessment
- **Read Forensic Questions Early**: Don't start hardening until you've parsed all forensic prompts.
- **Backups**: Ensure a system backup or snapshot exists before any major changes.

## 2. File Metadata & Analysis
- **Hashing (Integrity)**: 
  - **Windows**: \`Get-FileHash -Algorithm MD5 [path]\` or SHA256.
  - **Linux**: \`md5sum [path]\` or \`sha256sum [path]\`.
- **Finding Suspicious Artifacts**:
  - **Windows**: \`Get-ChildItem -Path C:\\Users -Include *.mp3, *.sh, *.bat, *.txt -Recurse -Force -ErrorAction SilentlyContinue\`.
  - **Linux**: \`find /home -type f \\( -name "*.mp3" -o -name "*.sh" -o -name "*.bat" \\)\`.

## 3. Account Auditing (Forensics)
- **Last Logons**: \`net user [username]\` (Windows) or \`lastlog -u [username]\` (Linux).
- **History Tracking**: 
  - **Windows**: Check browsing history with specialized PowerShell modules or manual path extraction.
  - **Linux**: Check \`~/.bash_history\` for all suspicious users.

## 4. Log Analysis & Tracing
- **Event Logs (Windows)**: Use \`Get-WinEvent\` to filter for specific Event IDs (e.g., 4624 for successful logon, 4625 for failed logon).
- **Auth Logs (Linux)**: Parse \`/var/log/auth.log\` for failed SSH attempts or privilege escalations.

## 5. Artifact Discovery (Persistence)
- **Startup Items**: Inspect registry Run keys and the \`shell:startup\` folder.
- **Services**: Use \`Get-Service | Where Status -eq 'Running'\` to find and document suspicious services.
- **Cron Jobs**: Forensic answers are often found in user crontabs or system-wide cron scripts.

## 6. Prohibited Artifacts (CP-Specific)
- **Hacktools**: \`Nmap\`, \`Wireshark\`, \`John the Ripper\`, \`Hydra\`, and \`Rainbow Tables\`.
- **Media Files**: \`.mp3\`, \`.mp4\`, \`.avi\`, etc. (Check README for authorized exceptions).
- **Prohibited Games**: Identify non-standard game executables in user Profile directories.
