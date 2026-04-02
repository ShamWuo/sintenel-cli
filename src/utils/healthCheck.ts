import { execSync } from "node:child_process";

export interface HealthStatus {
  healthy: boolean;
  reason?: string;
  details?: Record<string, any>;
}

export function checkServiceHealth(serviceName: string, platform: string): HealthStatus {
  try {
    if (platform === "win32") {
      const status = execSync(`powershell -Command "(Get-Service ${serviceName}).Status"`, { encoding: "utf8" }).trim();
      if (status !== "Running") {
        return { healthy: false, reason: `Service ${serviceName} is ${status}` };
      }
    } else {
      const status = execSync(`systemctl is-active ${serviceName}`, { encoding: "utf8" }).trim();
      if (status !== "active") {
        return { healthy: false, reason: `Service ${serviceName} is ${status}` };
      }
    }
    return { healthy: true };
  } catch (err) {
    return { healthy: false, reason: `Failed to check service: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function checkPortHealth(port: number): HealthStatus {
  try {
    if (process.platform === "win32") {
      const output = execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue"`, { encoding: "utf8" });
      if (!output) return { healthy: false, reason: `No listener on port ${port}` };
    } else {
      const output = execSync(`ss -tulpn | grep ":${port} "`, { encoding: "utf8" });
      if (!output) return { healthy: false, reason: `No listener on port ${port}` };
    }
    return { healthy: true };
  } catch {
    return { healthy: false, reason: `Verification failed for port ${port}` };
  }
}
