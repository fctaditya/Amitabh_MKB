// Computer players. Both only use information a human could see (a little late).
import { W, H, ORIGIN, CONFIG as C } from './config.js';
import { clamp, segDist, randRange } from './geometry.js';

/** Keeps a short history so the AI reacts with a human-like delay. */
class DelayedView {
  constructor(delay) { this.delay = delay; this.t = 0; this.items = []; }
  push(dt, value) {
    this.t += dt;
    this.items.push({ t: this.t, value });
    while (this.items.length > 1 && this.items[1].t < this.t - this.delay) this.items.shift();
    return this.items[0].value;
  }
}

/** Computer as the mosquito: flies randomly, dodging the (slightly delayed) laser lines. */
export class MosquitoAI {
  constructor(id) {
    this.id = id;
    this.view = new DelayedView(C.AI_MOSQ_REACT);
    this.wander = { x: W / 2, y: H * 0.3, timer: 0 };
  }

  /** Returns a movement direction [dx, dy]. */
  think(dt, game) {
    const me = game.mosquitos.get(this.id);
    if (!me) return [0, 0];
    const b = C.BOUNDS;
    const aims = this.view.push(dt, [...game.persons.values()].map(p => ({ x: p.aim.x, y: p.aim.y })));

    // random wandering target
    const w = this.wander;
    w.timer -= dt;
    if (w.timer <= 0 || Math.hypot(w.x - me.x, w.y - me.y) < 30) {
      w.x = randRange(b.minX + 40, b.maxX - 40);
      w.y = randRange(b.minY + 20, b.maxY - 20);
      w.timer = randRange(0.6, 1.4);
    }
    const wl = Math.hypot(w.x - me.x, w.y - me.y) || 1;
    let dx = ((w.x - me.x) / wl) * 0.5, dy = ((w.y - me.y) / wl) * 0.5;

    // dodge the closest laser line
    let danger = null;
    for (const a of aims) {
      const s = segDist(me.x, me.y, ORIGIN.x, ORIGIN.y, a.x, a.y);
      if (!danger || s.d < danger.d) danger = { ...s, a };
    }
    if (danger && danger.d < C.AI_MOSQ_DANGER) {
      let ax = me.x - danger.cx, ay = me.y - danger.cy, l = Math.hypot(ax, ay);
      if (l < 1) { ax = -(danger.a.y - ORIGIN.y); ay = danger.a.x - ORIGIN.x; l = Math.hypot(ax, ay) || 1; }
      const urge = 1 - danger.d / C.AI_MOSQ_DANGER;
      dx = dx * (1 - urge) + (ax / l) * urge * 1.4;
      dy = dy * (1 - urge) + (ay / l) * urge * 1.4;
    }

    // stay off the walls
    dx += (me.x < 90 ? 1 : 0) - (me.x > W - 90 ? 1 : 0);
    dy += (me.y < b.minY + 40 ? 1 : 0) - (me.y > b.maxY - 40 ? 1 : 0);

    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    return [dx * C.AI_MOSQ_SPEED, dy * C.AI_MOSQ_SPEED];
  }
}

/** Computer as the person: tracks the nearest mosquito with a wobbly aim and fires when on target. */
export class PersonAI {
  constructor(id) {
    this.id = id;
    this.view = new DelayedView(C.AI_AIM_LAG);
    this.ax = W / 2; this.ay = H * 0.4;
    this.fs = 0;
    this.offset = { x: 0, y: 0 };
    this.offsetTimer = 0;
    this.onTarget = 0;
    this.cooldown = 0;
  }

  /** Returns { aim: [x, y], fs } like a human person input. */
  think(dt, game) {
    const seen = this.view.push(dt, [...game.mosquitos.values()].map(m => ({ x: m.x, y: m.y })));
    if (seen.length) this.chase(dt, seen);
    this.maybeFire(dt, game);
    return { aim: [this.ax, this.ay], fs: this.fs };
  }

  chase(dt, seen) {
    const target = seen.reduce((best, m) =>
      Math.hypot(m.x - this.ax, m.y - this.ay) < Math.hypot(best.x - this.ax, best.y - this.ay) ? m : best);

    this.offsetTimer -= dt;
    if (this.offsetTimer <= 0) {               // re-roll aim inaccuracy now and then
      this.offsetTimer = randRange(0.5, 1);
      const r = C.AI_AIM_WOBBLE * randRange(0.4, 1), a = Math.random() * Math.PI * 2;
      this.offset = { x: Math.cos(a) * r, y: Math.sin(a) * r };
    }
    const dx = target.x + this.offset.x - this.ax, dy = target.y + this.offset.y - this.ay;
    const dist = Math.hypot(dx, dy), step = Math.min(dist, C.AI_AIM_SPEED * dt);
    if (dist > 0) { this.ax += (dx / dist) * step; this.ay += (dy / dist) * step; }
    this.ax = clamp(this.ax, 0, W);
    this.ay = clamp(this.ay, 0, H);
  }

  maybeFire(dt, game) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    const lined = game.phase === 'playing' && [...game.mosquitos.values()].some(m =>
      m.invuln <= 0 && segDist(m.x, m.y, ORIGIN.x, ORIGIN.y, this.ax, this.ay).d < C.HIT_RADIUS * 0.8);
    if (!lined) { this.onTarget = 0; return; }
    this.onTarget += dt;
    if (this.onTarget > 0.2 && this.cooldown <= 0) {
      this.fs++;
      this.cooldown = randRange(0.7, 1.2);
      this.onTarget = 0;
    }
  }
}
