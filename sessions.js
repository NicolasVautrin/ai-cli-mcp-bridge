const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.ai-cli-bridge');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');

// Simple async mutex to serialize read-modify-write on sessions.json
let lock = Promise.resolve();
function withLock(fn) {
  lock = lock.then(fn, fn);
  return lock;
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return { sessions: [] };
  }
}

function save(data) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

function upsert(session) {
  return withLock(() => {
    const data = load();
    const idx = data.sessions.findIndex(s => s.id === session.id && s.provider === session.provider);
    if (idx >= 0) {
      data.sessions[idx] = { ...data.sessions[idx], ...session };
    } else {
      data.sessions.push(session);
    }
    save(data);
  });
}

function list({ provider, limit = 10, skip = 0, search } = {}) {
  const data = load();
  let sessions = data.sessions;
  if (provider) sessions = sessions.filter(s => s.provider === provider);
  if (search) {
    const q = search.toLowerCase();
    sessions = sessions.filter(s => s.summary && s.summary.toLowerCase().includes(q));
  }
  sessions.sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  const total = sessions.length;
  return { total, skip, limit, sessions: sessions.slice(skip, skip + limit) };
}

function drop(provider, sessionId) {
  return withLock(() => {
    const data = load();
    const before = data.sessions.length;
    data.sessions = data.sessions.filter(s => !(s.id === sessionId && s.provider === provider));
    save(data);
    return data.sessions.length < before;
  });
}

function get(provider, sessionId) {
  const data = load();
  return data.sessions.find(s => s.id === sessionId && s.provider === provider) || null;
}

module.exports = { upsert, list, drop, get };
