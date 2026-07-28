'use strict';
const { fmtTC } = require('./utils');

const TAG_POOLS = {
  low:  ['#twitch', '#stream', '#gaming', '#clip', '#vod'],
  mid:  ['#twitch', '#twitchclip', '#gaming', '#streamer', '#highlight'],
  high: ['#twitch', '#viral', '#momentfort', '#twitchclip', '#gamingclip']
};

function generateTitle(clip) {
  const pct = Math.round((clip.score || 0) * 100);
  let bucket = 'low';
  if (pct >= 70) bucket = 'high';
  else if (pct >= 40) bucket = 'mid';
  const label = bucket === 'high' ? 'MOMENT FORT' : bucket === 'mid' ? 'RÉACTION' : 'EXTRAIT';
  return {
    title: `${label} · ${fmtTC(clip.peakTime)} · intensité ${pct}%`,
    hashtags: TAG_POOLS[bucket]
  };
}

module.exports = { generateTitle };
