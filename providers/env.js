const path = require('path');

const TIMEOUT = 120_000;
const npmBin = path.join(process.env.APPDATA || '', 'npm');
const envWithPath = { ...process.env, PATH: [npmBin, process.env.PATH].filter(Boolean).join(path.delimiter) };

module.exports = { TIMEOUT, envWithPath };