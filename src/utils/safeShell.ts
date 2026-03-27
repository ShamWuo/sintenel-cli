/**
 * Blocks obviously destructive or system-wide wipe patterns for PowerShell/cmd.
 * This is defense-in-depth; never rely on regex alone for security.
 */

const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\brm\s+(-[rf]+\s+)+/i,
  /\bformat\.exe\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdel\s+\/s\s+\/q\b/i,
  /\brmdir\s+\/s\s+\/q\b/i,
  /\bclear-recyclebin\b/i,
  /\bClear-RecycleBin\b/i,
  /\bStop-Computer\b/i,
  /\bRestart-Computer\b/i,
  /\bshutdown\b/i,
  /\bInvoke-WebRequest\b.*-OutFile\s+['"]?\\\\\.\\PhysicalDrive/i,
  /\bdd\s+if=/i,
  /\bmkfs\./i,
  /\b:w\s*!\s*sudo\s+rm\s+-rf\b/i,
  /\b[System\.IO\.File]::WriteAllBytes\b.*\\Device\\Harddisk/i,
  /\breg(\.exe)?\s+delete\b/i,
  /\bcipher\s+\/w:/i,
  /\bdiskpart\b/i,
  /\b-EncodedCommand\b/i,
  /\bInvoke-Expression\b/i,
  /\biex\s+/i,
  /\bStart-Process\b/i,
  /\bpowershell(\.exe)?\b/i,
  /\bcmd(\.exe)?\b\s+\/c\b/i,
  /\bSet-ExecutionPolicy\b/i,
];

const HIGH_RISK_PATHS =
  /\b([Cc]:\\Windows\\System32|[Cc]:\\Windows\\SysWOW64|\\\\\.\\|[\s;|&]rm\s+-rf)/i;

export type SafeCheckResult =
  | { ok: true }
  | { ok: false; reason: string; matchedPattern?: string };

export function assertSafePowerShellCommand(command: string): SafeCheckResult {
  const trimmed = command.trim();
  if (!trimmed) {
    return { ok: false, reason: "Empty command" };
  }

  if (/[\r\n]/.test(trimmed)) {
    return { ok: false, reason: "Multiline commands are not allowed" };
  }

  if (/[;]/.test(trimmed) || /&&|\|\|/.test(trimmed)) {
    return { ok: false, reason: "Command chaining operators are not allowed" };
  }

  if (/\$\(.+\)/.test(trimmed)) {
    return { ok: false, reason: "Command substitution is not allowed" };
  }

  for (const re of DANGEROUS_PATTERNS) {
    if (re.test(trimmed)) {
      return {
        ok: false,
        reason: "Command matches blocked destructive pattern",
        matchedPattern: re.source,
      };
    }
  }

  if (HIGH_RISK_PATHS.test(trimmed)) {
    return {
      ok: false,
      reason: "Command references high-risk system paths or devices",
    };
  }

  return { ok: true };
}
