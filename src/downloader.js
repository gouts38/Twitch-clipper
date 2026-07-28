'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');

const TWITCH_RE = /^https?://(www\.)?twitch\.tv/(videos/\d+|[\w-]+/clip/[\w-]+)/i;

function isTwitchVod(url) { return TWITCH_RE.test(String(url || '').trim()); }

function checkBin(bin) {
  return new Promise((resolve) => {
    const p = spawn(bin, ['--version']);
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

function downloadVod(url, jobDir, onLog, onProgress) {
  return new Promise((resolve, reject) => {
    const out = path.join(jobDir, 'source.%(ext)s');
    const args = ['-f', cfg.DOWNLOAD_FORMAT, '--newline', '--no-part', '-o', out, url];
    const p = spawn('yt-dlp', args);
    let finalPath = null;

    p.stdout.on('data', (d) => {
      const line = d.toString();
      onLog(line.trim());
      const m = line.match(/\[download\]\s+([\d.]+)%/);
      if (m) onProgress(Math.min(99, parseFloat(m[1])));
      const dest = line.match(/Destination:\s+(.+)/);
      if (dest) finalPath = dest[1].trim();
      const merged = line.match(/Merging formats into "(.+)"/);
      if (merged) finalPath = merged[1].trim();
    });
    p.stderr.on('data', (d) => onLog(d.toString().trim()));
    p.on('error', (e) => reject(new Error('yt-dlp introuvable : ' + e.message)));
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error('yt-dlp a échoué (code ' + code + ')'));
      if (!finalPath) {
        const found = fs.readdirSync(jobDir).find(f => f.startsWith('source.'));
        if (found) finalPath = path.join(jobDir, found);
      }
      if (!finalPath) return reject(new Error('Fichier téléchargé introuvable'));
      resolve(finalPath);
    });
  });
}

module.exports = { isTwitchVod, checkBin, downloadVod };
