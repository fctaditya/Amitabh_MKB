// Sound: looping mosquito buzz (kept quiet), laser strike, and synthesized laser beeps.
const BUZZ_VOLUME = 0.12;    // low, so the strike sound stays audible
const STRIKE_VOLUME = 1;
const BUZZ_START = 1;        // skip the first second of the buzz file, also when looping

const buzz = new Audio('sounds/mosquito.ogg');
buzz.volume = BUZZ_VOLUME;
const strike = new Audio('sounds/strike.mp3');
strike.volume = STRIKE_VOLUME;

let buzzWanted = false;
let ctx = null;

buzz.addEventListener('ended', () => {
  buzz.currentTime = BUZZ_START;
  if (buzzWanted) buzz.play().catch(() => {});
});

export function setBuzz(on) {
  if (on === buzzWanted) return;     // only act on changes, not every frame
  buzzWanted = on;
  if (!on) return buzz.pause();
  if (buzz.currentTime < BUZZ_START) buzz.currentTime = BUZZ_START;
  buzz.play().catch(() => {});
}

export function playStrike() {
  strike.currentTime = 0;
  strike.play().catch(() => {});
}

export function beep(freq, duration, { type = 'sawtooth', volume = 0.07, slide = 0 } = {}) {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(now + duration);
  } catch { /* audio unavailable */ }
}
