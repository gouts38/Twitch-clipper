'use strict';
const $ = (s) => document.querySelector(s);
const urlEl = $('#url'), goEl = $('#go'), statusEl = $('#global-status');
const progressPanel = $('#progress-panel'), stepLabel = $('#step-label'),
      progressPct = $('#progress-pct'), progressFill = $('#progress-fill'), logsEl = $('#logs');
const errorPanel = $('#error-panel'), errorMsg = $('#error-msg');
const clipsPanel = $('#clips-panel'), clipsList = $('#clips-list'), clipsCount = $('#clips-count');

let currentEs = null;

const STEP_LABELS = {
  init: 'INIT', 'check-tools': 'VÉRIFICATION OUTILS', download: 'TÉLÉCHARGEMENT VOD',
  analyze: 'ANALYSE AUDIO', cut: 'DÉCOUPE CLIPS', title: 'GÉNÉRATION TITRES',
  cleanup: 'NETTOYAGE', done: 'TERMINÉ'
};

goEl.addEventListener('click', startJob);
urlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') startJob(); });

async function startJob() {
  const url = urlEl.value.trim();
  if (!url) { urlEl.focus(); return; }
  resetUI();
  goEl.disabled = true;
  setStatus('live', 'LIVE');
  try {
    const res = await fetch('/api/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Erreur serveur');
    const { id } = await res.json();
    listenJob(id);
  } catch (e) {
    showError(e.message);
    goEl.disabled = false;
    setStatus('err', 'ERREUR');
  }
}

function listenJob(id) {
  if (currentEs) currentEs.close();
  progressPanel.hidden = false;
  currentEs = new EventSource(`/api/jobs/${id}/stream`);
  currentEs.onmessage = (ev) => {
    try { renderJob(JSON.parse(ev.data)); } catch (_) {}
  };
  currentEs.onerror = () => {};
}

function renderJob(job) {
  stepLabel.textContent = STEP_LABELS[job.step] || job.step.toUpperCase();
  const pct = Math.max(0, Math.min(100, job.progress || 0));
  progressPct.textContent = pct.toFixed(0) + '%';
  progressFill.style.width = pct + '%';
  logsEl.textContent = (job.logs || []).slice(-80).join('\n');
  logsEl.scrollTop = logsEl.scrollHeight;

  if (job.clips && job.clips.length) renderClips(job.id, job.clips);

  if (job.status === 'done') {
    setStatus('done', 'TERMINÉ');
    goEl.disabled = false;
    if (currentEs) currentEs.close();
  } else if (job.status === 'error') {
    showError(job.error || 'Erreur inconnue');
    setStatus('err', 'ERREUR');
    goEl.disabled = false;
    if (currentEs) currentEs.close();
  }
}

function fmtTC(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function renderClips(jobId, clips) {
  clipsPanel.hidden = false;
  clipsCount.textContent = String(clips.length).padStart(2, '0');
  clipsList.innerHTML = '';
  for (const c of clips) {
    const card = document.createElement('article');
    card.className = 'clip';
    const score = Math.round((c.score || 0) * 100);
    card.innerHTML = `
      <video controls preload="metadata" src="/api/jobs/${jobId}/clips/${c.filename}/stream"></video>
      <div class="clip-body">
        <div class="clip-meta">
          <span>CLIP ${String(c.index).padStart(2,'0')} · ${fmtTC(c.start)} → ${fmtTC(c.start + c.duration)}</span>
          <span class="score">${score}% <span class="score-bar"><span style="width:${score}%"></span></span></span>
        </div>
        <textarea class="clip-title" rows="2" aria-label="Titre du clip">${escapeHtml(c.title || '')}</textarea>
        <div class="clip-tags">${(c.hashtags || []).map(escapeHtml).join(' ')}</div>
        <div class="clip-actions">
          <button class="btn save" type="button">SAUVER TITRE</button>
          <a class="btn primary" href="/api/jobs/${jobId}/clips/${c.filename}/download">TÉLÉCHARGER</a>
        </div>
      </div>`;
    const ta = card.querySelector('.clip-title');
    card.querySelector('.save').addEventListener('click', async () => {
      const btn = card.querySelector('.save');
      btn.disabled = true; btn.textContent = 'ENREGISTRÉ';
      await fetch(`/api/jobs/${jobId}/clips/${c.index}`, {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ title: ta.value })
      });
      setTimeout(() => { btn.disabled = false; btn.textContent = 'SAUVER TITRE'; }, 1500);
    });
    clipsList.appendChild(card);
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function resetUI(){
  errorPanel.hidden = true; errorMsg.textContent = '';
  clipsPanel.hidden = true; clipsList.innerHTML = '';
  progressPanel.hidden = true; progressFill.style.width = '0%';
  progressPct.textContent = '0%'; logsEl.textContent = '';
}
function showError(msg){ errorPanel.hidden = false; errorMsg.textContent = msg; }
function setStatus(cls, text){ statusEl.className = 'status ' + cls; statusEl.textContent = text; }
