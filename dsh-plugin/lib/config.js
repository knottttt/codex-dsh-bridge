import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const BRIDGE_CONFIG_FILENAME = "codex-dsh-bridge.json";
export const DEFAULT_BASE_URL = "http://127.0.0.1:3080";
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function resolveBridgeConfigPath({
  env = process.env,
  homeDir = homedir(),
} = {}) {
  const dshHome = typeof env.DSH_HOME === "string" && env.DSH_HOME.trim().length > 0
    ? resolve(env.DSH_HOME.trim())
    : join(homeDir, ".dsh");
  return join(dshHome, BRIDGE_CONFIG_FILENAME);
}

export function normalizeLoopbackBaseUrl(rawValue) {
  let url;
  try {
    url = new URL(rawValue);
  } catch {
    throw new TypeError("Endpoint must be a valid URL.");
  }
  if (url.protocol !== "http:") {
    throw new TypeError("Endpoint must use http://.");
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new TypeError("Endpoint must use localhost or a loopback address.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("Endpoint cannot contain credentials, query parameters, or a fragment.");
  }
  if (url.pathname !== "/" || !url.port) {
    throw new TypeError("Endpoint must be a loopback origin with an explicit port.");
  }
  return url.origin;
}

export function normalizeBridgeConfig(value) {
  return {
    enabled: value.enabled !== false,
    baseUrl: normalizeLoopbackBaseUrl(value.baseUrl ?? DEFAULT_BASE_URL),
  };
}

export async function writeBridgeConfigAtomic(
  value,
  {
    configPath = resolveBridgeConfigPath(),
    nonce = `${process.pid}-${Date.now()}`,
  } = {},
) {
  const normalized = normalizeBridgeConfig(value);
  const directory = dirname(configPath);
  const temporaryPath = `${configPath}.${nonce}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporaryPath, configPath);
  return { configPath, value: normalized };
}
