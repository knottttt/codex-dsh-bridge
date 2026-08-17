import {
  SettingsConflictError,
  settingsNamespace,
} from "@deepseek-ai/dsh-settings";
import { normalizeBridgeConfig } from "./config.js";

export const SETTINGS_ROUTE_PATH = "/plugins/codex-dsh-bridge-companion/settings";
export const MAX_SETTINGS_BODY_BYTES = 4096;

const BRIDGE_SETTINGS_NAMESPACE = settingsNamespace("codex-dsh-bridge");

function writeJson(res, status, body, extraHeaders = {}) {
  const payload = `${JSON.stringify(body)}\n`;
  res.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function descriptorFor(settings) {
  return settings.describe({ redactSecrets: true })
    .find((descriptor) => descriptor.ns === BRIDGE_SETTINGS_NAMESPACE);
}

function publicSnapshot(settings) {
  const descriptor = descriptorFor(settings);
  if (descriptor === undefined) {
    throw new Error('settings namespace "codex-dsh-bridge" is not registered');
  }
  const value = normalizeBridgeConfig(descriptor.value);
  return {
    ...value,
    revision: descriptor.revision,
    writable: settings.writable === true,
  };
}

function parseContentLength(req) {
  const raw = req.headers?.["content-length"];
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d+$/.test(value)) throw new TypeError("Invalid Content-Length.");
  return Number(value);
}

async function readJsonBody(req, maxBytes) {
  const contentType = req.headers?.["content-type"];
  const normalizedContentType = Array.isArray(contentType) ? contentType[0] : contentType;
  if (
    typeof normalizedContentType !== "string"
    || !normalizedContentType.toLowerCase().startsWith("application/json")
  ) {
    throw new TypeError("Content-Type must be application/json.");
  }

  const contentLength = parseContentLength(req);
  if (contentLength !== undefined && contentLength > maxBytes) {
    const error = new RangeError("Request body is too large.");
    error.code = "BODY_TOO_LARGE";
    throw error;
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const error = new RangeError("Request body is too large.");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(buffer);
  }

  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new TypeError("Request body must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("Request body must be a JSON object.");
  }
  return parsed;
}

function normalizeUpdate(body) {
  for (const key of Object.keys(body)) {
    if (!["enabled", "baseUrl", "revision"].includes(key)) {
      throw new TypeError(`Unknown setting "${key}".`);
    }
  }
  if (typeof body.enabled !== "boolean") {
    throw new TypeError('"enabled" must be a boolean.');
  }
  if (typeof body.baseUrl !== "string") {
    throw new TypeError('"baseUrl" must be a string.');
  }
  if (!Number.isSafeInteger(body.revision) || body.revision < 0) {
    throw new TypeError('"revision" must be a non-negative integer.');
  }
  return {
    revision: body.revision,
    value: normalizeBridgeConfig({
      enabled: body.enabled,
      baseUrl: body.baseUrl,
    }),
  };
}

export function createSettingsRouteHandler(settings, {
  maxBodyBytes = MAX_SETTINGS_BODY_BYTES,
} = {}) {
  return async (req, res) => {
    if (req.method === "GET") {
      try {
        writeJson(res, 200, publicSnapshot(settings));
      } catch (error) {
        writeJson(res, 500, {
          error: "settings-unavailable",
          message: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (req.method !== "PUT") {
      writeJson(res, 405, {
        error: "method-not-allowed",
        message: "Use GET or PUT.",
      }, { allow: "GET, PUT" });
      return;
    }

    let update;
    try {
      update = normalizeUpdate(await readJsonBody(req, maxBodyBytes));
    } catch (error) {
      const tooLarge = error?.code === "BODY_TOO_LARGE";
      writeJson(res, tooLarge ? 413 : 400, {
        error: tooLarge ? "body-too-large" : "invalid-request",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    try {
      await settings.update(
        BRIDGE_SETTINGS_NAMESPACE,
        update.value,
        update.revision,
      );
      writeJson(res, 200, publicSnapshot(settings));
    } catch (error) {
      if (
        error instanceof SettingsConflictError
        || error?.code === "SETTINGS_CONFLICT"
      ) {
        writeJson(res, 409, {
          error: "settings-conflict",
          message: error instanceof Error ? error.message : String(error),
          current: publicSnapshot(settings),
        });
        return;
      }
      writeJson(res, 400, {
        error: "settings-rejected",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}
