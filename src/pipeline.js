'use strict';
const path = require('path');
const fs = require('fs');
const cfg = require('./config');
const { ensureDir } = require('./utils');
const jm = require('./jobManager');
const { isTwitchVod, checkBin, downloadVod } = require('./downloader');
const { extractRmsSeries, detectPeaks } = require('./audioAnalyzer');
const { cutAllClips } = require('./clipCutter');
const { generateTitle } = require('./titleGenerator');

async function runPipeline(jobId) {
  const job = jm.getJob(jobId);
  const jobDir = path.join(cfg.WORK_DIR, jobId);
  ensureDir(jobDir);

  try {
    if (!isTwitchVod(job.url)) throw new Error('Lien Twitch invalide. Attendu : https://www.twitch.tv/videos/... ou lien de clip.');

    jm.emit(jobId, { status: 'running', step: 'check-tools', progress: 1 });
    jm.log(jobId, 'Vérification de yt-dlp et ffmpeg…');
    const [okYt, okFf] = await Promise.all([checkBin('yt-dlp'), checkBin('ffmpeg')]);
    if (!okYt) throw new Error('yt-dlp introuvable dans le PATH.');
    if (!okFf) throw new Error('ffmpeg introuvable dans le PATH.');

    jm.emit(jobId, { step: 'download', progress: 3 });
    jm.log(jobId, 'Téléchargement du replay via yt-dlp…');
    const videoPath = await downloadVod(job.url, jobDir,
      (line) => jm.log(jobId, line),
      (pct) => jm.emit(jobId, { progress: 3 + (pct * 0.4) })
    );
    jm.log(jobId, `Fichier source : ${path.basename(videoPath)}`);

    jm.emit(jobId, { step: 'analyze', progress: 45 });
    jm.log(jobId, 'Analyse audio (RMS par seconde)…');
    const series = await extractRmsSeries(videoPath, l => jm.log(jobId, l));
    jm.emit(jobId, { progress: 65 });

    jm.log(jobId, 'Détection des pics…');
    const peaks = detectPeaks(series);
    jm.log(jobId, `Pics retenus : ${peaks.length}`);
    if (!peaks.length) throw new Error('Aucun pic audio détecté. Essayez une autre VOD.');

    jm.emit(jobId, { step: 'cut', progress: 70 });
    const rawClips = await cutAllClips(videoPath, peaks, jobDir, l => jm.log(jobId, l));

    jm.emit(jobId, { step: 'title', progress: 90 });
    const clips = rawClips.map(c => {
      const meta = generateTitle(c);
      return { ...c, title: meta.title, hashtags: meta.hashtags };
    });

    jm.emit(jobId, { step: 'cleanup', progress: 98 });
    jm.log(jobId, 'Nettoyage du fichier source…');
    try { fs.unlinkSync(videoPath); } catch (_) {}

    jm.emit(jobId, { status: 'done', step: 'done', progress: 100, clips });
    jm.log(jobId, 'Terminé.');
  } catch (err) {
    jm.log(jobId, 'ERREUR : ' + err.message);
    jm.emit(jobId, { status: 'error', error: err.message });
    try {
      const src = fs.readdirSync(jobDir).find(f => f.startsWith('source.'));
      if (src) fs.unlinkSync(path.join(jobDir, src));
    } catch (_) {}
  }
}

module.exports = { runPipeline };
