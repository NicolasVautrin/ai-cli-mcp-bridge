const { spawn } = require('cross-spawn');
const { TIMEOUT, envWithPath } = require('./env');
const lastResponse = require('../lastResponse');

function parseOutput(raw) {
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

function chat(prompt, { sessionId, cwd, mode } = {}) {
  const args = [];
  if (sessionId) args.push('-r', sessionId);

  const approvalFlag = mode === 'plan'
    ? ['--approval-mode', 'plan']
    : ['--yolo'];

  args.push('-p', prompt, '-o', 'json', ...approvalFlag);

  const opts = { env: envWithPath };
  if (cwd) opts.cwd = cwd;

  return new Promise((resolve, reject) => {
    const child = spawn('gemini', args, opts);
    child.stdin.end();
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));

    const timer = setTimeout(() => {
      child.kill();
      const raw = Buffer.concat(stdout).toString('utf8');
      if (raw.trim()) {
        try {
          const result = { ...parseOutput(raw), timedOut: true };
          lastResponse.set('gemini', result);
          resolve(result);
        } catch {
          lastResponse.set('gemini', { response: raw.trim(), timedOut: true });
          resolve({ sessionId: null, response: raw.trim(), timedOut: true });
        }
      } else {
        reject(new Error('gemini timed out (no output)'));
      }
    }, TIMEOUT);

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      const raw = Buffer.concat(stdout).toString('utf8');

      if (code !== 0 && !raw.trim()) {
        const err = Buffer.concat(stderr).toString('utf8');
        reject(new Error(err.trim() || `gemini exited with code ${code}`));
        return;
      }

      try {
        const result = parseOutput(raw);
        lastResponse.set('gemini', result);
        resolve(result);
      } catch {
        lastResponse.set('gemini', { response: raw.trim() });
        resolve({ sessionId: null, response: raw.trim() });
      }
    });
  });
}

module.exports = { chat };
