import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { SettingsConflictError } from "@deepseek-ai/dsh-settings";
import {
  createSettingsRouteHandler,
  MAX_SETTINGS_BODY_BYTES,
} from "../lib/settings-route.js";

function createSettings({
  value = { enabled: true, baseUrl: "http://127.0.0.1:3080" },
  revision = 2,
  writable = true,
} = {}) {
  let currentValue = structuredClone(value);
  let currentRevision = revision;
  return {
    writable,
    describe() {
      return [{
        ns: "codex-dsh-bridge",
        value: structuredClone(currentValue),
        revision: currentRevision,
      }];
    },
    async update(ns, patch, expectedRevision) {
      assert.equal(ns, "codex-dsh-bridge");
      if (expectedRevision !== currentRevision) {
        throw new SettingsConflictError(ns, expectedRevision, currentRevision);
      }
      currentValue = { ...currentValue, ...structuredClone(patch) };
      currentRevision += 1;
    },
  };
}

function request(method, body, headers = {}) {
  const req = Readable.from(body === undefined ? [] : [body]);
  req.method = method;
  req.headers = headers;
  return req;
}

function response() {
  return {
    status: undefined,
    headers: undefined,
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body += chunk;
    },
  };
}

async function invoke(handler, method, body, headers = {}) {
  const res = response();
  await handler(request(method, body, headers), res);
  return {
    status: res.status,
    headers: res.headers,
    body: JSON.parse(res.body),
  };
}

test("GET returns the current settings snapshot", async () => {
  const result = await invoke(
    createSettingsRouteHandler(createSettings()),
    "GET",
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    enabled: true,
    baseUrl: "http://127.0.0.1:3080",
    revision: 2,
    writable: true,
  });
  assert.equal(result.headers["cache-control"], "no-store");
});

test("PUT validates, normalizes, writes, and returns the next revision", async () => {
  const result = await invoke(
    createSettingsRouteHandler(createSettings()),
    "PUT",
    JSON.stringify({
      enabled: false,
      baseUrl: "http://localhost:3080/",
      revision: 2,
    }),
    { "content-type": "application/json" },
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    enabled: false,
    baseUrl: "http://localhost:3080",
    revision: 3,
    writable: true,
  });
});

test("route rejects unsupported methods and malformed requests", async () => {
  const handler = createSettingsRouteHandler(createSettings());
  const method = await invoke(handler, "POST");
  assert.equal(method.status, 405);
  assert.equal(method.headers.allow, "GET, PUT");

  const malformed = await invoke(
    handler,
    "PUT",
    "{",
    { "content-type": "application/json" },
  );
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error, "invalid-request");

  const wrongType = await invoke(
    handler,
    "PUT",
    "{}",
    { "content-type": "text/plain" },
  );
  assert.equal(wrongType.status, 400);
  assert.equal(wrongType.body.error, "invalid-request");
});

test("route rejects non-loopback endpoints and oversized bodies", async () => {
  const handler = createSettingsRouteHandler(createSettings());
  const invalidUrl = await invoke(
    handler,
    "PUT",
    JSON.stringify({
      enabled: true,
      baseUrl: "http://10.0.0.2:3080",
      revision: 2,
    }),
    { "content-type": "application/json" },
  );
  assert.equal(invalidUrl.status, 400);
  assert.equal(invalidUrl.body.error, "invalid-request");

  const oversized = await invoke(
    handler,
    "PUT",
    "x".repeat(MAX_SETTINGS_BODY_BYTES + 1),
    { "content-type": "application/json" },
  );
  assert.equal(oversized.status, 413);
  assert.equal(oversized.body.error, "body-too-large");
});

test("route reports a stale revision without overwriting current settings", async () => {
  const result = await invoke(
    createSettingsRouteHandler(createSettings({ revision: 4 })),
    "PUT",
    JSON.stringify({
      enabled: false,
      baseUrl: "http://localhost:3080",
      revision: 3,
    }),
    { "content-type": "application/json" },
  );
  assert.equal(result.status, 409);
  assert.equal(result.body.error, "settings-conflict");
  assert.deepEqual(result.body.current, {
    enabled: true,
    baseUrl: "http://127.0.0.1:3080",
    revision: 4,
    writable: true,
  });
});
