import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DEFAULT_BASE_URL,
  DshApiError,
  resolveBridgeRuntimeConfig,
  resolveBaseUrl,
} from "../scripts/dsh-client.mjs";

async function withTempConfig(value, callback) {
  const directory = await mkdtemp(join(tmpdir(), "codex-dsh-bridge-"));
  const configPath = join(directory, "codex-dsh-bridge.json");
  try {
    if (value !== undefined) {
      await writeFile(configPath, typeof value === "string" ? value : JSON.stringify(value), "utf8");
    }
    return await callback(configPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("uses the default endpoint when no shared config exists", async () => {
  await withTempConfig(undefined, (configPath) => {
    const config = resolveBridgeRuntimeConfig({ env: {}, configPath });
    assert.equal(config.baseUrl.origin, DEFAULT_BASE_URL);
    assert.equal(config.source, "default");
  });
});

test("uses the endpoint mirrored by Harness settings", async () => {
  await withTempConfig({ enabled: true, baseUrl: "http://localhost:4090" }, (configPath) => {
    const config = resolveBridgeRuntimeConfig({ env: {}, configPath });
    assert.equal(config.baseUrl.origin, "http://localhost:4090");
    assert.equal(config.source, "harness-settings");
  });
});

test("DSH_BASE_URL overrides the shared endpoint", async () => {
  await withTempConfig({ enabled: true, baseUrl: "http://localhost:4090" }, (configPath) => {
    const config = resolveBridgeRuntimeConfig({
      env: { DSH_BASE_URL: "http://127.0.0.1:5090" },
      configPath,
    });
    assert.equal(config.baseUrl.origin, "http://127.0.0.1:5090");
    assert.equal(config.source, "environment");
  });
});

test("disabled Harness setting blocks requests even with an environment override", async () => {
  await withTempConfig({ enabled: false, baseUrl: DEFAULT_BASE_URL }, (configPath) => {
    assert.throws(
      () => resolveBridgeRuntimeConfig({
        env: { DSH_BASE_URL: "http://127.0.0.1:5090" },
        configPath,
      }),
      (error) => error instanceof DshApiError && error.code === "bridge-disabled",
    );
  });
});

test("rejects malformed shared JSON", async () => {
  await withTempConfig("{", (configPath) => {
    assert.throws(
      () => resolveBridgeRuntimeConfig({ env: {}, configPath }),
      (error) => error instanceof DshApiError && error.code === "invalid-bridge-config",
    );
  });
});

test("accepts only loopback HTTP origins with explicit ports", () => {
  assert.equal(resolveBaseUrl("http://127.0.0.1:3080").origin, "http://127.0.0.1:3080");
  assert.equal(resolveBaseUrl("http://localhost:3080/").origin, "http://localhost:3080");
  assert.equal(resolveBaseUrl("http://[::1]:3080").origin, "http://[::1]:3080");

  for (const value of [
    "https://127.0.0.1:3080",
    "http://192.168.1.10:3080",
    "http://user:pass@localhost:3080",
    "http://localhost:3080?x=1",
    "http://localhost:3080#x",
    "http://localhost:3080/api",
    "http://localhost",
  ]) {
    assert.throws(() => resolveBaseUrl(value), DshApiError, value);
  }
});
