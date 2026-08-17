import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  normalizeLoopbackBaseUrl,
  writeBridgeConfigAtomic,
} from "../lib/config.js";

test("atomically writes normalized shared config", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codex-dsh-companion-"));
  const configPath = join(directory, "nested", "codex-dsh-bridge.json");
  try {
    const result = await writeBridgeConfigAtomic(
      { enabled: true, baseUrl: "http://localhost:3080/" },
      { configPath, nonce: "test" },
    );
    assert.deepEqual(result.value, {
      enabled: true,
      baseUrl: "http://localhost:3080",
    });
    assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), result.value);
    await assert.rejects(readFile(`${configPath}.test.tmp`, "utf8"), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("host validation rejects non-loopback and non-origin URLs", () => {
  for (const value of [
    "https://localhost:3080",
    "http://10.0.0.2:3080",
    "http://localhost:3080/api",
    "http://localhost:3080?x=1",
    "http://localhost",
  ]) {
    assert.throws(() => normalizeLoopbackBaseUrl(value), TypeError, value);
  }
});
