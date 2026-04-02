# README Parsing & Authorized State Strategy

This playbook defines how Sintenel-CLI extracts the "Golden State" from the competition README. The Orchestrator MUST use this to filter Scout results before delegating to the Fixer.

## 📋 1. Authorized User Extraction
The README typically lists "Authorized Users". 
- **Critical Action**: Any user found by the Scout that is *not* in this list (and is not a standard system account like `root`, `bin`, `Administrator`, `Guest`) must be marked as **UNAUTHORIZED**.
- **Admin Audit**: Only specific users should have `sudo` or be in the `Administrators` group. If the README says "Bob is the admin", everyone else must be removed from the admin group.

## 🛠 2. Required Services & Ports
The README will specify "Critical Infrastructure" (e.g., "The company needs a Web Server and a Database").
- **Critical Action**: The Fixer MUST NOT disable services or close ports associated with these requirements (e.g., Port 80/443 for Web, 3306 for MySQL).
- **Service Hardening**: Only *harden* these services (config files); do not *stop* them.

## 🚫 3. Prohibited Software/Content
The README may list specific prohibited items (e.g., "No media files", "No hacking tools like nmap").
- **Critical Action**: Use the Scout's `ProhibitedFiles` scan to find these. 
- **Quarantine**: The Fixer should move these to a `/root/quarantine` or `C:\Users\Administrator\Quarantine` folder instead of immediate deletion, in case of false positives.

## ⚖️ 4. The Differential Analysis Logic
The Orchestrator must perform this internal logic:
1. **Actual State** (from Scout's Master Recon JSON).
2. **Authorized State** (from README.md parsing).
3. **Differential** = [Actual State] - [Authorized State].
4. **Action Plan** = Remediate everything in the Differential.

## 🚩 5. Red Flags (Nationals Tier)
- **Shared Credentials**: If the README says "Users must have unique passwords", the Orchestrator should plan a password reset for all users.
- **Hidden Requirements**: Sometimes the README *implies* a service (e.g., "Employees use the network share"). This means SMB/Samba must stay open even if not explicitly "Critical".
