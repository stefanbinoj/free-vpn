import { Listr } from "listr2";
import pc from "picocolors";
import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { withTiming } from "../lib/listr-utils.js";

export async function down() {
  const tasks = new Listr(
    [
      {
        title: "Disconnecting local tunnel",
        task: withTiming("Disconnecting local tunnel", async () => {
          // Local teardown is best-effort: the tunnel may already be down
          // (user never ran vpn:connect, or ran vpn:disconnect earlier), or
          // sudo credentials may be unavailable. Never let it block the
          // terraform destroy — that's the only way to stop cloud charges.
          try {
            await disconnectLocalClient();
          } catch {
            // Best-effort; skip silently.
          }
        }),
      },
      {
        title: "Destroy cloud infrastructure",
        task: withTiming("Destroy cloud infrastructure", () =>
          terraform(["destroy", "-auto-approve"]),
        ),
      },
    ],
    { concurrent: false, exitOnError: true, renderer: "simple" },
  );

  try {
    await tasks.run();

    console.log("");
    console.log(`  ┌  ${pc.green(pc.bold("✓ VPN teardown complete"))}`);
    console.log("  │");
    console.log(`  │  ${pc.dim("All cloud resources destroyed.")}`);
    console.log(`  │  ${pc.dim("Local tunnel disconnected.")}`);
    console.log("  └");
    console.log("");
  } catch {
    // listr2 already rendered the failure inline under the failed task.
    // Just exit non-zero.
    process.exit(1);
  }
}
