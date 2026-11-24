// Pure game rules. Runs in the browser (single player) and in Node (online rooms).
// Supports any number of persons (each with their own laser) and mosquitoes.
import { W, H, ORIGIN, CONFIG as C } from './config.js';
import { clamp, segDist, randRange } from './geometry.js';

const round1 = v => Math.round(v * 10) / 10;

export class Game {
  /** roster = { persons: [id...], mosquitos: [id...] } */
  constructor(roster) {
    this.roster = { persons: [...roster.persons], mosquitos: [...roster.mosquitos] };
    this.reset();
  }

  reset() {
    const n = this.roster.mosquitos.length;
    this.phase = 'countdown';          // countdown -> playing -> over
    this.count = C.COUNTDOWN;
    this.timeLeft = C.ROUND_TIME;
    this.hits = 0;
    this.winner = null;                // 'person' | 'mosquito'
    this.clock = 0;
    this.shotId = 0;
    this.shots = [];
    this.target = C.WIN_HITS * n;
    this.mosquitos = new Map(this.roster.mosquitos.map((id, i) => [id, {
      x: (W * (i + 1)) / (n + 1), y: H * 0.3, vx: 0, vy: 0, ang: -Math.PI / 2, invuln: 0,
    }]));
    this.persons = new Map(this.roster.persons.map(id => [id, {
      aim: { x: W / 2, y: H * 0.4 }, cooldown: 0, lastFs: null,
    }]));
  }

  /**
   * input = {
   *   mosquitos: { [id]: [dx, dy] },            // movement direction
   *   persons:   { [id]: { aim: [x, y], fs } }  // aim point + fire counter
   * }
   */
  step(dt, input = {}) {
    const fires = this.readPersonInput(input.persons || {});

    if (this.phase === 'countdown') {
      this.count -= dt;
      if (this.count <= 0) { this.phase = 'playing'; this.count = 0; }
      return;
    }
    if (this.phase !== 'playing') return;

    this.clock += dt;
    this.timeLeft -= dt;
    for (const [id, m] of this.mosquitos) this.moveMosquito(m, dt, input.mosquitos?.[id]);
    for (const p of this.persons.values()) p.cooldown = Math.max(0, p.cooldown - dt);
    for (const id of fires) {
      if (this.phase === 'playing') this.fire(id);
    }
    if (this.phase === 'playing' && this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish('mosquito');
    }
  }

  /** Updates aims; returns ids of persons who pressed fire since last step. */
  readPersonInput(persons) {
    const fires = [];
    for (const [id, p] of this.persons) {
      const inp = persons[id];
      if (!inp) continue;
      if (inp.aim) {
        p.aim.x = clamp(+inp.aim[0] || 0, 0, W);
        p.aim.y = clamp(+inp.aim[1] || 0, 0, H);
      }
      const fs = inp.fs | 0;
      if (p.lastFs === null) p.lastFs = fs;     // first sight: just remember the counter
      if (fs > p.lastFs) fires.push(id);
      p.lastFs = Math.max(p.lastFs, fs);
    }
    return fires;
  }

  moveMosquito(m, dt, dir) {
    m.invuln = Math.max(0, m.invuln - dt);
    let mx = dir ? +dir[0] || 0 : 0, my = dir ? +dir[1] || 0 : 0;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const k = Math.min(1, dt * C.MOSQ_ACCEL), b = C.BOUNDS;
    m.vx += (mx * C.MOSQ_SPEED - m.vx) * k;
    m.vy += (my * C.MOSQ_SPEED - m.vy) * k;
    m.x = clamp(m.x + m.vx * dt, b.minX, b.maxX);
    m.y = clamp(m.y + m.vy * dt, b.minY, b.maxY);
    if (Math.hypot(m.vx, m.vy) > 20) m.ang = Math.atan2(m.vy, m.vx);
  }

  fire(personId) {
    const p = this.persons.get(personId);
    if (!p || p.cooldown > 0) return;
    p.cooldown = C.FIRE_COOLDOWN;

    const hits = [];
    for (const [id, m] of this.mosquitos) {
      if (m.invuln > 0) continue;
      if (segDist(m.x, m.y, ORIGIN.x, ORIGIN.y, p.aim.x, p.aim.y).d <= C.HIT_RADIUS) {
        hits.push({ id, x: m.x, y: m.y });
      }
    }
    this.shots.push({
      id: ++this.shotId, pid: personId, at: this.clock,
      x1: ORIGIN.x, y1: ORIGIN.y, x2: p.aim.x, y2: p.aim.y, hit: hits.length > 0, hits,
    });
    this.hits += hits.length;
    if (this.hits >= this.target) this.finish('person');
    else hits.forEach(h => this.respawn(h.id));
  }

  /** Respawns a mosquito at the best of a few random spots (far from every aim). */
  respawn(id) {
    const m = this.mosquitos.get(id);
    const aims = [...this.persons.values()].map(p => p.aim);
    let best = null, bestDist = -1;
    for (let i = 0; i < 8; i++) {
      const x = randRange(60, W - 60), y = randRange(90, 90 + H * 0.3);
      const d = Math.min(...aims.map(a => Math.hypot(x - a.x, y - a.y)));
      if (d > bestDist) { bestDist = d; best = { x, y }; }
    }
    Object.assign(m, { x: best.x, y: best.y, vx: 0, vy: 0, invuln: C.INVULN });
  }

  /** Remove a player who left mid-round (online). */
  removePlayer(id) {
    this.mosquitos.delete(id);
    this.persons.delete(id);
    this.target = C.WIN_HITS * this.mosquitos.size;
    if (this.phase === 'playing' && this.mosquitos.size && this.hits >= this.target) this.finish('person');
  }

  finish(winner) { this.phase = 'over'; this.winner = winner; }

  snapshot() {
    this.shots = this.shots.filter(s => s.at > this.clock - C.SHOT_KEEP);
    return {
      p: this.phase, c: Math.ceil(this.count), tl: round1(this.timeLeft),
      h: this.hits, tg: this.target, w: this.winner, sid: this.shotId, sh: this.shots,
      ms: [...this.mosquitos].map(([id, m]) => ({
        id, x: round1(m.x), y: round1(m.y), a: Math.round(m.ang * 100) / 100, inv: m.invuln > 0 ? 1 : 0,
      })),
      ps: [...this.persons].map(([id, p]) => ({ id, x: round1(p.aim.x), y: round1(p.aim.y) })),
    };
  }
}
