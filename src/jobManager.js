'use strict';
const { randomUUID } = require('crypto');

const jobs = new Map();
const listeners = new Map();

function createJob(url) {
  const id = randomUUID();
  jobs.set(id, {
    id, url, status: 'queued', progress: 0, step: 'init',
    logs: [], clips: [], error: null, createdAt: Date.now()
  });
  listeners.set(id, new Set());
  return id;
}

function getJob(id) { return jobs.get(id); }

function subscribe(id, fn) {
  const set = listeners.get(id);
  if (!set) return () => {};
  set.add(fn);
  return () => set.delete(fn);
}

function emit(id, patch) {
  const job = jobs.get(id); if (!job) return;
  Object.assign(job, patch);
  const set = listeners.get(id) || new Set();
  for (const fn of set) { try { fn(job); } catch (_) {} }
}

function log(id, line) {
  const job = jobs.get(id); if (!job) return;
  const entry = `[${new Date().toISOString().slice(11, 19)}] ${line}`;
  job.logs.push(entry);
  if (job.logs.length > 500) job.logs.shift();
  emit(id, {});
}

module.exports = { createJob, getJob, subscribe, emit, log };
