# CyberPatriot Scoring Playbook (Nationals Tier Strategy)

This document is the "Master Orchestration Plan" for Sintenel-CLI. It defines the high-level strategy for maximizing points, minimizing penalties, and securing systems at a Nationals-winning level.

---

## 🏛 0. Order of Operations (The Winning Workflow)
1. **FORENSICS FIRST**: Scout identifies answers to forensic questions *before* any changes are made to the system state (integrity preservation).
2. **README PARSE**: Extract authorized users, required services, and critical functions.
3. **POLICY BATCH**: Apply broad security policies (Account/Audit/Firewall) for rapid early-game point accumulation.
4. **USER HYGIENE**: Disable unauthorized accounts and audit administrative groups.
5. **PERSISTENCE REMOVAL**: Hunt and destroy backdoors (Registry, Cron, WMI, Services).
6. **APPLICATION HARDENING**: Secure critical services (Web, DB, SSH, RDP).
7. **PROHIBITED CONTENT**: Scan and quarantine/delete media and hacking tools.
8. **FINAL AUDIT**: Verify integrity with `sfc`, `DISM`, or `debsums`.

---

## 🪟 1. Windows: The "Invisible" Nationals Points
*High-level rounds reward discovery of deeply embedded misconfigurations.*

### A. System Management & Features
- **Legacy Components**: Disable `PowerShell v2.0` (prevents security log bypasses) and `SMB v1.0` (WannaCry vector).
- **Windows Script Host**: Disable `WSH` to prevent script-based malware execution.
- **AutoPlay/AutoRun**: Disable globally to prevent USB-based compromise.
- **RDP Security**: Enforce `Network Level Authentication (NLA)` and restrict users to a dedicated "Remote Desktop Users" group.

### B. User Rights Assignment (GPO)
- **Nationals Target**: Audit `Debug programs` (SeDebugPrivilege). Remove all users except `Administrators`.
- **Nationals Target**: Audit `Log on as a batch job` and `Log on as a service`. Ensure no unauthorized accounts are present.
- **Nationals Target**: Audit `Manage auditing and security log`. Ensure only `Administrators` are listed.

### C. Advanced Persistence Discovery
- **Registry Hijacks**: Check `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\Userinit`. It should only be `C:\Windows\system32\userinit.exe,`.
- **WMI Eventing**: Scout MUST run `Get-WmiObject -Namespace root\subscription -Class CommandLineEventConsumer` to find fileless persistence.
- **Task Scheduler**: Search for tasks hidden in `\Microsoft\Windows\...` system folders that point to user-writable paths (`Temp`, `Downloads`).

---

## 🐧 2. Linux: Kernel & File Integrity Points
*Linux points are won in the configuration files and the kernel parameters.*

### A. Kernel Hardening (`/etc/sysctl.conf`)
- **Points Target**: `net.ipv4.conf.all.rp_filter = 1` (Reverse Path Filtering).
- **Points Target**: `net.ipv4.tcp_syncookies = 1` (SYN flood protection).
- **Points Target**: `kernel.randomize_va_space = 2` (ASLR Enforcement).
- **Points Target**: Disable IP Forwarding: `net.ipv4.ip_forward = 0`.

### B. File System Integrity
- **SUID/SGID Audit**: Scout must list all SUID files. Flag `nmap`, `vim`, `find`, `perl`, `python`, `bash` if they have SUID bit set.
- **Mount Options**: Audit `/etc/fstab`. Points for adding `nodev, nosuid, noexec` to `/home`, `/tmp`, and `/var/tmp`.
- **Sticky Bit**: Ensure sticky bit is set on all world-writable directories (`/tmp`).

### C. Service Isolation
- **SSH Hardening**: Beyond `PermitRootLogin no`, enforce `AllowUsers` whitelist and `LogLevel VERBOSE`.
- **Daemon Audit**: Check for `telnetd`, `ftpd`, `rshd`, `snmpd`. Disable and mask if not required.
- **Cron Hidden Jobs**: Check `/etc/cron.d/`, `/etc/cron.hourly/`, etc., and check for *hidden files* (starting with `.`) in these directories.

---

## 🌐 3. Cisco: Router/Switch Hardening
*Scoring in Cisco is about consistency and following the 10-step hardening rule.*

### A. Management Plane Security
- **Console/VTY Access**: `login local` and `transport input ssh` (Disable Telnet).
- **Banner Compliance**: Must include specific legal language (Unauthorized access is prohibited/monitored).
- **Encrypted Secrets**: `service password-encryption` and `enable secret` (Never `enable password`).

### B. Control Plane Security
- **Service Disabling**: `no ip http server`, `no ip http secure-server`, `no cdp run` (on internet-facing interfaces).
- **Logging**: `logging buffered`, `logging host [IP]`, and `ntp server` for accurate timestamps.

### C. Data Plane Security
- **Port Security (Switch)**: `switchport port-security`, `switchport port-security mac-address sticky`, `switchport port-security violation restrict`.
- **ACLs**: Implement an ACL on VTY lines (`access-class`) and an anti-spoofing ACL on the WAN interface.

---

## 🕵️‍♂️ 4. Forensic Investigation Strategy
- **Artifact Discovery**: Scout prioritizes finding "Forensic Question" answers (hashes, timestamps, IP addresses) before performing any state-changing operations.
- **Log Preservation**: Fixer must NEVER clear logs (Event Viewer, `/var/log/*`) until the Orchestrator confirms forensic questions are complete.
- **Recycle Bin Analysis**: Scout parses `$Recycle.Bin` to find deleted malware or unauthorized tools.

---

## ⚡ 5. The "Golden" Execution Loop (Sintenel Strategy)
1. **Scout (Recon)**:
   - Identify "Point Categories" (Users, Policies, Persistence).
   - Create a "Differential Map" (System State vs. Authorized README state).
2. **Orchestrator (Strategy)**:
   - Priority 1: Critical Forensic Questions.
   - Priority 2: Policy/GPO (Fastest points).
   - Priority 3: User/Group cleanup.
   - Priority 4: Persistence/Malware (Highest difficulty).
3. **Fixer (Remediation)**:
   - Use `backupExisting: true` for all config edits.
   - Apply changes in batches to maximize scoring engine update cycles.
   - Perform verification tests (Check if service is down, check if user is disabled) before confirming task completion.
