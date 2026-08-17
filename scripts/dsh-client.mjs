import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const DEFAULT_BASE_URL = "http://127.0.0.1:3080";
export const BRIDGE_CONFIG_FILENAME = "codex-dsh-bridge.json";
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_HISTORY_MESSAGES = 100;
const MAX_WAIT_TIMEOUT_MS = 300_000;
const DEFAULT_WAIT_TIMEOUT_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MAX_TEXT_LENGTH = 24_000;

export class DshApiError extends Error {
  constructor(message, { code = "dsh-api-error", details, cause } = {}) {
    super(message, { cause });
    this.name = "DshApiError";
    this.code = code;
    this.details = details;
  }
}

function asInteger(value, fallback, min, max) {
  if (value === undefined || value === null) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new DshApiError(`Expected an integer between ${min} and ${max}.`, {
      code: "invalid-argument",
      details: { value, min, max },
    });
  }
  return parsed;
}

function asNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DshApiError(`${name} must be a non-empty string.`, {
      code: "invalid-argument",
    });
  }
  return value.trim();
}

function truncateText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n…[truncated ${value.length - maxLength} characters]`;
}

function contentToText(content) {
  if (!Array.isArray(content)) {
    return "";
  }
  return truncateText(
    content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n"),
  );
}

export function resolveConfigPath({
  env = process.env,
  homeDir = homedir(),
} = {}) {
  const dshHome = typeof env.DSH_HOME === "string" && env.DSH_HOME.trim().length > 0
    ? resolve(env.DSH_HOME.trim())
    : join(homeDir, ".dsh");
  return join(dshHome, BRIDGE_CONFIG_FILENAME);
}

export function readBridgeConfig({
  configPath = resolveConfigPath(),
} = {}) {
  let raw;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw new DshApiError(`Cannot read Codex DSH Bridge config at ${configPath}.`, {
      code: "bridge-config-read-failed",
      cause: error,
      details: { configPath },
    });
  }

  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new DshApiError(`Codex DSH Bridge config is not valid JSON: ${configPath}`, {
      code: "invalid-bridge-config",
      cause: error,
      details: { configPath },
    });
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new DshApiError("Codex DSH Bridge config must be a JSON object.", {
      code: "invalid-bridge-config",
      details: { configPath },
    });
  }
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") {
    throw new DshApiError('Codex DSH Bridge config field "enabled" must be boolean.', {
      code: "invalid-bridge-config",
      details: { configPath },
    });
  }
  if (value.baseUrl !== undefined && typeof value.baseUrl !== "string") {
    throw new DshApiError('Codex DSH Bridge config field "baseUrl" must be a string.', {
      code: "invalid-bridge-config",
      details: { configPath },
    });
  }
  return value;
}

export function resolveBaseUrl(rawValue = DEFAULT_BASE_URL) {
  let url;
  try {
    url = new URL(rawValue);
  } catch (error) {
    throw new DshApiError("DSH_BASE_URL must be a valid URL.", {
      code: "invalid-base-url",
      cause: error,
    });
  }

  if (url.protocol !== "http:") {
    throw new DshApiError("DSH_BASE_URL must use http:// for the local DSH service.", {
      code: "invalid-base-url",
      details: { protocol: url.protocol },
    });
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new DshApiError("DSH_BASE_URL must point to localhost or a loopback address.", {
      code: "non-loopback-base-url",
      details: { hostname: url.hostname },
    });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new DshApiError("DSH_BASE_URL cannot contain credentials, query parameters, or a fragment.", {
      code: "invalid-base-url",
    });
  }
  if (url.pathname !== "/" || !url.port) {
    throw new DshApiError("DSH_BASE_URL must be a loopback origin with an explicit port.", {
      code: "invalid-base-url",
      details: { pathname: url.pathname, port: url.port },
    });
  }

  return url;
}

export function resolveBridgeRuntimeConfig({
  baseUrl,
  env = process.env,
  configPath = resolveConfigPath({ env }),
} = {}) {
  const shared = readBridgeConfig({ configPath });
  if (shared.enabled === false) {
    throw new DshApiError("Codex DSH Bridge is disabled in DeepSeek Harness settings.", {
      code: "bridge-disabled",
      details: { configPath },
    });
  }

  const selectedBaseUrl = baseUrl
    ?? (typeof env.DSH_BASE_URL === "string" && env.DSH_BASE_URL.trim().length > 0
      ? env.DSH_BASE_URL.trim()
      : undefined)
    ?? shared.baseUrl
    ?? DEFAULT_BASE_URL;

  return {
    enabled: true,
    baseUrl: resolveBaseUrl(selectedBaseUrl),
    configPath,
    source: baseUrl !== undefined
      ? "constructor"
      : env.DSH_BASE_URL
        ? "environment"
        : shared.baseUrl
          ? "harness-settings"
          : "default",
  };
}

function sessionTitle(item) {
  const title = item?.projections?.values?.title;
  return typeof title === "string" && title.trim().length > 0 ? title : null;
}

export function summarizeSession(item) {
  return {
    sessionId: item.sessionId,
    title: sessionTitle(item),
    cwd: item.cwd ?? null,
    agentPreset: item.agentPreset ?? null,
    running: Boolean(item.running),
    blank: Boolean(item.blank),
    updatedAt: item.updatedAt,
    parentSessionId: item.parentSessionId ?? null,
    origin: item.origin ?? null,
    latestSeq: item?.projections?.asOfSeq ?? null,
  };
}

export function summarizeHistory(history, { afterSeq = -1 } = {}) {
  const entries = Array.isArray(history?.events) ? history.events : [];
  const messages = [];
  const terminalEvents = [];
  const errorEvents = [];
  let latestSeq = afterSeq;

  for (const entry of entries) {
    const event = entry?.event;
    if (!event || !Number.isInteger(event.seq)) {
      continue;
    }
    latestSeq = Math.max(latestSeq, event.seq);
    if (event.seq <= afterSeq) {
      continue;
    }

    if (event.type === "user/message" && event.data?.source?.kind === "user") {
      messages.push({
        seq: event.seq,
        time: event.time,
        role: "user",
        text: contentToText(event.data?.content),
        id: event.data?.id ?? null,
      });
      continue;
    }

    if (event.type === "assistant/message") {
      messages.push({
        seq: event.seq,
        time: event.time,
        role: "assistant",
        text: contentToText(event.data?.message?.content),
        id: event.data?.message?.id ?? null,
        turn: event.data?.turn ?? null,
      });
      continue;
    }

    if (event.type === "turn/end") {
      terminalEvents.push({
        seq: event.seq,
        time: event.time,
        turn: event.data?.turn ?? null,
        reason: event.data?.reason ?? null,
      });
      continue;
    }

    if (event.type.includes("error") || event.type.includes("failed")) {
      errorEvents.push({
        seq: event.seq,
        time: event.time,
        type: event.type,
        data: event.data ?? null,
      });
    }
  }

  return {
    messages,
    terminalEvents,
    errorEvents,
    latestSeq,
    hasMore: Boolean(history?.hasMore),
    projections: history?.projections ?? null,
  };
}

export class DshClient {
  constructor({
    baseUrl,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    env = process.env,
    configPath = resolveConfigPath({ env }),
  } = {}) {
    const runtimeConfig = resolveBridgeRuntimeConfig({ baseUrl, env, configPath });
    this.baseUrl = runtimeConfig.baseUrl;
    this.configPath = runtimeConfig.configPath;
    this.configSource = runtimeConfig.source;
    this.requestTimeoutMs = asInteger(requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 1_000, 60_000);
  }

  async rpc(method, payload = {}, { timeoutMs = this.requestTimeoutMs } = {}) {
    const rpcId = randomUUID();
    const endpoint = new URL(`/api/${encodeURIComponent(asNonEmptyString(method, "method"))}`, this.baseUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "client-request",
          rpcId,
          method,
          payload,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      throw new DshApiError(
        timedOut
          ? `DSH request timed out after ${timeoutMs} ms.`
          : `Cannot reach DSH at ${this.baseUrl.origin}. Start "npx @deepseek-ai/dsh web" first.`,
        {
          code: timedOut ? "request-timeout" : "connection-failed",
          cause: error,
          details: { baseUrl: this.baseUrl.origin },
        },
      );
    } finally {
      clearTimeout(timer);
    }

    const rawText = await response.text();
    let body;
    try {
      body = JSON.parse(rawText);
    } catch (error) {
      throw new DshApiError(`DSH returned non-JSON HTTP ${response.status}.`, {
        code: "invalid-response",
        cause: error,
        details: { status: response.status, body: truncateText(rawText, 2_000) },
      });
    }

    if (!response.ok) {
      throw new DshApiError(`DSH returned HTTP ${response.status}.`, {
        code: "http-error",
        details: { status: response.status, body },
      });
    }
    if (body?.type !== "server-response" || body.rpcId !== rpcId) {
      throw new DshApiError("DSH returned an invalid RPC envelope.", {
        code: "invalid-response",
        details: { body },
      });
    }
    if (body?.result?.ok !== true) {
      const error = body?.result?.error ?? {};
      throw new DshApiError(error.message ?? "DSH RPC failed.", {
        code: error.code ?? "dsh-rpc-error",
        details: error.details ?? {},
      });
    }
    return body.result.value;
  }

  describe() {
    return this.rpc("host.describe", {});
  }

  async listSessions({ cwd, title, running } = {}) {
    const value = await this.rpc("session.list", {});
    let items = Array.isArray(value?.items) ? value.items : [];

    if (typeof cwd === "string" && cwd.trim().length > 0) {
      const expected = cwd.trim().toLocaleLowerCase();
      items = items.filter((item) => item.cwd?.toLocaleLowerCase() === expected);
    }
    if (typeof title === "string" && title.trim().length > 0) {
      const expected = title.trim().toLocaleLowerCase();
      items = items.filter((item) => sessionTitle(item)?.toLocaleLowerCase().includes(expected));
    }
    if (typeof running === "boolean") {
      items = items.filter((item) => Boolean(item.running) === running);
    }

    return items.map(summarizeSession);
  }

  createSession({ cwd, workspaceId, sessionId, agentPreset } = {}) {
    if (cwd !== undefined && workspaceId !== undefined) {
      throw new DshApiError("Specify cwd or workspaceId, not both.", {
        code: "invalid-argument",
      });
    }
    const payload = {};
    if (cwd !== undefined) payload.cwd = asNonEmptyString(cwd, "cwd");
    if (workspaceId !== undefined) payload.workspaceId = asNonEmptyString(workspaceId, "workspaceId");
    if (sessionId !== undefined) payload.sessionId = asNonEmptyString(sessionId, "sessionId");
    if (agentPreset !== undefined) payload.agentPreset = asNonEmptyString(agentPreset, "agentPreset");
    return this.rpc("session.create", payload);
  }

  async sendMessage({ sessionId, text, mode = "queue", clientTimeZone = "Asia/Shanghai" }) {
    const before = await this.getMessages({ sessionId, maxMessages: 10 });
    if (mode !== "queue" && mode !== "steer") {
      throw new DshApiError('mode must be "queue" or "steer".', {
        code: "invalid-argument",
      });
    }
    const value = await this.rpc("session.prompt", {
      sessionId: asNonEmptyString(sessionId, "sessionId"),
      mode,
      content: [{ type: "text", text: asNonEmptyString(text, "text") }],
      clientTimeZone,
    });
    return {
      ...value,
      sessionId,
      mode,
      afterSeq: before.latestSeq,
    };
  }

  async getMessages({ sessionId, beforeSeq, maxMessages = 30, afterSeq = -1 }) {
    const payload = {
      sessionId: asNonEmptyString(sessionId, "sessionId"),
      maxMessages: asInteger(maxMessages, 30, 1, MAX_HISTORY_MESSAGES),
    };
    if (beforeSeq !== undefined) {
      payload.beforeSeq = asInteger(beforeSeq, undefined, 0, Number.MAX_SAFE_INTEGER);
    }
    const history = await this.rpc("session.history", payload);
    return {
      sessionId,
      ...summarizeHistory(history, {
        afterSeq: asInteger(afterSeq, -1, -1, Number.MAX_SAFE_INTEGER),
      }),
    };
  }

  cancelSession({ sessionId }) {
    return this.rpc("session.cancel", {
      sessionId: asNonEmptyString(sessionId, "sessionId"),
    });
  }

  forkSession({ sessionId, atSeq }) {
    const payload = { sessionId: asNonEmptyString(sessionId, "sessionId") };
    if (atSeq !== undefined) {
      payload.atSeq = asInteger(atSeq, undefined, 0, Number.MAX_SAFE_INTEGER);
    }
    return this.rpc("session.fork", payload);
  }

  async waitForSession({
    sessionId,
    afterSeq = -1,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  }) {
    const normalizedSessionId = asNonEmptyString(sessionId, "sessionId");
    const normalizedAfterSeq = asInteger(afterSeq, -1, -1, Number.MAX_SAFE_INTEGER);
    const normalizedTimeoutMs = asInteger(timeoutMs, DEFAULT_WAIT_TIMEOUT_MS, 1_000, MAX_WAIT_TIMEOUT_MS);
    const normalizedPollMs = asInteger(pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 1_000, 5_000);
    const deadline = Date.now() + normalizedTimeoutMs;
    let latest = null;
    let session = null;

    while (true) {
      const [sessions, messages] = await Promise.all([
        this.listSessions(),
        this.getMessages({
          sessionId: normalizedSessionId,
          maxMessages: MAX_HISTORY_MESSAGES,
          afterSeq: normalizedAfterSeq,
        }),
      ]);
      session = sessions.find((item) => item.sessionId === normalizedSessionId) ?? null;
      if (!session) {
        throw new DshApiError(`DSH session not found: ${normalizedSessionId}`, {
          code: "session-not-found",
          details: { sessionId: normalizedSessionId },
        });
      }
      latest = messages;

      if (messages.errorEvents.length > 0) {
        return {
          status: "error",
          completed: false,
          timedOut: false,
          session,
          afterSeq: normalizedAfterSeq,
          ...messages,
        };
      }

      const terminal = messages.terminalEvents.at(-1);
      if (terminal) {
        const kind = terminal.reason?.kind ?? "completed";
        return {
          status: kind === "completed" ? "completed" : kind,
          completed: kind === "completed",
          timedOut: false,
          session,
          afterSeq: normalizedAfterSeq,
          ...messages,
        };
      }

      if (Date.now() >= deadline) {
        return {
          status: session.running ? "timed_out_running" : "timed_out_idle",
          completed: false,
          timedOut: true,
          session,
          afterSeq: normalizedAfterSeq,
          ...latest,
        };
      }

      await new Promise((resolve) => setTimeout(resolve, normalizedPollMs));
    }
  }

  async dispatch({
    cwd,
    workspaceId,
    agentPreset = "standard",
    text,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    clientTimeZone = "Asia/Shanghai",
  }) {
    const created = await this.createSession({ cwd, workspaceId, agentPreset });
    const sent = await this.sendMessage({
      sessionId: created.sessionId,
      text,
      mode: "queue",
      clientTimeZone,
    });
    const waited = await this.waitForSession({
      sessionId: created.sessionId,
      afterSeq: sent.afterSeq,
      timeoutMs,
      pollIntervalMs,
    });
    const finalAssistantMessage = [...waited.messages]
      .reverse()
      .find((message) => message.role === "assistant");
    return {
      sessionId: created.sessionId,
      agentPreset: created.agentPreset ?? agentPreset,
      accepted: sent.accepted,
      status: waited.status,
      completed: waited.completed,
      timedOut: waited.timedOut,
      finalAssistantText: finalAssistantMessage?.text ?? null,
      messages: waited.messages,
      terminalEvents: waited.terminalEvents,
      errorEvents: waited.errorEvents,
      latestSeq: waited.latestSeq,
      session: waited.session,
    };
  }
}
