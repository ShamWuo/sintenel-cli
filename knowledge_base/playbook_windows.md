# Windows Hardening Playbook (CyberPatriot Nationals Tier)

This is the definitive, Nationals-level Order of Operations for securing a Windows desktop/server while preserving points and forensic evidence.

## 0. PRE-FLIGHT & FORENSICS (DO THIS FIRST)
*DO NOT change passwords or delete files until forensic questions are answered.*
- [ ] **Read the README.txt**: Identify authorized users, required services, and critical business functions.
- [ ] **Answer Forensic Questions**: Search the system for specific artifacts requested in the CyberPatriot scoring engine.
- [ ] **Export Event Logs**: Save `Security`, `System`, and `Application` logs to a secure location for later analysis.
- [ ] **Snapshot Current State**: `net user > C:\users_before.txt`, `net localgroup administrators > C:\admins_before.txt`.

## 1. USER & ACCOUNT SECURITY
- [ ] **Audit Authorized Users**: Compare `net user` with the README. Disable (do not delete immediately) unauthorized users: `Disable-LocalUser -Name "Hacker"`.
- [ ] **Audit Administrators**: `net localgroup administrators`. Remove unauthorized accounts: `net localgroup administrators "Hacker" /delete`.
- [ ] **Hidden Admins**: Check Registry `HKLM\SAM\SAM\Domains\Account\Users\Names` for hidden accounts not listed by `net user`.
- [ ] **Built-in Accounts**:
  - Disable Guest: `net user Guest /active:no`
  - Rename/Disable Administrator (if another admin exists and it's allowed).
- [ ] **Password Policies (Local Security Policy - secpol.msc)**:
  - Enforce password history: 24
  - Maximum password age: 30-90 days
  - Minimum password age: 1 day
  - Minimum password length: 14+ characters
  - Password must meet complexity requirements: Enabled
  - Store passwords using reversible encryption: Disabled
- [ ] **Account Lockout Policy**:
  - Account lockout duration: 30 minutes
  - Account lockout threshold: 5 invalid attempts
  - Reset account lockout counter after: 30 minutes

## 2. USER RIGHTS ASSIGNMENT (secpol.msc)
*Crucial for preventing lateral movement and privilege escalation.*
- [ ] **Access this computer from the network**: Remove `Everyone`, `Guests`.
- [ ] **Allow log on locally**: Ensure only authorized users/groups are present.
- [ ] **Deny log on as a batch job**: Add `Guests`.
- [ ] **Deny log on as a service**: Add `Guests`.
- [ ] **Deny log on locally**: Add `Guests`, `Hacker` accounts.
- [ ] **Deny access to this computer from the network**: Add `Guests`, `Local account and member of Administrators group` (prevents pass-the-hash).

## 3. AUDIT POLICIES (Advanced Audit Policy Configuration)
*Enable to track malicious activity.*
- [ ] **Account Logon**: Audit Credential Validation (Success, Failure).
- [ ] **Account Management**: Audit Application Group Management, Computer Account Management, User Account Management (Success, Failure).
- [ ] **Detailed Tracking**: Audit Process Creation (Success) - *Include command line in process creation events via Administrative Templates*.
- [ ] **Logon/Logoff**: Audit Logon (Success, Failure), Logoff (Success).
- [ ] **Object Access**: Audit File Share, File System.
- [ ] **Privilege Use**: Audit Sensitive Privilege Use (Success, Failure).

## 4. SECURITY OPTIONS (secpol.msc)
- [ ] **Accounts**: Block Microsoft accounts (if AD domain).
- [ ] **Accounts**: Limit local account use of blank passwords to console logon only: Enabled.
- [ ] **Interactive logon**: Do not display last user name: Enabled.
- [ ] **Interactive logon**: Machine inactivity limit: 900 seconds.
- [ ] **Microsoft network client/server**: Digitally sign communications (always): Enabled (SMB Signing).
- [ ] **Network security**: Do not store LAN Manager hash value on next password change: Enabled.
- [ ] **Network security**: LAN Manager authentication level: Send NTLMv2 response only. Refuse LM & NTLM.
- [ ] **Network security**: Restrict NTLM: Audit all / Deny all (depending on environment).

## 5. ADVANCED PERSISTENCE CHECKS
*Nationals-level malware hides here.*
- [ ] **Scheduled Tasks**: `Get-ScheduledTask | Where State -ne 'Disabled'`. Look for weird names or triggers. Check `\Microsoft\Windows\Customer Experience Improvement Program` or similar hidden folders.
- [ ] **WMI Event Consumers**: Attackers use WMI to run scripts completely fileless.
  - Run PowerShell as Admin: `Get-WmiObject -Namespace root\subscription -Class __EventFilter` and `Get-WmiObject -Namespace root\subscription -Class CommandLineEventConsumer`. Delete malicious bindings.
- [ ] **Registry Run Keys**: Check `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` and `RunOnce` (and HKCU).
- [ ] **Services**: `Get-Service | Where Status -eq 'Running'`. Look for unsigned binaries or strange paths in `services.msc`.
- [ ] **Image File Execution Options (IFEO)**: `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options`. Ensure `sethc.exe` or `utilman.exe` aren't mapped to `cmd.exe`.
- [ ] **AppInit_DLLs**: `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Windows\AppInit_DLLs`. Should be empty.
- [ ] **Startup Folder**: `shell:startup` and `shell:common startup`.

## 6. NETWORK & FIREWALL
- [ ] **Windows Defender Firewall**:
  - Domain, Private, Public profiles: Enabled.
  - Inbound connections: Block (default).
  - Outbound connections: Allow (default).
  - Display a notification: Yes.
- [ ] **Disable Insecure Protocols**:
  - Disable SMBv1: `Set-SmbServerConfiguration -EnableSMB1Protocol $false -Force`.
  - Disable IPv6 (if not used/required).
  - Disable LLMNR: GPO `Computer Configuration -> Administrative Templates -> Network -> DNS Client -> Turn off multicast name resolution: Enabled`.
  - Disable NetBIOS over TCP/IP: Network Adapter Properties -> IPv4 -> Advanced -> WINS -> Disable NetBIOS.
- [ ] **RDP Hardening (If required)**:
  - Require Network Level Authentication (NLA).
  - Restrict Remote Desktop Users group to strictly necessary users.

## 7. SYSTEM FEATURES & SERVICES
- [ ] **Disable Unnecessary Features (Turn Windows features on or off)**:
  - Telnet Client/Server, TFTP Client, FTP Client.
  - SMB 1.0/CIFS File Sharing Support.
  - IIS (unless it's a web server requirement).
- [ ] **Disable Unnecessary Services (services.msc)**:
  - Remote Registry (Disable).
  - Print Spooler (Disable if no printers).
  - SNMP Service (Disable).
  - Routing and Remote Access (Disable).

## 8. SOFTWARE RESTRICTION & MALWARE
- [ ] **Windows Defender**: Ensure Real-time protection, Cloud-delivered protection, and Automatic sample submission are Enabled.
- [ ] **AppLocker**: Configure rules to prevent execution from user-writable directories (e.g., `C:\Users\*\AppData\Local\Temp`).
- [ ] **Find Prohibited Files**: Search for and delete `.mp3`, `.mp4`, `.avi`, hacking tools (nmap, wireshark, mimikatz), and keyloggers.
- [ ] **System Integrity**: Run `sfc /scannow` and `DISM /Online /Cleanup-Image /RestoreHealth`.

## 9. BROWSER SECURITY (Chrome/Edge/Firefox)
- [ ] **Extensions**: Remove unapproved/malicious extensions.
- [ ] **Settings**: Block pop-ups, disable saving passwords, enable strict tracking prevention.
