import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

const execFileAsync = promisify(execFile);

/**
 * Self-healing logic for CyberPatriot images.
 */
export async function selfHealSystem() {
  if (process.platform !== "win32") return;

  try {
    // 1. Check if cmd.exe is blocked (Wait max 3s to avoid hanging)
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 3000);
    try {
        await execFileAsync("cmd.exe", ["/c", "exit", "0"], { signal: ac.signal });
    } finally {
        clearTimeout(timeout);
    }
  } catch (err: any) {
    if (err.name === "AbortError" || err.code === "ENOENT" || err.message.includes("find the file specified") || err.message.includes("denied")) {
        console.log(chalk.yellow("◈ [SYSTEM] Detected cmd.exe restriction or hang. Attempting self-healing via PowerShell..."));
        
        try {
            await execFileAsync("powershell.exe", [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "& { Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name 'DisableCMD' -Value 0 -ErrorAction SilentlyContinue }"
            ], { signal: AbortSignal.timeout(5000) });
            
            console.log(chalk.green("◈ [SYSTEM] Registry repair attempted."));
        } catch (healErr) {}
    }
  }

  // 2. Check for DisableRegistryTools
  try {
      await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "& { Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System' -Name 'DisableRegistryTools' -Value 0 -ErrorAction SilentlyContinue }"
      ], { signal: AbortSignal.timeout(5000) });
  } catch {}
}
