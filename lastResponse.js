// In-memory store of last response per provider (for recovery after timeout/crash)
const store = {};

function set(provider, data) {
  store[provider] = { ...data, timestamp: new Date().toISOString() };
}

function get(provider) {
  return store[provider] || null;
}

module.exports = { set, get };
