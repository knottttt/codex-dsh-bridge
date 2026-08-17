import readline from "node:readline";
import { DshApiError, DshClient } from "./dsh-client.mjs";

const SERVER_NAME = "Codex DSH Bridge";
const SERVER_VERSION = "0.2.0";
const JSON_RPC_ERRORS = {
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

const tools = [
  {
    name: "dsh_status",
    title: "Check DSH Status",
    description: "Check the local DeepSeek Harness host, model, current working directory, and attached-session count.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "dsh_list_sessions",
    title: "List DSH Sessions",
    description: "List local DSH sessions, optionally filtering by exact working directory, title substring, or running state.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Exact absolute project working directory." },
        title: { type: "string", description: "Case-insensitive title substring." },
        running: { type: "boolean", description: "Filter to running or idle sessions." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "dsh_create_session",
    title: "Create DSH Session",
    description: "Create a DeepSeek Harness session for a project. Prefer cwd for normal local project collaboration.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Absolute local project directory." },
        workspaceId: { type: "string", description: "Existing DSH workspace id. Do not combine with cwd." },
        sessionId: { type: "string", description: "Optional requested session id." },
        agentPreset: { type: "string", description: "DSH agent preset.", default: "standard" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "dsh_send_message",
    title: "Send Message to DSH",
    description: "Queue a task in a DSH session, or steer the currently running turn. Returns afterSeq for dsh_wait.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        text: { type: "string", description: "Task or follow-up message to send." },
        mode: { type: "string", enum: ["queue", "steer"], default: "queue" },
        clientTimeZone: { type: "string", default: "Asia/Shanghai" },
      },
      required: ["sessionId", "text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "dsh_get_messages",
    title: "Read DSH Messages",
    description: "Read human-readable user and final assistant messages from a DSH session while omitting noisy streaming chunks.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        beforeSeq: { type: "integer", minimum: 0, description: "Optional backward-pagination cursor." },
        afterSeq: { type: "integer", minimum: -1, default: -1, description: "Return only events newer than this sequence." },
        maxMessages: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "dsh_wait",
    title: "Wait for DSH Session",
    description: "Poll a DSH session at low frequency until a new turn ends or the bounded timeout expires. A timeout can still mean the session is running.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        afterSeq: { type: "integer", minimum: -1, default: -1, description: "Usually use afterSeq returned by dsh_send_message." },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 300000, default: 60000 },
        pollIntervalMs: { type: "integer", minimum: 1000, maximum: 5000, default: 2000 },
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "dsh_cancel",
    title: "Cancel DSH Session Turn",
    description: "Request cancellation of the active turn in a DSH session.",
    inputSchema: {
      type: "object",
      properties: { sessionId: { type: "string" } },
      required: ["sessionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "dsh_fork_session",
    title: "Fork DSH Session",
    description: "Fork a DSH session from its latest completed turn or an optional event sequence.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string" },
        atSeq: { type: "integer", minimum: 0 },
      },
      required: ["sessionId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "dsh_dispatch",
    title: "Dispatch Task to DSH",
    description: "Convenience workflow: create a DSH session, queue one task, wait at low frequency, and return the final assistant answer or a resumable timeout state.",
    inputSchema: {
      type: "object",
      properties: {
        cwd: { type: "string", description: "Absolute local project directory." },
        workspaceId: { type: "string", description: "Existing DSH workspace id. Do not combine with cwd." },
        agentPreset: { type: "string", default: "standard" },
        text: { type: "string", description: "Complete task with expected output and constraints." },
        timeoutMs: { type: "integer", minimum: 1000, maximum: 300000, default: 60000 },
        pollIntervalMs: { type: "integer", minimum: 1000, maximum: 5000, default: 2000 },
        clientTimeZone: { type: "string", default: "Asia/Shanghai" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendResult(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  send({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  });
}

function toolResult(value, { isError = false } = {}) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2),
      },
    ],
    structuredContent: value,
    ...(isError ? { isError: true } : {}),
  };
}

async function callTool(name, args = {}) {
  const client = new DshClient();
  switch (name) {
    case "dsh_status":
      return {
        baseUrl: client.baseUrl.origin,
        configPath: client.configPath,
        configSource: client.configSource,
        host: await client.describe(),
      };
    case "dsh_list_sessions":
      return {
        baseUrl: client.baseUrl.origin,
        sessions: await client.listSessions(args),
      };
    case "dsh_create_session":
      return client.createSession(args);
    case "dsh_send_message":
      return client.sendMessage(args);
    case "dsh_get_messages":
      return client.getMessages(args);
    case "dsh_wait":
      return client.waitForSession(args);
    case "dsh_cancel":
      return client.cancelSession(args);
    case "dsh_fork_session":
      return client.forkSession(args);
    case "dsh_dispatch":
      return client.dispatch(args);
    default:
      throw new DshApiError(`Unknown tool: ${name ?? ""}`, {
        code: "unknown-tool",
      });
  }
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    sendResult(id, {
      protocolVersion: params?.protocolVersion ?? "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        "Use dsh_dispatch for a fresh delegated task. Use dsh_send_message followed by dsh_wait for an existing session. Treat timed_out_running as still in progress and retain the sessionId for a later wait.",
    });
    return;
  }

  if (method === "ping") {
    sendResult(id, {});
    return;
  }

  if (method === "tools/list") {
    sendResult(id, { tools });
    return;
  }

  if (method === "tools/call") {
    try {
      const value = await callTool(params?.name, params?.arguments ?? {});
      sendResult(id, toolResult(value));
    } catch (error) {
      const known = error instanceof DshApiError;
      sendResult(
        id,
        toolResult(
          {
            ok: false,
            error: {
              code: known ? error.code : "internal-error",
              message: error instanceof Error ? error.message : String(error),
              ...(known && error.details !== undefined ? { details: error.details } : {}),
            },
          },
          { isError: true },
        ),
      );
    }
    return;
  }

  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return;
  }

  if (id !== undefined) {
    sendError(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

lines.on("line", (line) => {
  if (line.trim().length === 0) {
    return;
  }
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    sendError(null, -32700, "Parse error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }
  void handleRequest(message).catch((error) => {
    if (message.id !== undefined) {
      sendError(
        message.id,
        JSON_RPC_ERRORS.INTERNAL_ERROR,
        error instanceof Error ? error.message : String(error),
      );
    }
  });
});
