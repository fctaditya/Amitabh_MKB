// All audio routed through one Web Audio graph with a dynamics compressor
// so every sound (buzz, strike, beeps) has consistent, balanced loudness.

const BUZZ_VOL      = 0.55;   // mosquito ambient hum
const STRIKE_VOL    = 0.70;   // hit confirmation
const BEEP_VOL      = 0.12;   // laser fire cue
const BUZZ_LOOP_END = 4.0;    // trim: loop only the first 4 s of the 7 s file

let actx       = null;
let comp       = null;   // master dynamics compressor (shared by all sounds)
let buzzBuffer = null;
let strikeBuf  = null;
let buzzSrc    = null;
let buzzGain   = null;
let buzzWanted = false;

// ---------- shared context ----------

function ensureCtx() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return;
  }
  actx = new (window.AudioContext || window.webkitAudioContext)();

  // Dynamics compressor: tames peaks and evens out loudness between sounds
  comp = actx.createDynamicsCompressor();
  comp.threshold.value = -18;   // start compressing 18 dB below clipping
  comp.knee.value      =  10;   // soft knee for natural-sounding compression
  comp.ratio.value     =   6;   // 6:1 ratio — moderate, not over-squashed
  comp.attack.value    = 0.003; // 3 ms — fast enough to catch transients
  comp.release.value   = 0.15;  // 150 ms — natural tail
  comp.connect(actx.destination);

  // Load both files as AudioBuffers (decoded PCM — allows sample-accurate looping)
  fetchBuf('sounds/Mosquito_2.mp4').then(b => {
    buzzBuffer = b;
    if (buzzWanted) startBuzzNode();
  }).catch(() => {});

  fetchBuf('sounds/strike.mp3').then(b => { strikeBuf = b; }).catch(() => {});
}

async function fetchBuf(url) {
  const res = await fetch(url);
  const ab  = await res.arrayBuffer();
  return actx.decodeAudioData(ab);
}

// ---------- buzz loop ----------

function startBuzzNode() {
  if (!buzzBuffer || !actx) return;
  stopBuzzNode();

  buzzGain = actx.createGain();
  buzzGain.gain.value = BUZZ_VOL;
  buzzGain.connect(comp);

  // AudioBufferSourceNode gives sample-accurate looping between 0–4 s
  buzzSrc = actx.createBufferSource();
  buzzSrc.buffer    = buzzBuffer;
  buzzSrc.loop      = true;
  buzzSrc.loopStart = 0;
  buzzSrc.loopEnd   = BUZZ_LOOP_END;
  buzzSrc.connect(buzzGain);
  buzzSrc.start();
}

function stopBuzzNode() {
  if (buzzSrc)  { try { buzzSrc.stop(); } catch {} buzzSrc = null; }
  if (buzzGain) { buzzGain.disconnect(); buzzGain = null; }
}

export function setBuzz(on) {
  if (on === buzzWanted) return;
  buzzWanted = on;
  if (on) {
    ensureCtx();
    if (buzzBuffer) startBuzzNode();   // buffer already ready
    // else startBuzzNode() fires when the buffer finishes loading above
  } else {
    stopBuzzNode();
  }
}

// ---------- strike ----------

export function playStrike() {
  ensureCtx();
  if (!strikeBuf) return;
  const src  = actx.createBufferSource();
  const gain = actx.createGain();
  gain.gain.value = STRIKE_VOL;
  src.buffer = strikeBuf;
  src.connect(gain).connect(comp);
  src.start();
}

// ---------- synthesized laser beep ----------

export function beep(freq, duration, { type = 'sawtooth', volume = BEEP_VOL, slide = 0 } = {}) {
  ensureCtx();
  if (!actx) return;
  try {
    const now  = actx.currentTime;
    const osc  = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(comp);  // beeps also go through the compressor
    osc.start();
    osc.stop(now + duration);
  } catch {}
}
