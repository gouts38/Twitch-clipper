'use strict';
const fs = require('fs');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function rmSafe(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function fmtTC(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function sanitizeName(s) {
  return String(s).replace(/[^\w\-]+/g, '_').slice(0, 60);
}

module.exports = { ensureDir, rmSafe, fmtTC, sanitizeName };
