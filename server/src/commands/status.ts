import { getOutputs } from "../lib/terraform.js";
import { ssh, wireguardPort } from "../lib/wireguard.js";

export async function status() {
  const outputs = getOutputs();
  console.log(`Server: ${outputs.serverIp}`);
  console.log(`SSH: ${outputs.sshUser}@${outputs.serverIp}`);
  console.log(`WireGuard UDP: ${wireguardPort}`);

  const wgStatus = ssh([], "sudo wg show wg0");
  const serviceStatus = ssh([], "systemctl is-active wg-quick@wg0");

  console.log(`Service: ${serviceStatus}`);
  console.log(wgStatus);
}
