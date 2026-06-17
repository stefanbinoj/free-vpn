import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, "../../..");
export const infraDir = resolve(repoRoot, "infra");
export const configsDir = resolve(repoRoot, "configs");
export const logsDir = resolve(repoRoot, "logs");
export const clientConfigPath = resolve(configsDir, "wg-client.conf");
