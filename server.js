const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const sessions = require('./sessions');
const gemini = require('./providers/gemini');
const codex = require('./providers/codex');

const providers = { gemini, codex };

const server = new McpServer({
  name: 'ai-cli-bridge',
  version: '1.0.0',
});

// ── ai_chat ──────────────────────────────────────────────────────────

server.tool(
  'ai_chat',
  'Send a prompt to Gemini or Codex CLI. Creates a new session or resumes an existing one.',
  {
    provider: z.enum(['gemini', 'codex']).describe('Which CLI to use'),
    prompt: z.string().describe('The message to send'),
    sessionId: z.string().optional().describe('Resume an existing session (omit for new)'),
    cwd: z.string().optional().describe('Working directory for the CLI'),
  },
  async ({ provider, prompt, sessionId, cwd }) => {
    const cli = providers[provider];
    if (!cli) return { content: [{ type: 'text', text: `Unknown provider: ${provider}` }], isError: true };

    // Resolve cwd: param > stored session > process cwd
    let resolvedCwd = cwd;
    if (!resolvedCwd && sessionId) {
      const existing = sessions.get(provider, sessionId);
      if (existing?.project) resolvedCwd = existing.project;
    }
    if (!resolvedCwd) resolvedCwd = process.cwd();

    try {
      const result = cli.chat(prompt, { sessionId, cwd: resolvedCwd });
      const sid = result.sessionId || sessionId || 'unknown';

      const existing = sessions.get(provider, sid);
      let turns = (existing?.turns || 0) + 1;

      // Generate AI summary on first turn, keep existing on subsequent turns
      let summary = existing?.summary;
      if (!summary) {
        try {
          const sumResult = cli.chat(
            `Summarize this exchange in one short sentence (max 60 chars). Reply only with the summary, no quotes.\n\nUser: ${prompt}\nAssistant: ${result.response}`,
            { cwd: resolvedCwd },
          );
          summary = sumResult.response.slice(0, 200);
        } catch {
          summary = prompt.slice(0, 200);
        }
      }

      sessions.upsert({
        id: sid,
        provider,
        created: existing?.created || new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        summary,
        turns,
        project: resolvedCwd,
      });

      return { content: [{ type: 'text', text: JSON.stringify({ sessionId: sid, provider, response: result.response }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `${provider} error: ${err.message}` }], isError: true };
    }
  },
);

// ── ai_sessions ──────────────────────────────────────────────────────

server.tool(
  'ai_sessions',
  'List AI chat sessions with pagination and search.',
  {
    provider: z.enum(['gemini', 'codex']).optional().describe('Filter by provider'),
    limit: z.number().optional().default(10).describe('Max sessions to return'),
    skip: z.number().optional().default(0).describe('Number of sessions to skip'),
    search: z.string().optional().describe('Search in summaries'),
  },
  async ({ provider, limit, skip, search }) => {
    const result = sessions.list({ provider, limit, skip, search });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

// ── ai_drop ──────────────────────────────────────────────────────────

server.tool(
  'ai_drop',
  'Delete a session from the index.',
  {
    provider: z.enum(['gemini', 'codex']).describe('Provider of the session'),
    sessionId: z.string().describe('Session ID to delete'),
  },
  async ({ provider, sessionId }) => {
    const removed = sessions.drop(provider, sessionId);
    return { content: [{ type: 'text', text: removed ? `Dropped ${sessionId}` : `Session not found: ${sessionId}` }] };
  },
);

// ── ai_summarize ─────────────────────────────────────────────────────

server.tool(
  'ai_summarize',
  'Generate or regenerate a session summary by resuming the conversation with a custom prompt.',
  {
    provider: z.enum(['gemini', 'codex']).describe('Provider of the session'),
    sessionId: z.string().describe('Session ID to summarize'),
    prompt: z.string().optional().describe('Custom prompt for summary generation (default: short summary)'),
  },
  async ({ provider, sessionId, prompt }) => {
    const cli = providers[provider];
    if (!cli) return { content: [{ type: 'text', text: `Unknown provider: ${provider}` }], isError: true };

    const existing = sessions.get(provider, sessionId);
    if (!existing) return { content: [{ type: 'text', text: `Session not found: ${sessionId}` }], isError: true };

    const summaryPrompt = prompt || 'Summarize our conversation in one short sentence (max 60 chars). Reply only with the summary, no quotes.';

    try {
      const result = cli.chat(summaryPrompt, { sessionId, cwd: existing.project });
      const summary = result.response.slice(0, 200);

      sessions.upsert({ ...existing, summary, lastUsed: new Date().toISOString() });

      return { content: [{ type: 'text', text: JSON.stringify({ sessionId, provider, summary }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `${provider} error: ${err.message}` }], isError: true };
    }
  },
);

// ── Start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
