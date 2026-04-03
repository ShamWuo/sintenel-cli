export type CommandPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string };
const ALLOWLIST: RegExp[] = [
  // Recon/read-only (Windows & Core)
  /^\s*Get-(ChildItem|Content|Item|ItemProperty|Service|Process|LocalUser|LocalGroup|LocalGroupMember|ScheduledTask|WmiObject|CimInstance)\b/i,
  /^\s*(dir|ls|cat|type|Select-String|findstr|grep|find)\b/i,
  /^\s*(netstat|ipconfig|whoami|where|hostname|tasklist|systeminfo)\b/i,
  /^\s*net\s+(user|localgroup|accounts|session|share|statistics)\b/i,
  // Recon/read-only (Linux)
  /^\s*(ps|top|htop|df|du|free|uptime|last|id|uname|ifconfig|ip|ss|nmcli)\b/i,
  /^\s*(systemctl\s+list-units|ufw\s+status|iptables\s+-L)\b/i,
  // Remediation/Config (Windows)
  /^\s*(Disable|Enable|Set)-LocalUser\b/i,
  /^\s*(Stop|Start|Restart|Set)-Service\b/i,
  /^\s*Set-(SmbServerConfiguration|ItemProperty|ExecutionPolicy)\b/i,
  /^\s*Remove-LocalGroupMember\b/i,
  /^\s*netsh\s+advfirewall\b/i,
  /^\s*sc\s+(config|start|stop|query)\b/i,
  /^\s*attrib\b/i,
  /^\s*takeown\b/i,
  /^\s*icacls\b/i,
  // Remediation/Config (Linux)
  /^\s*(systemctl\s+(enable|disable|start|stop|restart)|ufw\s+(enable|disable|allow|deny|limit))\b/i,
  /^\s*(chmod|chown|chgrp|passwd|useradd|userdel|usermod|groupadd|groupdel)\b/i,
  /^\s*(apt|apt-get|yum|dnf)\s+(install|remove|update|upgrade)\b/i,
  // Dev verification workflows
  /^\s*npm\s+(run|test|audit|outdated|list)\b/i,
  /^\s*node\b/i,
  /^\s*npx\s+tsc\b/i,
  /^\s*git\s+(status|diff|log)\b/i,
];

const HIGH_RISK_TOKENS: RegExp[] = [
  /\bInvoke-WebRequest\b/i,
  /\bStart-BitsTransfer\b/i,
  /\bcurl\b/i,
  /\bcertutil\b/i,
  /\bscp\b/i,
  /\bssh\b/i,
  /\bplink\b/i,
  /\bftp\b/i,
  /\btftp\b/i,
  /\breg(?:\.exe)?\s+(add|delete|import)\b/i,
  /\bNew-LocalUser\b/i,
  /\bAdd-LocalGroupMember\b/i,
];

export function evaluateCommandPolicy(command: string): CommandPolicyDecision {
  const cmd = command.trim();
  if (!cmd) {
    return { allowed: false, reason: "Empty command is not allowed" };
  }

  for (const rx of HIGH_RISK_TOKENS) {
    if (rx.test(cmd)) {
      return {
        allowed: false,
        reason: `Blocked high-risk token: ${rx.source}`,
      };
    }
  }

  const allowed = ALLOWLIST.some((rx) => rx.test(cmd));
  if (!allowed) {
    return {
      allowed: false,
      reason:
        "Command not in policy allowlist. Update policy explicitly before executing this class of command.",
    };
  }

  return { allowed: true };
}
