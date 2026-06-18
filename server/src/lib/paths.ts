import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const infraDir = resolve(repoRoot, "infra");
export const configsDir = resolve(repoRoot, "configs");
export const clientConfigPath = resolve(configsDir, "wg-client.conf");
