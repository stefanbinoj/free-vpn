import { Listr } from "listr2";
import pc from "picocolors";
import { errorMessage, run } from "../lib/shell.js";
import { getOutputs } from "../lib/terraform.js";
import { info, warn } from "../lib/console.js";
import { ssh } from "../lib/wireguard.js";

type Outputs = { serverIp: string; sshUser: string; sshPrivateKeyPath: string };

export async function status() {
  const state: {
    outputs?: Outputs;
    publicIp?: string;
    publicLocation?: string;
    wgStatus?: string;
  } = {};

  const tasks = new Listr(
    [
      {
        title: "Get server info",
        task: async () => {
          state.outputs = getOutputs();
        },
      },
      {
        title: "Fetch public IP",
        task: async (_ctx, task) => {
          try {
            const result = run("curl", ["-s", "ipinfo.io"], { quiet: true });
            const data = JSON.parse(result);
            state.publicIp = data.ip;
            state.publicLocation = `${data.city}, ${data.country}`;
            task.title = `Public IP: ${data.ip} (${data.city}, ${data.country})`;
          } catch (err) {
            warn(`Could not fetch public IP: ${errorMessage(err)}`);
            task.title = "Public IP: unavailable";
          }
        },
      },
      {
        title: "Get WireGuard status",
        task: async () => {
          state.wgStatus = ssh([], "sudo wg show wg0");
        },
      },
    ],
    { concurrent: false, exitOnError: true },
  );

  try {
    await tasks.run();
  } catch {
    // listr2 already rendered the failure inline under the failed task.
    // Just exit non-zero.
    process.exit(1);
  }

  showSummary(state);
}

function showSummary(state: {
  outputs?: Outputs;
  publicIp?: string;
  publicLocation?: string;
  wgStatus?: string;
}) {
  info("");
  if (state.outputs) {
    info(`  ${pc.dim("Server")}     ${state.outputs.sshUser}@${state.outputs.serverIp}`);
  }
  if (state.publicIp) {
    const loc = state.publicLocation ? ` (${state.publicLocation})` : "";
    info(`  ${pc.dim("Public IP")}  ${state.publicIp}${loc}`);
  }
  if (state.wgStatus) {
    info("");
    info(pc.dim("  WireGuard"));
    for (const line of state.wgStatus.split("\n")) {
      if (line.trim()) info(`  ${line}`);
    }
  }
  info("");
}
