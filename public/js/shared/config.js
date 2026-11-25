// Shared constants (browser + server). Tweak the feel of the game here.
export const W = 416;                              // logical world width  (≈9:19 portrait ratio)
export const H = 900;                              // logical world height
export const ORIGIN = { x: W / 2, y: H * 0.8 - 30 }; // where the laser leaves the sleeper

export const ROLES = { PERSON: 'person', MOSQUITO: 'mosquito' };

export const CONFIG = {
  WIN_HITS: 5,          // hits needed per mosquito for the persons to win
  ROUND_TIME: 60,       // mosquitoes win if they survive this many seconds
  COUNTDOWN: 3,
  MOSQ_SPEED: 200,      // mosquito max speed (px/s) — scaled from 340 for W=416
  MOSQ_ACCEL: 9,        // how snappy its steering is
  FIRE_COOLDOWN: 0.6,   // seconds between laser shots (per person)
  HIT_RADIUS: 17,       // laser hit distance from the beam — scaled from 28 for W=416
  INVULN: 1.0,          // seconds a mosquito is safe after respawning
  SHOT_KEEP: 0.3,       // seconds a shot stays in snapshots (clients de-duplicate by id)
  BOUNDS: { minX: 18, maxX: W - 18, minY: 70, maxY: H * 0.68 },
  MAX_PLAYERS: 8,

  // computer difficulty (medium defaults — overridden per-game via DIFFICULTIES)
  AI_MOSQ_REACT: 0.25,  // mosquito AI sees the aim lines this late (s)
  AI_MOSQ_SPEED: 0.85,  // fraction of max speed the mosquito AI uses
  AI_MOSQ_DANGER: 90,   // it dodges when a line is closer than this (px)
  AI_AIM_SPEED: 130,    // how fast the person AI moves its aim (px/s)
  AI_AIM_LAG: 0.6,      // person AI sees the mosquito this late (s)
  AI_AIM_WOBBLE: 90,    // person AI aim inaccuracy (px)
};

/** Difficulty presets for single-player AI — merged into CONFIG at session start. */
export const DIFFICULTIES = {
  easy: {
    label: 'Easy',
    AI_MOSQ_REACT: 0.5,  AI_MOSQ_SPEED: 0.55, AI_MOSQ_DANGER: 55,
    AI_AIM_SPEED:  77,   AI_AIM_LAG:    1.1,  AI_AIM_WOBBLE:  135,
  },
  medium: {
    label: 'Medium',
    AI_MOSQ_REACT: 0.25, AI_MOSQ_SPEED: 0.85, AI_MOSQ_DANGER: 90,
    AI_AIM_SPEED:  130,  AI_AIM_LAG:    0.6,  AI_AIM_WOBBLE:  90,
  },
  hard: {
    label: 'Hard',
    AI_MOSQ_REACT: 0.1,  AI_MOSQ_SPEED: 1.0,  AI_MOSQ_DANGER: 120,
    AI_AIM_SPEED:  200,  AI_AIM_LAG:    0.2,  AI_AIM_WOBBLE:   30,
  },
};
