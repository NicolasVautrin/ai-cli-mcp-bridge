const { sync: spawnSync } = require('cross-spawn');
const { TIMEOUT, envWithPath } = require('./env');

function chat(prompt, { sessionId, cwd } = {}) {
  const args = [];
  if (sessionId) args.push('-r', sessionId);
  args.push('-p', prompt, '-o', 'json', '--yolo');

  const opts = { encoding: 'utf8', timeout: TIMEOUT, maxBuffer: 10 * 1024 * 1024, env: envWithPath };
  if (cwd) opts.cwd = cwd;

  const result = spawnSync('gemini', args, opts);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `gemini exited with code ${result.status}`);
  const raw = result.stdout;

  // gemini -o json prints YOLO warnings on stderr but JSON on stdout.
  // Find the JSON object in stdout.
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) {
    return { sessionId: null, response: raw.trim() };
  }
  const parsed = JSON.parse(raw.slice(jsonStart));
  return {
    sessionId: parsed.session_id || null,
    response: parsed.response || raw.trim(),
  };
}

module.exports = { chat };
