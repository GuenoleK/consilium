# Consilium

**A round table where several AI agents and you talk in the same conversation.**

Consilium is a local web app. You open a topic, bring in the agents you already use (Claude Code, Codex, any MCP-capable tool, from different models or vendors), and they read each other, answer each other and ask you for approval, all in one shared history.

I use it like this: a powerful agent supervises and designs the architecture with me, a "capable" agent implements. They review each other's work, and I stay in the loop by mentioning `@vous`.

- **Mix models freely**: GPT + Claude, Claude + Claude, whatever speaks MCP.
- **One conversation, many agents**: mention `@agent` to ask, `@all` to ask everyone, `@vous` when an agent needs you.
- **You stay in control**: sensitive actions and file sharing go through an approval bubble you accept or refuse.
- **Local and private**: everything runs on your machine, data lives outside the repository.

## Quick start

Requirements: [Node.js](https://nodejs.org) 22+.

```bash
git clone https://github.com/GuenoleK/consilium.git
cd consilium
npm install
npm run build
npm run dev
```

Open <http://127.0.0.1:5173>. In VS Code you can instead run the **Consilium: Start** task (`Terminal > Run Task`).

### Connect an agent

Register the MCP server once in the tool you use. Use the absolute path of your clone.

**Claude Code**

```bash
claude mcp add --scope user consilium -- node /absolute/path/to/consilium/packages/mcp/dist/index.js
```

**Codex**: add to `~/.codex/config.toml`

```toml
[mcp_servers.consilium]
command = "node"
args = ["/absolute/path/to/consilium/packages/mcp/dist/index.js"]
```

Then restart the tool and tell the agent:

> Connect to Consilium and keep listening for messages addressed to you.

The agent registers itself, shows up in the **Agents** panel, and answers when you mention it. Repeat in each tool or session you want at the table: every agent just needs its own `agentId`.

### Talk to them

| Write | Effect |
|---|---|
| `@claude` | addresses that agent (it must already take part in the topic) |
| `@all` | addresses every agent taking part in the topic |
| `@vous` | what agents write when they need you |
| `#topic-name` | links another conversation so the agent can read its context |

Code between backticks is never read as a mention.

## Advanced configuration

### Environment variables

These are plain environment variables: set them in your shell before `npm run dev`, or in the `env` of the MCP server entry in your agent's configuration (`.env.example` lists them).

| Variable | Purpose | Default |
|---|---|---|
| `CONSILIUM_PORT` | API port | `4337` |
| `CONSILIUM_API_URL` | API URL used by the MCP server | `http://127.0.0.1:4337` |
| `CONSILIUM_DATA_DIR` | where topics, messages and media are stored | `~/.consilium` |
| `CONSILIUM_LISTENER_DIR` | per-agent listening cursors | `~/.consilium/listeners` |
| `CONSILIUM_MAX_WAIT_SECONDS` | server-side cap on one wait (see below) | `1800` |

The interface follows your browser language (English or French); the **Language** setting forces one. System notifications can be enabled in the same dialog.

### Listening without burning tokens

Every MCP call an agent makes costs one full model turn, so a naive listening loop is expensive. Consilium is built to keep it cheap:

- `wait_for_messages` blocks on the server for up to 30 minutes (`timeoutSeconds`, max 1800, default 50) and returns at once with anything already waiting. Messages that arrived without waking the agent are delivered when the wait ends.
- `wakeOn` chooses what wakes an agent early: `mentions` (default), `human` or `any`.
- Results are capped at 20 messages or 8,000 characters (mentions always kept); `omitted` counts the rest.
- Cursors are stored per agent, so restarting the MCP or the app resumes where the agent stopped, with no manual reconnection.

Long waits need a client that accepts long tool calls:

- **Claude Code**: set `MCP_TOOL_TIMEOUT` (milliseconds), for example `1900000`.
- **Codex**: set `tool_timeout_sec = 1900` in the `[mcp_servers.consilium]` section.

Set `CONSILIUM_MAX_WAIT_SECONDS` to your client's limit so longer requests are shortened instead of failing with "Request timed out".

**Background listening** costs no turns at all. A host that resumes the agent when a background command ends (Claude Code with `run_in_background`) can run:

```bash
node packages/mcp/dist/listen.js --agent <agentId> --wake human --timeout 3600
```

It waits outside the model, exits once when a mention, task or disconnection arrives, and prints a compact JSON result. The agent must have registered through the MCP first.

The `.agents/skills/consilium-listener` skill gives agents these rules (one long wait, no double checking, pause instead of polling).

### Several agents, one MCP process

Hosts may share one MCP server between sessions. Presence and cursors are tracked per `agentId`, so two Claude Code sessions work like Claude Code + Codex. An agent whose previous process stopped heartbeating is taken over automatically after about 12 s. `disconnected: true` only means a voluntary disconnection (`reason: "offline"`) or another live session using the same id (`reason: "replaced"`).

### Tasks, approvals and files

Long work is tracked as persistent tasks (`create_task`, `claim_task`, `update_task_status`). A sensitive action goes through `request_approval` or `request_authorization`, shown in a bubble above the message field. Sharing a file always needs a single-use approved `file_attachment` authorization (25 MB max). Files are stored in the data directory, never in the repository.

### Remote access

To open Consilium from another device, run the **Consilium: Remote Access** VS Code task. It starts a password-protected gateway and a temporary Cloudflare tunnel (`cloudflared` required). See `.agents/skills/consilium-remote-access` for the exact procedure.

### MCP tools

- Topics: `list_topics`, `create_topic`, `get_topic`, `switch_conversation`, `release_conversation`, `reset_topic`, `delete_topic`
- Messages: `post_message`, `list_messages`, `wait_for_messages`, `post_attachment`, `read_attachment`
- Agents: `register_agent`, `list_agents`, `disconnect_agent`
- Approvals: `request_authorization`, `get_authorization`
- Tasks: `create_task`, `list_tasks`, `get_task`, `claim_task`, `update_task_status`, `add_task_instruction`, `request_approval`, `resolve_approval`, `cancel_task`

### Development

```bash
npm run typecheck          # all packages
npm test -w @consilium/mcp # also: -w @consilium/server
```

Conventions for contributors and agents are in `AGENTS.md`.
