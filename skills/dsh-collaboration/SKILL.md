---
name: dsh-collaboration
description: Collaborate with the local DeepSeek Harness (DSH) WebUI by creating sessions, dispatching project tasks, waiting for turns, reading final answers, continuing sessions, cancelling active work, or forking completed work. Use when the user mentions DSH, DeepSeek Harness, the local port 3080 WebUI, Codex-to-DSH message passing, or delegating work to another local session.
---

# DSH Collaboration

Use the `dsh_*` tools to treat a local DeepSeek Harness session like a bounded collaborator.

## Normal workflow

1. Call `dsh_status` when connectivity or the active DSH host is not yet known.
2. Use `dsh_dispatch` for a new self-contained task.
   - Pass the user's actual project directory as `cwd`.
   - Write a complete task containing scope, expected output, constraints, and relevant file paths.
   - Keep the default `queue` behavior and low-frequency polling.
3. Inspect `status`, `completed`, `timedOut`, and `finalAssistantText`.
4. Treat `timed_out_running` as still running, not as failure. Keep the returned `sessionId` and call `dsh_wait` later.
5. Report the DSH result as collaborator output. Independently verify code or file changes when the user's task requires verified implementation.

## Existing sessions

- Use `dsh_list_sessions` with the current project `cwd` before reusing a session.
- Use `dsh_get_messages` to understand context before continuing it.
- Call `dsh_send_message` with `mode: "queue"` for a normal follow-up, then pass its `afterSeq` to `dsh_wait`.
- Use `mode: "steer"` only when the session is already running and the user wants to redirect the current turn.
- Use `dsh_fork_session` when preserving the original conversation matters.

## Safety and scope

- The bridge is local-only and accepts only loopback DSH URLs.
- Do not use browser automation just to exchange DSH messages; use the HTTP-backed tools.
- Do not cancel a session unless the user asked to stop that work or cancellation is clearly required by the active task.
- Do not claim a timed-out session completed.
- Do not expose raw streaming chunks. Prefer final `assistant/message` output and `turn/end` state.
- Creating or messaging a session changes DSH state; do it only when it is part of the user's requested collaboration.

