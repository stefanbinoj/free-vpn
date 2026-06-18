import { getOutputs } from "../lib/terraform.js";
import { run } from "../lib/shell.js";
import { ssh  } from "../lib/wireguard.js";

export async function status() {
  const outputs = getOutputs();
  console.log(`SSH: ${outputs.sshUser}@${outputs.serverIp}`);

  run("curl", ["-s", "ipinfo.io"]);

  const wgStatus = ssh([], "sudo wg show wg0");

  console.log(wgStatus);

}
