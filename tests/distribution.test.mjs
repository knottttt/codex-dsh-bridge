import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

test("repository exposes an installable Codex marketplace", async () => {
  const marketplace = await readJson("../.agents/plugins/marketplace.json");
  assert.equal(marketplace.name, "codex-dsh-bridge");
  assert.deepEqual(marketplace.interface, {
    displayName: "Codex DSH Bridge",
  });
  assert.equal(marketplace.plugins.length, 1);

  const [entry] = marketplace.plugins;
  assert.equal(entry.name, "codex-dsh-bridge");
  assert.deepEqual(entry.source, {
    source: "url",
    url: "https://github.com/knottttt/codex-dsh-bridge.git",
  });
  assert.deepEqual(entry.policy, {
    installation: "AVAILABLE",
    authentication: "ON_INSTALL",
  });
  assert.equal(entry.category, "Productivity");
});

test("repository root is an installable DSH bundle package", async () => {
  const packageJson = await readJson("../package.json");
  assert.equal(packageJson.name, "codex-dsh-bridge-companion");
  assert.equal(
    packageJson.dsh.bundle.patch,
    "./dsh-plugin/cordis.patch.yml",
  );
  assert.equal(
    packageJson.exports["./client"],
    "./dsh-plugin/lib/client.js",
  );
});

test("beginner install scripts do not contain machine-specific user paths", async () => {
  const installScript = await readFile(
    new URL("../install.ps1", import.meta.url),
    "utf8",
  );
  const uninstallScript = await readFile(
    new URL("../uninstall.ps1", import.meta.url),
    "utf8",
  );
  const combined = `${installScript}\n${uninstallScript}`;

  assert.doesNotMatch(combined, /C:\\Users\\/i);
  assert.match(combined, /knottttt\/codex-dsh-bridge/);
});
