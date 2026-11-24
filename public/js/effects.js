// Short-lived visual effects: laser beams, blood particles, "+1" popups.
export const BEAM_LIFE = 0.18;
const GRAVITY = 300;
const PARTICLE_COLORS = ['#b3202a', '#e8a4a8', '#f6d3a0', '#7a1118'];

export class Effects {
  constructor() { this.clear(); }

  clear() { this.beams = []; this.particles = []; this.popups = []; }

  addShot(shot) {
    this.beams.push({ x1: shot.x1, y1: shot.y1, x2: shot.x2, y2: shot.y2, life: BEAM_LIFE });
    for (const hit of shot.hits) this.addHit(hit.x, hit.y);
  }

  addHit(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 160;
      this.particles.push({
        x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0.6 + Math.random() * 0.4, color: PARTICLE_COLORS[i % 4], r: 1.5 + Math.random() * 2.5,
      });
    }
    this.popups.push({ x, y: y - 18, life: 0.9, text: '+1' });
  }

  update(dt, paused) {
    this.beams.forEach(b => { b.life -= dt; });
    this.beams = this.beams.filter(b => b.life > 0);
    if (paused) return;
    this.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAVITY * dt; p.life -= dt; });
    this.popups.forEach(p => { p.y -= 30 * dt; p.life -= dt; });
    this.particles = this.particles.filter(p => p.life > 0);
    this.popups = this.popups.filter(p => p.life > 0);
  }
}
