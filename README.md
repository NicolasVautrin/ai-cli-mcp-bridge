# ai-cli-mcp-bridge

MCP (Model Context Protocol) server that bridges Claude Code to Gemini CLI and Codex CLI. Talk to other AI assistants directly from Claude Code.

## Tools

| Tool | Description |
|------|-------------|
| `ai_chat` | Send a prompt to Gemini or Codex. Creates a new session or resumes an existing one. |
| `ai_sessions` | List sessions with pagination and search. |
| `ai_summarize` | Generate or regenerate a session summary by resuming the conversation with a custom prompt. |
| `ai_drop` | Delete a session from the index. |

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) installed globally (`npm install -g @google/gemini-cli`)
- [Codex CLI](https://github.com/openai/codex) installed globally (`npm install -g @openai/codex`)
- At least one of the two is required.

## Installation

```bash
git clone https://github.com/NicolasVautrin/ai-cli-mcp-bridge.git
cd ai-cli-mcp-bridge
npm install
```

## Configuration

Register the MCP server with Claude Code using the CLI:

```bash
# User-level (available in all projects)
claude mcp add --scope user ai-bridge -- node /path/to/ai-cli-mcp-bridge/server.js

# Project-level (current project only)
claude mcp add ai-bridge -- node /path/to/ai-cli-mcp-bridge/server.js
```

Verify the server is connected:

```bash
claude mcp list
```

> **Note:** Adding the server to `~/.claude/.mcp.json` or `settings.json` directly does not work — `settings.json` does not support a `mcpServers` field, and `.mcp.json` servers require manual approval. The `claude mcp add` command handles registration correctly.

## Usage examples

From Claude Code:

- **Chat with Gemini:** "ask gemini to explain this error"
- **Chat with Codex:** "send this code to codex for review"
- **Resume a session:** "continue my gemini conversation about REST APIs"
- **List sessions:** "list my AI sessions"
- **Summarize:** "summarize the last 5 exchanges of this gemini session"

## How it works

The bridge spawns Gemini or Codex CLI as child processes using [cross-spawn](https://github.com/moxystudio/node-cross-spawn) for cross-platform compatibility. Sessions are tracked in `~/.ai-cli-bridge/sessions.json`.

## License

ISC