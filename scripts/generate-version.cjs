const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const versionPath = path.resolve(__dirname, '../public/version.json');
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
} catch (e) {}

const now = Date.now();
const versionData = {
  version: pkg.version || '1.0.1',
  buildTime: now,
  // Keep existing forceLogoutBefore if set, or set to now
  forceLogoutBefore: existing.forceLogoutBefore || now
};

fs.writeFileSync(versionPath, JSON.stringify(versionData, null, 2), 'utf8');
console.log('[VersionGen] Generated public/version.json:', versionData);
