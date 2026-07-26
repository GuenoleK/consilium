import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const tailscaleCandidates = [
  "tailscale",
  `${process.env.ProgramFiles || "C:\\Program Files"}\\Tailscale\\tailscale.exe`,
];

export interface RemoteAccessStatus {
  available: boolean;
  enabled: boolean;
  url?: string;
}

export async function getRemoteAccessStatus(): Promise<RemoteAccessStatus> {
  for (const command of tailscaleCandidates) {
    try {
      const { stdout } = await execFileAsync(command, ["serve", "status"], {
        timeout: 2_500,
        windowsHide: true,
      });
      const url = stdout.match(/https:\/\/[^\s]+/)?.[0];
      const enabled = stdout.includes("proxy http://127.0.0.1:5173") || stdout.includes("proxy http://localhost:5173");
      return { available: true, enabled, url: enabled ? url : undefined };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") return { available: true, enabled: false };
    }
  }

  return { available: false, enabled: false };
}
