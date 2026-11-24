// Shared constants (browser + server). Tweak the feel of the game here.
export const W = 700;                              // logical world size
export const H = 900;
export const ORIGIN = { x: W / 2, y: H * 0.8 - 30 }; // where the laser leaves the sleeper

export const ROLES = { PERSON: 'person', MOSQUITO: 'mosquito' };

export const CONFIG = {
  WIN_HITS: 5,          // hits needed per mosquito for the persons to win
  ROUND_TIME: 45,       // mosquitoes win if they survive this many seconds
  COUNTDOWN: 3,
  MOSQ_SPEED: 340,      // mosquito max speed (px/s)
  MOSQ_ACCEL: 9,        // how snappy its steering is
  FIRE_COOLDOWN: 0.6,   // seconds between laser shots (per person)
  HIT_RADIUS: 28,       // laser hit distance from the beam
  INVULN: 1.0,          // seconds a mosquito is safe after respawning
  SHOT_KEEP: 0.3,       // seconds a shot stays in snapshots (clients de-duplicate by id)
  BOUNDS: { minX: 30, maxX: W - 30, minY: 70, maxY: H * 0.68 },
  MAX_PLAYERS: 8,

  // computer difficulty
  AI_MOSQ_REACT: 0.25,  // mosquito AI sees the aim lines this late (s)
  AI_MOSQ_SPEED: 0.85,  // fraction of max speed the mosquito AI uses
  AI_MOSQ_DANGER: 150,  // it dodges when a line is closer than this
  AI_AIM_SPEED: 220,    // how fast the person AI moves its aim (px/s)
  AI_AIM_LAG: 0.6,     // person AI sees the mosquito this late (s)
  AI_AIM_WOBBLE: 150,   // person AI aim inaccuracy (px)
};
