const { spawn } = require('cross-spawn');
const { TIMEOUT, envWithPath } = require('./env');
const lastResponse = require('../lastResponse');

function chat(prompt, { sessionId, cwd, mode } = {}) {
  // Codex has no native plan mode; --sandbox read-only triggers AV (sandbox binary extraction)
  // In plan mode, we use --full-auto but prepend a read-only instruction to the prompt
  const modeFlag = ['--full-auto'];
  if (mode === 'plan') {
    prompt = '[MODE PLAN - READ ONLY] Tu es en mode lecture seule. Ne modifie AUCUN fichier, ne crée rien, ne supprime rien. Lis et réfléchis uniquement.\n\n' + prompt;
  }

  let args;
  if (sessionId) {
    // resume doesn't support --sandbox/--full-auto, flags go on exec level
    args = ['exec', ...modeFlag, '--skip-git-repo-check', 'resume', sessionId, prompt];
  } else {
    args = ['exec', ...modeFlag, '--skip-git-repo-check', prompt];
  }

  const opts = { env: envWithPath };
  if (cwd) opts.cwd = cwd;

  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, opts);
    child.stdin.end();
    const stdout = [];
    const stderr = [];

    child.stdout.on('data', chunk => stdout.push(chunk));
    child.stderr.on('data', chunk => stderr.push(chunk));

    const timer = setTimeout(() => {
      child.kill();
      const raw = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (raw.trim()) {
        const sidMatch = err.match(/session id:\s*(\S+)/);
        const result = {
          sessionId: sidMatch ? sidMatch[1] : null,
          response: raw.trim(),
          timedOut: true,
        };
        lastResponse.set('codex', result);
        resolve(result);
      } else {
        reject(new Error('codex timed out (no output)'));
      }
    }, TIMEOUT);

    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      clearTimeout(timer);
      const raw = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');

      if (code !== 0 && !raw.trim()) {
        reject(new Error(err.trim() || `codex exited with code ${code}`));
        return;
      }

      const sidMatch = err.match(/session id:\s*(\S+)/);
      const result = {
        sessionId: sidMatch ? sidMatch[1] : null,
        response: raw.trim(),
      };
      lastResponse.set('codex', result);
      resolve(result);
    });
  });
}

module.exports = { chat };
