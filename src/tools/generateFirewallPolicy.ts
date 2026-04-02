import { z } from "zod";
import { tool } from "ai";
import type { appendAuditLog } from "../utils/audit.js";

export const generateFirewallPolicyInputSchema = z.object({
  os: z.enum(["linux", "windows"]),
  allowedTcpPorts: z.array(z.number()).describe("List of authorized TCP ports (e.g., [22, 80])"),
  allowedUdpPorts: z.array(z.number()).describe("List of authorized UDP ports (e.g., [53, 123])"),
  blockAllOther: z.boolean().default(true).describe("Whether to set default policy to DENY/BLOCK all other traffic")
});

export type GenerateFirewallPolicyContext = {
  cwd: string;
  audit: typeof appendAuditLog;
  agent: string;
};

export function createGenerateFirewallPolicyTool(ctx: GenerateFirewallPolicyContext) {
  return tool({
    description: "Generate a platform-specific firewall hardening script (UFW or Netsh) based on authorized port whitelists.",
    parameters: generateFirewallPolicyInputSchema,
    execute: async ({ os, allowedTcpPorts, allowedUdpPorts, blockAllOther }) => {
      ctx.audit(ctx.cwd, {
        kind: "tool",
        agent: ctx.agent,
        payload: { tool: "generateFirewallPolicy", os, allowedTcpPorts, allowedUdpPorts },
      });

      if (os === "linux") {
        let script = "#!/bin/bash\n# Sintenel-CLI: UFW Hardening Script\n";
        script += "ufw --force reset\n";
        script += "ufw default deny incoming\n";
        script += "ufw default allow outbound\n";
        
        for (const port of allowedTcpPorts) {
          script += `ufw allow ${port}/tcp\n`;
        }
        for (const port of allowedUdpPorts) {
          script += `ufw allow ${port}/udp\n`;
        }
        
        script += "ufw --force enable\n";
        script += "ufw status verbose\n";

        return {
          ok: true as const,
          os: "linux",
          tool: "ufw",
          script,
          summary: `Generated UFW script allowing TCP(${allowedTcpPorts.join(",")}) and UDP(${allowedUdpPorts.join(",")}).`
        };
      } else {
        // Windows Netsh
        let script = "# Sintenel-CLI: Windows Firewall (Netsh) Hardening Script\n";
        script += "Set-NetFirewallProfile -Profile Domain,Public,Private -Enabled True\n";
        
        if (blockAllOther) {
          script += "Set-NetFirewallProfile -Profile Domain,Public,Private -DefaultInboundAction Block\n";
        }

        // Clear existing non-default rules (optional, risky for some environments, but CP usually wants a fresh start)
        // script += "Remove-NetFirewallRule -All\n"; 

        for (const port of allowedTcpPorts) {
          script += `New-NetFirewallRule -DisplayName \"Allow Authorized TCP ${port}\" -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow\n`;
        }
        for (const port of allowedUdpPorts) {
          script += `New-NetFirewallRule -DisplayName \"Allow Authorized UDP ${port}\" -Direction Inbound -LocalPort ${port} -Protocol UDP -Action Allow\n`;
        }

        return {
          ok: true as const,
          os: "windows",
          tool: "PowerShell (NetSecurity)",
          script,
          summary: `Generated PowerShell firewall script allowing TCP(${allowedTcpPorts.join(",")}) and UDP(${allowedUdpPorts.join(",")}).`
        };
      }
    },
  });
}
