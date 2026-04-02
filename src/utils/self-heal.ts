import { execFile } from "node:child_process";
import { promisify } from "node:util";
import chalk from "chalk";

const execFileAsync = promisify(execFile);

/**
 * Self-healing logic for CyberPatriot images.
 * Detects and bypasses common malware/hardening restrictions like DisableCMD.
 */
export async function selfHealSystem() {
  if (process.platform !== "win32") return;

  try {
    // 1. Check if cmd.exe is blocked
    await execFileAsync("cmd.exe", ["/c", "exit", "0"]);
  } catch (err: any) {
    if (err.code === "ENOENT" || err.message.includes("find the file specified") || err.message.includes("denied")) {
        console.log(chalk.yellow("◈ [SYSTEM] Detected cmd.exe restriction. Attempting self-healing via PowerShell..."));
        
        try {
            // Fix DisableCMD registry key
            await execFileAsync("powershell.exe", [
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                'Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableCMD" -Value 0 -ErrorAction SilentlyContinue; ' +
                'Set-ItemProperty -Path "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableCMD" -Value 0 -ErrorAction SilentlyContinue'
            ]);
            
            // Verify fix
            await execFileAsync("cmd.exe", ["/c", "exit", "0"]);
            console.log(chalk.green("◈ [SYSTEM] Success! cmd.exe has been restored."));
        } catch (healErr) {
            console.log(chalk.red("◈ [SYSTEM] Self-healing failed. You may need Manual Admin intervention for DisableCMD."));
        }
    }
  }

  // 2. Check for DisableRegistryTools (regedit)
  try {
      await execFileAsync("powershell.exe", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          'Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableRegistryTools" -Value 0 -ErrorAction SilentlyContinue'
      ]);
  } catch {}
}
