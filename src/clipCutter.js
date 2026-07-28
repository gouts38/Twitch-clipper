'use strict';
const { spawn } = require('child_process');
const path = require('path');
const cfg = require('./config');

function getDuration(videoPath) {
  return new Promise((resolve) => {
    const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath]);
    let out = '';
    p.stdout.on('data', d => out += d.toString());
    p.on('error', () => resolve(0));
    p.on('exit', () => resolve(parseFloat(out.trim()) || 0));
  });
}

function cutClip(videoPath, start, duration, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-ss', String(start), '-i', videoPath, '-t', String(duration),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath
    ];
    const p = spawn('ffmpeg', args);
    p.stderr.on('data', () => {});
    p.on('error', (e) => reject(e));
    p.on('exit', (code) => code === 0 ? resolve(outPath) : reject(new Error('Découpe ffmpeg échouée')));
  });
}

async function cutAllClips(videoPath, peaks, jobDir, onLog) {
  const total = await getDuration(videoPath);
  const clips = [];
  for (let i = 0; i < peaks.length; i++) {
    const peak = peaks[i];
    let start = Math.max(0, peak.t - cfg.PRE_ROLL_SEC);
    let duration = cfg.PRE_ROLL_SEC + cfg.POST_ROLL_SEC;
    duration = Math.max(cfg.CLIP_MIN_SEC, Math.min(cfg.CLIP_MAX_SEC, duration));
    if (total && start + duration > total) duration = Math.max(cfg.CLIP_MIN_SEC, total - start - 1);
    const filename = `clip_${String(i + 1).padStart(2, '0')}.mp4`;
    const outPath = path.join(jobDir, filename);
    onLog(`Découpe clip ${i + 1}/${peaks.length} @ ${start.toFixed(1)}s (${duration.toFixed(1)}s)`);
    await cutClip(videoPath, start, duration, outPath);
    clips.push({ index: i + 1, filename, start, duration, peakTime: peak.t, score: peak.score });
  }
  return clips;
}

module.exports = { cutAllClips, getDuration };
