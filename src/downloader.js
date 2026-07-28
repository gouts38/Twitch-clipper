'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cfg = require('./config');

function isTwitchVod(url) {
  const s = String(url || '').trim().toLowerCase();
  if (!s.startsWith('http://') && !s.startsWith('https://')) return false;
  if (s.indexOf('twitch.tv/') === -1) return false;
  if (s.indexOf('/videos/') !== -1) return true;
  if (s.indexOf('/clip/') !== -1) return true;
  return false;
}

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
      const pctIdx = line.indexOf('%');
      if (pctIdx > 0 && line.indexOf('[download]') !== -1) {
        const before = line.slice(0, pctIdx).trim().split(/\s+/).pop();
        const num = parseFloat(before);
        if (!isNaN(num)) onProgress(Math.min(99, num));
      }
      const destKey = 'Destination:';
      const destIdx = line.indexOf(destKey);
      if (destIdx !== -1) finalPath = line.slice(destIdx + destKey.length).trim();
      const mergeKey = 'Merging formats into "';
      const mergeIdx = line.indexOf(mergeKey);
      if (mergeIdx !== -1) {
        const rest = line.slice(mergeIdx + mergeKey.length);
        const end = rest.indexOf('"');
        if (end !== -1) finalPath = rest.slice(0, end);
      }
    });
    p.stderr.on('data', (d) => onLog(d.toString().trim()));
    p.on('error', (e) => reject(new Error('yt-dlp introuvable : ' + e.message)));
    p.on('exit', (code) => {
      if (code !== 0) return reject(new Error('yt-dlp a echoue (code ' + code + ')'));
      if (!finalPath) {
        const found = fs.readdirSync(jobDir).find(f => f.startsWith('source.'));
        if (found) finalPath = path.join(jobDir, found);
      }
      if (!finalPath) return reject(new Error('Fichier telecharge introuvable'));
      resolve(finalPath);
    });
  });
}

module.exports = { isTwitchVod, checkBin, downloadVod };
