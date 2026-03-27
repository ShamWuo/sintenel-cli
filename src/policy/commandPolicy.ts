export type CommandPolicyDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

const ALLOWLIST: RegExp[] = [
  // Recon/read-only
  /^\s*Get-ChildItem\b/i,
  /^\s*dir\b/i,
  /^\s*ls\b/i,
  /^\s*Get-Content\b/i,
  /^\s*cat\b/i,
  /^\s*type\b/i,
  /^\s*Select-String\b/i,
  /^\s*netstat\b/i,
  /^\s*ipconfig\b/i,
  /^\s*whoami\b/i,
  /^\s*where\b/i,
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
