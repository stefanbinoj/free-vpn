import { Listr } from "listr2";
import pc from "picocolors";
import { errorMessage, run } from "../lib/shell.js";
import { getOutputs } from "../lib/terraform.js";
import { warn } from "../lib/console.js";
import { withTiming } from "../lib/listr-utils.js";
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
        task: withTiming("Get server info", async () => {
          state.outputs = await getOutputs();
        }),
      },
      {
        title: "Fetch public IP",
        task: async (_ctx, task) => {
          try {
            const result = await run("curl", ["-s", "ipinfo.io"], { quiet: true });
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
        task: withTiming("Get WireGuard status", async () => {
          state.wgStatus = await ssh([], "sudo wg show wg0");
        }),
      },
    ],
    { concurrent: false, exitOnError: true, renderer: "simple" },
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
  console.log("");
  console.log(`  ┌  ${pc.green(pc.bold("✓ VPN status"))}`);
  console.log("  │");

  if (state.outputs) {
    console.log(`  │  ${pc.dim("Server")}     ${state.outputs.sshUser}@${state.outputs.serverIp}`);
  }
  if (state.publicIp) {
    const loc = state.publicLocation ? ` (${state.publicLocation})` : "";
    console.log(`  │  ${pc.dim("Public IP")}  ${state.publicIp}${loc}`);
  }

  if (state.wgStatus) {
    console.log("  │");
    console.log(`  │  ${pc.dim("WireGuard")}`);
    for (const line of state.wgStatus.split("\n")) {
      if (line.trim()) console.log(`  │    ${line}`);
    }
  }

  console.log("  └");
  console.log("");
}
