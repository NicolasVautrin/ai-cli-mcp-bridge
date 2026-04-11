const { sync: spawnSync } = require('cross-spawn');
const { TIMEOUT, envWithPath } = require('./env');

function chat(prompt, { sessionId, cwd } = {}) {
  let args;
  if (sessionId) {
    args = ['exec', 'resume', sessionId, '--full-auto', prompt];
  } else {
    args = ['exec', '--full-auto', prompt];
  }

  const opts = { encoding: 'utf8', timeout: TIMEOUT, maxBuffer: 10 * 1024 * 1024 };
  if (cwd) opts.cwd = cwd;

  opts.env = envWithPath;
  const result = spawnSync('codex', args, opts);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `codex exited with code ${result.status}`);
  const raw = result.stdout;
  const stderr = result.stderr || '';

  // Parse session id from stderr header: "session id: <uuid>"
  const sidMatch = stderr.match(/session id:\s*(\S+)/);
  const sid = sidMatch ? sidMatch[1] : null;

  return {
    sessionId: sid,
    response: raw.trim(),
  };
}

module.exports = { chat };
