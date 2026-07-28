'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const cfg = require('./src/config');
const { ensureDir } = require('./src/utils');
const jm = require('./src/jobManager');
const { runPipeline } = require('./src/pipeline');

ensureDir(cfg.WORK_DIR);
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/jobs', (req, res) => {
  const url = (req.body && req.body.url || '').trim();
  if (!url) return res.status(400).json({ error: 'URL manquante' });
  const id = jm.createJob(url);
  setImmediate(() => runPipeline(id));
  res.json({ id });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jm.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job inconnu' });
  res.json(job);
});

app.get('/api/jobs/:id/stream', (req, res) => {
  const job = jm.getJob(req.params.id);
  if (!job) return res.status(404).end();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  const send = (j) => res.write(`data: ${JSON.stringify(j)}\n\n`);
  send(job);
  const unsub = jm.subscribe(req.params.id, send);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => { clearInterval(ping); unsub(); });
});

app.patch('/api/jobs/:id/clips/:idx', (req, res) => {
  const job = jm.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job inconnu' });
  const idx = parseInt(req.params.idx, 10) - 1;
  if (!job.clips[idx]) return res.status(404).json({ error: 'Clip inconnu' });
  const { title, hashtags } = req.body || {};
  if (typeof title === 'string') job.clips[idx].title = title.slice(0, 200);
  if (Array.isArray(hashtags)) job.clips[idx].hashtags = hashtags.slice(0, 10);
  res.json(job.clips[idx]);
});

app.get('/api/jobs/:id/clips/:filename/stream', (req, res) => {
  const p = path.join(cfg.WORK_DIR, req.params.id, path.basename(req.params.filename));
  if (!fs.existsSync(p)) return res.status(404).end();
  res.setHeader('Content-Type', 'video/mp4');
  fs.createReadStream(p).pipe(res);
});

app.get('/api/jobs/:id/clips/:filename/download', (req, res) => {
  const p = path.join(cfg.WORK_DIR, req.params.id, path.basename(req.params.filename));
  if (!fs.existsSync(p)) return res.status(404).end();
  res.download(p);
});

app.listen(cfg.PORT, () => {
  console.log(`Twitch Clipper prêt sur le port ${cfg.PORT}`);
});
