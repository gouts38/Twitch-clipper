'use strict';
const { spawn } = require('child_process');
const cfg = require('./config');

function extractRmsSeries(videoPath, onLog) {
  return new Promise((resolve, reject) => {
    const samplesPerWindow = 44100 * cfg.RMS_WINDOW_SEC;
    const args = [
      '-hide_banner', '-nostats', '-i', videoPath,
      '-vn', '-ac', '1', '-ar', '44100',
      '-af', `asetnsamples=n=${samplesPerWindow}:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level`,
      '-f', 'null', '-'
    ];
    const p = spawn('ffmpeg', args);
    const series = [];
    let buffer = '';
    let currentTime = null;

    p.stderr.on('data', (d) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
        const tMatch = line.match(/pts_time:([\d.]+)/);
        if (tMatch) currentTime = parseFloat(tMatch[1]);
        const rMatch = line.match(/RMS_level=(-?[\d.]+|-?inf)/);
        if (rMatch && currentTime !== null) {
          const raw = rMatch[1];
          const val = raw === '-inf' ? -120 : parseFloat(raw);
          series.push({ t: currentTime, rms: val });
        }
      }
    });
    p.on('error', (e) => reject(new Error('ffmpeg introuvable : ' + e.message)));
    p.on('exit', (code) => {
      if (code !== 0 && series.length === 0) return reject(new Error('Analyse audio échouée (ffmpeg code ' + code + ')'));
      onLog(`RMS échantillons collectés : ${series.length}`);
      resolve(series);
    });
  });
}

function detectPeaks(series) {
  if (!series.length) return [];
  const values = series.map(s => s.rms);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;
  const threshold = mean + cfg.PEAK_STD_ABOVE_MEAN * std;
  const maxOver = Math.max(...values) - threshold;
  const candidates = [];
  for (let i = 1; i < series.length - 1; i++) {
    const v = series[i].rms;
    if (v > threshold && v >= series[i - 1].rms && v >= series[i + 1].rms) {
      const score = maxOver > 0 ? Math.min(1, (v - threshold) / maxOver) : 0.5;
      candidates.push({ t: series[i].t, rms: v, score });
    }
  }
  candidates.sort((a, b) => b.rms - a.rms);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.every(x => Math.abs(x.t - c.t) >= cfg.MIN_GAP_SEC)) {
      chosen.push(c);
      if (chosen.length >= cfg.MAX_CLIPS) break;
    }
  }
  chosen.sort((a, b) => a.t - b.t);
  return chosen;
}

module.exports = { extractRmsSeries, detectPeaks };
