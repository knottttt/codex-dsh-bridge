import assert from "node:assert/strict";
import test from "node:test";

test("client bundle registers a lazy module exposing inject and apply", async () => {
  let definition;
  globalThis.window = {
    __ModuleLoader__: {
      load(value) {
        definition = value;
      },
    },
  };
  try {
    await import(`../lib/client.js?test=${Date.now()}`);
    assert.equal(definition.id, "codex-dsh-bridge-companion");
    const React = {
      createElement() {},
      useEffect() {},
      useState() {},
    };
    const loaded = definition.factory((name) => {
      assert.equal(name, "react");
      return React;
    });
    assert.deepEqual(loaded.inject, ["slots", "locale"]);
    assert.equal(typeof loaded.apply, "function");
  } finally {
    delete globalThis.window;
  }
});
