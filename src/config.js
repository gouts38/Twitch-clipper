'use strict';
require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  WORK_DIR: path.join(__dirname, '..', 'workdir'),
  // Réglages ajustables — voir README
  MAX_CLIPS: 8,
  CLIP_MIN_SEC: 30,
  CLIP_MAX_SEC: 60,
  PRE_ROLL_SEC: 15,
  POST_ROLL_SEC: 25,
  MIN_GAP_SEC: 45,
  RMS_WINDOW_SEC: 1,
  PEAK_STD_ABOVE_MEAN: 1.2,
  DOWNLOAD_FORMAT: 'best[ext=mp4]/best'
};
