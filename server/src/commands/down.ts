import { Listr } from "listr2";
import { terraform } from "../lib/terraform.js";
import { disconnectLocalClient } from "../lib/local-client.js";
import { errorMessage } from "../lib/shell.js";
import { success, warn } from "../lib/console.js";

export async function down() {
  const tasks = new Listr(
    [
      {
        title: "Disconnect local tunnel",
        task: async () => {
          // Local teardown is best-effort: the tunnel may already be down
          // (user never ran vpn:connect, or ran vpn:disconnect earlier), or
          // sudo credentials may be unavailable. Never let it block the
          // terraform destroy — that's the only way to stop AWS charges.
          try {
            disconnectLocalClient();
          } catch (err) {
          }
        },
      },
      {
        title: "Destroy AWS infrastructure",
        task: async () => {
          terraform(["destroy", "-auto-approve"]);
        },
      },
    ],
    { concurrent: false, exitOnError: true },
  );

  try {
    await tasks.run();
    success("\n✓ VPN teardown complete\n");
  } catch {
    // listr2 already rendered the failure inline under the failed task.
    // Just exit non-zero.
    process.exit(1);
  }
}
