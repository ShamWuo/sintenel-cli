# Linux Hardening Playbook (CyberPatriot Nationals Tier)

This is the definitive, Nationals-level Order of Operations for securing a Linux (Ubuntu/Debian/CentOS) system while preserving points and forensic evidence.

## 0. PRE-FLIGHT & FORENSICS (DO THIS FIRST)
*DO NOT change passwords or delete files until forensic questions are answered.*
- [ ] **Read the README**: Identify authorized users, admins, required services, and critical ports.
- [ ] **Answer Forensic Questions**: Search the system for specific artifacts.
- [ ] **Backup Critical Files**: `cp /etc/passwd /etc/passwd.bak`, `cp /etc/shadow /etc/shadow.bak`, `cp /etc/group /etc/group.bak`, `cp /etc/sudoers /etc/sudoers.bak`.
- [ ] **Check Bash History**: Review `/home/*/.bash_history` and `/root/.bash_history` for malicious commands run prior to the competition.

## 1. USER & ACCOUNT AUDITING
- [ ] **Authorized Users**: Compare `cat /etc/passwd | cut -d: -f1` with the README.
- [ ] **Lock Unauthorized Users**: `passwd -l [username]` and `chage -E 0 [username]` (Locks account, preserves home directory for forensics).
- [ ] **Root UID Audit**: Ensure ONLY root has UID 0. `awk -F: '($3 == "0") {print}' /etc/passwd`.
- [ ] **Empty Passwords**: Find accounts with no passwords: `awk -F: '($2 == "") {print}' /etc/shadow`.
- [ ] **Sudo/Admin Group**: Check who has admin rights.
  - Debian/Ubuntu: `grep '^sudo' /etc/group` or `grep '^adm' /etc/group`.
  - CentOS/RHEL: `grep '^wheel' /etc/group`.
  - Remove unauthorized users: `gpasswd -d [user] sudo`.
- [ ] **Sudoers File**: `visudo`. Look for `NOPASSWD`, unauthorized users, or permissive wildcards (e.g., `ALL=(ALL:ALL) ALL`).

## 2. PASSWORD POLICIES (PAM)
*Configure Pluggable Authentication Modules for strict enforcement.*
- [ ] **Password Aging (`/etc/login.defs`)**:
  - `PASS_MAX_DAYS 90`
  - `PASS_MIN_DAYS 1`
  - `PASS_WARN_AGE 14`
- [ ] **Password Complexity (`/etc/security/pwquality.conf` or `pam_pwquality.so`)**:
  - `minlen = 14`
  - `dcredit = -1` (requires digit)
  - `ucredit = -1` (requires uppercase)
  - `lcredit = -1` (requires lowercase)
  - `ocredit = -1` (requires special char)
- [ ] **Account Lockout (`/etc/pam.d/common-auth` or `system-auth`)**:
  - Use `pam_tally2.so` or `pam_faillock.so` to lock accounts after 5 failed attempts for 15 minutes.
- [ ] **Restrict `su`**: Limit `su` to the `wheel` or `sudo` group via `/etc/pam.d/su`.

## 3. ADVANCED PERSISTENCE & MALWARE CHECKS
*Nationals-level attackers hide well.*
- [ ] **Cron Jobs**:
  - Check `/etc/crontab`, `/etc/cron.hourly/`, `daily`, `weekly`, `monthly`, `d`.
  - Check user crontabs: `for user in $(cut -f1 -d: /etc/passwd); do crontab -u $user -l; done`.
- [ ] **Systemd Timers/Services**: `systemctl list-timers --all` and `systemctl list-units --type=service`. Look for suspicious names or descriptions.
- [ ] **Profile & RC Files**: Check `/etc/profile`, `/etc/bash.bashrc`, `~/.bashrc`, `~/.profile` for aliases or reverse shells (e.g., `nc -e /bin/sh`, `bash -i >& /dev/tcp/...`).
- [ ] **Rootkits**: Install and run `rkhunter --check` and `chkrootkit`.
- [ ] **Authorized Keys (SSH)**: Check `~/.ssh/authorized_keys` for all users to ensure no backdoors exist.

## 4. FILE SYSTEM & PERMISSIONS
- [ ] **SUID/SGID Binaries**: Find files that execute as root. `find / -perm /6000 -type f -exec ls -ld {} \; 2>/dev/null`. Remove SUID from unnecessary tools (e.g., `nmap`, `vim`, `find`, `bash`): `chmod u-s [file]`.
- [ ] **World-Writable Files**: `find / -type f -perm -0002 -exec ls -l {} \; 2>/dev/null`. Remove world-write permissions unless necessary.
- [ ] **Unowned Files**: `find / -nouser -o -nogroup 2>/dev/null`. Reassign or delete.
- [ ] **Secure /tmp**: Ensure `/tmp`, `/var/tmp`, and `/dev/shm` are mounted with `nodev`, `nosuid`, and `noexec` in `/etc/fstab`.

## 5. NETWORK & FIREWALL (UFW / iptables)
- [ ] **UFW Configuration**:
  - `ufw enable`
  - `ufw default deny incoming`
  - `ufw default allow outbound`
  - `ufw allow [required_ports]` (e.g., 22/tcp, 80/tcp).
- [ ] **Listening Ports Audit**: `ss -tulpn` or `netstat -tulpn`. Identify every listening service and disable what isn't required by the README.

## 6. SERVICE HARDENING
- [ ] **SSH Hardening (`/etc/ssh/sshd_config`)**:
  - `PermitRootLogin no`
  - `PasswordAuthentication no` (If using keys, else enforce strong passwords).
  - `PermitEmptyPasswords no`
  - `X11Forwarding no`
  - `Protocol 2`
  - `AllowUsers [authorized_admins]`
  - `ClientAliveInterval 300`, `ClientAliveCountMax 0`
  - *Restart SSH*: `systemctl restart sshd`.
- [ ] **Disable Insecure Services**: `systemctl disable --now [service]`. Target `telnet`, `vsftpd` (if not required), `bind9`, `rpcbind`, `nfs`, `samba`, `cups`.

## 7. KERNEL & OS SECURITY (sysctl)
*Edit `/etc/sysctl.conf` or `/etc/sysctl.d/99-security.conf`.*
- [ ] **Disable IP Forwarding**: `net.ipv4.ip_forward = 0`.
- [ ] **Disable ICMP Redirects**: `net.ipv4.conf.all.accept_redirects = 0`.
- [ ] **Enable SYN Cookies**: `net.ipv4.tcp_syncookies = 1` (Protects against SYN floods).
- [ ] **Ignore ICMP Broadcasts**: `net.ipv4.icmp_echo_ignore_broadcasts = 1`.
- [ ] **Enable ASLR**: `kernel.randomize_va_space = 2`.
- [ ] *Apply*: `sysctl -p`.

## 8. AUDITING & MANDATORY ACCESS CONTROL
- [ ] **AppArmor / SELinux**: Ensure they are installed and in `Enforcing` mode (`aa-status` or `sestatus`).
- [ ] **Auditd**: Install `auditd`. Configure `/etc/audit/audit.rules` to monitor:
  - `-w /etc/passwd -p wa -k identity`
  - `-w /etc/shadow -p wa -k identity`
  - `-w /etc/sudoers -p wa -k actions`

## 9. PROHIBITED FILES & SOFTWARE
- [ ] **Media Files**: Find and delete `.mp3`, `.mp4`, `.avi`, `.mkv`.
- [ ] **Hacking Tools**: `apt purge nmap wireshark john hydra netcat aircrack-ng tcpdump`.
