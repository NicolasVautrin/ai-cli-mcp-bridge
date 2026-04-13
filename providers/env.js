const fs = require('fs');
const path = require('path');

const TIMEOUT = 120_000;
const npmBin = path.join(process.env.APPDATA || '', 'npm');

// Use user-local temp to avoid antivirus blocking writes to C:\Windows\TEMP
const userTemp = path.join(process.env.USERPROFILE || process.env.HOME || '', '.ai-cli-bridge', 'tmp');
try { fs.mkdirSync(userTemp, { recursive: true }); } catch {}

const envWithPath = {
  ...process.env,
  PATH: [npmBin, process.env.PATH].filter(Boolean).join(path.delimiter),
  TEMP: userTemp,
  TMP: userTemp,
};

module.exports = { TIMEOUT, envWithPath };