#!/usr/bin/env python3
import subprocess
import json
import os

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
        return result.stdout.strip().split('\n') if result.stdout else []
    except Exception as e:
        return [f"Error: {str(e)}"]

payload = {}

payload["Users"] = []
for line in run_cmd("cat /etc/passwd"):
    parts = line.split(':')
    if len(parts) >= 7 and parts[2].isdigit() and int(parts[2]) >= 1000 and parts[0] != "nobody":
        payload["Users"].append({"Name": parts[0], "UID": parts[2], "Shell": parts[6]})

payload["Admins"] = []
for line in run_cmd("getent group sudo wheel 2>/dev/null"):
    parts = line.split(':')
    if len(parts) >= 4 and parts[3]:
        payload["Admins"].extend([user.strip() for user in parts[3].split(',')])

payload["GuestActive"] = run_cmd("grep -i '^allow-guest=true' /etc/lightdm/lightdm.conf* 2>/dev/null")

payload["SSH_Config"] = {
    "PermitRootLogin": run_cmd("grep -i '^PermitRootLogin' /etc/ssh/sshd_config | tail -n 1"),
    "PasswordAuth": run_cmd("grep -i '^PasswordAuthentication' /etc/ssh/sshd_config | tail -n 1")
}
payload["PAM_Quality"] = run_cmd("grep -i 'pam_pwquality.so' /etc/pam.d/common-password 2>/dev/null")

vuln_services = ["telnet", "vsftpd", "proftpd", "snmpd", "apache2", "nginx", "smbd"]
payload["InsecureServices"] = []
for svc in vuln_services:
    status = run_cmd(f"systemctl is-active {svc} 2>/dev/null")
    if status and status[0] == "active":
        payload["InsecureServices"].append(svc)

payload["ListeningPorts"] = run_cmd("ss -tulpn | awk '{print $1, $5, $7}' | tail -n +2")

payload["SUID_Binaries"] = run_cmd("find / -perm -4000 -type f 2>/dev/null | grep -v '/snap/'")
payload["CronJobs"] = run_cmd("ls -la /etc/cron.* /var/spool/cron/crontabs 2>/dev/null")

payload["WorldWritableConfigs"] = run_cmd("find /etc -perm -2 -type f 2>/dev/null")
payload["LD_Preload"] = run_cmd("cat /etc/ld.so.preload 2>/dev/null")

payload["ProhibitedFiles"] = run_cmd("find /home -type f \( -name '*.mp3' -o -name '*.mp4' -o -name '*.mkv' -o -name '*.exe' -o -name '*.bat' \) 2>/dev/null | head -n 15")

print(json.dumps(payload, indent=2))