#!/bin/bash
# Sintenel-CLI: Forensic Evidence Collection Script
# Purpose: Deep dive into forensic artifacts for CyberPatriot.
# Safety: Read-only. Does not modify artifacts.

echo "=== STARTING FORENSIC DATA COLLECTION ==="

echo -e "\n=== BASH HISTORY AUDIT (ALL USERS) ==="
for user in $(cut -d: -f1 /etc/passwd); do
    history_file="/home/$user/.bash_history"
    if [ "$user" == "root" ]; then history_file="/root/.bash_history"; fi
    if [ -f "$history_file" ]; then
        echo "--- History for $user ---"
        tail -n 50 "$history_file"
    fi
done

echo -e "\n=== LOGIN AUDIT (LAST LOGONS) ==="
last -n 20

echo -e "\n=== AUTH LOG ANALYSIS (FAILED ATTEMPTS) ==="
grep "Failed password" /var/log/auth.log 2>/dev/null | tail -n 20

echo -e "\n=== CRITICAL CONFIGURATION HASHES ==="
declare -a config_files=("/etc/passwd" "/etc/shadow" "/etc/sudoers" "/etc/ssh/sshd_config" "/etc/hosts")
for file in "${config_files[@]}"; do
    if [ -f "$file" ]; then
        md5sum "$file"
    fi
done

echo -e "\n=== SEARCHING FOR SUSPICIOUS EXECUTABLES IN TEMP/HOME ==="
find /home /tmp /var/tmp -maxdepth 3 -type f -executable -exec md5sum {} + 2>/dev/null | head -n 30

echo -e "\n=== NETWORK ARTIFACTS (ESTABLISHED CONNECTIONS) ==="
ss -tulpna | grep ESTAB

echo -e "\n=== SYSTEMD UNIT FILE MODIFICATIONS ==="
find /etc/systemd/system -type f -mmin -1440 -exec ls -l {} + 2>/dev/null

echo "=== FORENSIC COLLECTION COMPLETE ==="
