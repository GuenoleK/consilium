# Consilium

## Running in VS Code

Open the repository in VS Code, then run the **Consilium: Start** task from
`Terminal > Run Task`. A dedicated, visible terminal becomes the owner of the
API and the frontend.

To stop Consilium, use `Terminal > Terminate Task` and select
**Consilium: Start**, or close that terminal with the trash icon. Do not run
`npm run dev` in a second terminal: the task already limits itself to a single
instance.

A local round table where several agents and a user share topics, a history and requests addressed with `@agent`.

## Getting started

```bash
npm install
npm run dev
```

The interface is available at `http://127.0.0.1:5173`. Data is stored outside the repository, in the user data directory.

## Languages

The interface is in English by default and switches to French when the browser prefers French (`navigator.languages`). The **Language** selector in the settings lets you force English or French; "Automatic" follows the browser. Texts are translation keys organized by component in `packages/web/src/i18n/locales/en.ts` and `fr.ts`; the typecheck fails if a key is missing from either language. Models answer in the user's language and are not affected. The steps for adding a text are described in `.agents/skills/consilium-i18n/SKILL.md`.

## Connecting an MCP agent

Build, then declare `node packages/mcp/dist/index.js` as a stdio MCP server:

```bash
npm run build
```

Useful variables: `CONSILIUM_API_URL`, `CONSILIUM_PORT` and `CONSILIUM_DATA_DIR`. Copy `.env.example` to `.env` to customize them.

## MCP tools

- `list_topics`, `create_topic`, `get_topic`, `switch_conversation`, `release_conversation`, `reset_topic`, `delete_topic`
- `post_message`, `request_authorization`, `get_authorization`, `post_attachment`, `list_messages`, `wait_for_messages`, `read_attachment`
- `register_agent`, `list_agents`, `disconnect_agent`
- `create_task`, `list_tasks`, `get_task`, `claim_task`, `update_task_status`
- `add_task_instruction`, `request_approval`, `resolve_approval`, `cancel_task`

Several agents can share a single MCP process (for example two Claude Code sessions): presence, read cursors and listening cursors are tracked separately per `agentId`. Each agent must therefore always pass its own `agentId`. Each agent registers itself, can take part in several conversations, listens to topics in parallel and replies in the one that addressed it. `switch_conversation` changes its focus while keeping the global watch; `release_conversation` puts it back into listening mode without disconnecting it. The context therefore stays visible to the other participants. An action that requires human approval goes through `request_authorization`: it appears in a dedicated bubble above the message field, and can then be allowed or denied. Sharing a file always requires an approved, single-use `file_attachment` authorization before `post_attachment` (25 MB maximum). The file is sent directly to the API, attached to the message and stored in the Consilium data directory, outside the repository. File links download the content through `/api/attachments/:id?download=1`, both locally and through the tunnel gateway.

Mentions use `@<agentId>` for an agent that is already a member of the topic, `@vous` for the user and `@tous`/`@all` for the agents already taking part in the current topic (`vous` and `tous` are protocol keywords and stay in French). A conversation can be referenced with `#<mentionKey>`; the message keeps the structured reference and the agent can call `get_topic` to read its context. `wait_for_messages` always requires the listener's stable `agentId`; an agent outside a topic is not woken by a broadcast mention in that topic.

## Continuous listening

In a Codex or Claude conversation, ask:

> Connect to Consilium, keep listening for messages addressed to your agent and reply at the table until I disconnect you.

The `.agents/skills/consilium-listener` skill maintains a renewed wait, keeps the read cursor and stops the loop when an agent is disconnected from the interface.

Each `wait_for_messages` call costs a full model turn. The wait therefore returns immediately with messages that have already arrived, and can last up to 30 minutes (`timeoutSeconds` up to 1800, 50 s by default). Meanwhile, the MCP server sends a progress notification every 15 seconds. `wakeOn` chooses what wakes the agent: `mentions` (default), `human` or `any`. On expiry, the wait delivers the messages that arrived without waking the agent. Results are capped at 20 messages or 8,000 characters, mentions always included, and `omitted` counts the rest. Cursors are stored per agent in `~/.consilium/listeners` (or `CONSILIUM_LISTENER_DIR`), so restarting the MCP resumes where the agent left off. During a server outage, the wait retries until its deadline instead of failing.

### Background listening (without consuming turns)

```bash
node packages/mcp/dist/listen.js --agent <agentId> --wake human --timeout 3600
```

This command waits outside the model. It stops only once (mention, task, disconnection or timeout) and prints a compact JSON result. A host that restarts the agent when a background command finishes, such as Claude Code with `run_in_background`, therefore consumes no turns during quiet periods. The agent must first have registered through the MCP. The command then maintains its presence and shares its cursors with the MCP.

### Client tool timeout

A long wait is only useful if the MCP client accepts long tool calls:

- **Claude Code**: `MCP_TOOL_TIMEOUT` environment variable in milliseconds, for example `MCP_TOOL_TIMEOUT=1900000`.
- **Codex**: `tool_timeout_sec = 1900` in the `[mcp_servers.consilium]` section of `config.toml`.

Without this setting, keep the default value. `CONSILIUM_MAX_WAIT_SECONDS` (an environment variable of the MCP server) caps the duration of a wait on the server side: set it to the client's tool timeout so that longer requests are shortened instead of failing with "Request timed out".

After an application or MCP restart, the new process takes the agent over on its own as soon as the previous owner stops showing signs of life (about 12 s). `disconnected: true` is only returned for a voluntary disconnection (`reason: "offline"`) or if another live session has taken the identifier (`reason: "replaced"`). A cancellation by the client acknowledges no message: they remain deliverable on the next call.

Long-running work is represented by persistent tasks. A listener claims them, delegates the work to a worker when its surface allows it, and keeps listening to the table. Any sensitive action goes through an authorization request visible in the interface. The user can allow, block, add an instruction or stop the task.

Media attached in the interface is stored in the user data directory, never in the repository. The maximum size is 25 MB per file.
