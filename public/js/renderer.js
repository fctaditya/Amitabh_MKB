// Canvas rendering. Pure drawing: reads state, never changes game state.
import { W, H, ORIGIN, CONFIG } from './shared/config.js';
import { BEAM_LIFE } from './effects.js';

const TAU = Math.PI * 2;
const FACE_SRC = 'Person.png';

const THEMES = {
  light: {
    bgInner: '#fbfbf9', bgOuter: '#e4e4e0', line: '#222', bed: '#8d8d8d', bedLight: '#a9a9a9', pillow: '#2f4f4a',
    text: '#222', panel: 'rgba(241,241,238,.75)', aimMine: 'rgba(80,80,90,.7)', aimOther: 'rgba(150,60,60,.55)',
    ring: 'rgba(31,42,60,.45)', legs: '#333', head: '#222',
  },
  dark: {
    bgInner: '#2a2f3a', bgOuter: '#171a21', line: '#d8dbe2', bed: '#4a505e', bedLight: '#5a6172', pillow: '#3d6b63',
    text: '#eceef2', panel: 'rgba(23,26,33,.8)', aimMine: 'rgba(220,225,235,.8)', aimOther: 'rgba(255,130,130,.7)',
    ring: 'rgba(220,225,235,.5)', legs: '#cfd3da', head: '#cfd3da',
  },
};

export class Renderer {
  constructor(canvas, stage) {
    this.canvas = canvas;
    this.stage = stage;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.time = 0;
    this.theme = THEMES.light;
    this.mosquitos = new Map();   // id -> smoothed { x, y }
    this.aims = new Map();        // id -> smoothed { x, y } (other persons' aim)

    this.face = new Image();
    this.faceReady = false;
    this.face.onload = () => { this.faceReady = true; };
    this.face.src = FACE_SRC;

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** Scale the logical W x H world to the window (half the screen on wide displays). */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const maxW = innerWidth > innerHeight ? innerWidth * 0.5 : innerWidth;
    this.scale = Math.min(innerHeight / H, maxW / W);
    const cw = Math.round(W * this.scale), ch = Math.round(H * this.scale);
    for (const el of [this.stage, this.canvas]) { el.style.width = cw + 'px'; el.style.height = ch + 'px'; }
    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.ctx.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
  }

  setDark(dark) { this.theme = dark ? THEMES.dark : THEMES.light; }

  reset() { this.mosquitos.clear(); this.aims.clear(); }

  /** Ease rendered positions toward the latest snapshot (smooth = online). */
  sync(dt, snap, smooth) {
    const k = smooth ? 1 - Math.exp(-dt * 25) : 1;
    this.time += dt;
    for (const m of snap.ms) {
      const r = this.mosquitos.get(m.id) || { x: m.x, y: m.y };
      if (Math.hypot(m.x - r.x, m.y - r.y) > 150) { r.x = m.x; r.y = m.y; }   // respawn: jump
      r.x += (m.x - r.x) * k; r.y += (m.y - r.y) * k;
      this.mosquitos.set(m.id, r);
    }
    for (const p of snap.ps) {
      const r = this.aims.get(p.id) || { x: p.x, y: p.y };
      r.x += (p.x - r.x) * k; r.y += (p.y - r.y) * k;
      this.aims.set(p.id, r);
    }
  }

  /** view = { snap, myId, role, names (Map id -> name), input, effects } */
  draw(view) {
    const { ctx } = this;
    this.drawBackground();
    this.drawBed();

    const { snap } = view;
    if (snap) {
      for (const m of snap.ms) {
        const pos = this.mosquitos.get(m.id) || m;
        this.drawMosquito(pos.x, pos.y, m.a, m.inv, m.id === view.myId);
        this.drawLabel(view.names.get(m.id), pos.x, pos.y - 28);
      }
      if (snap.p !== 'over') {
        for (const p of snap.ps) {
          const [x, y] = p.id === view.myId ? [view.input.x, view.input.y] : this.aimPos(p);
          this.drawAim(x, y, p.id === view.myId);
          this.drawLabel(view.names.get(p.id), x, y - 14);
        }
      }
    }
    this.drawEffects(view.effects);
    if (snap && snap.p === 'countdown') this.drawCountdown(view);
    ctx.globalAlpha = 1;
  }

  aimPos(p) { const r = this.aims.get(p.id) || p; return [r.x, r.y]; }

  drawBackground() {
    const { ctx } = this;
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.7);
    g.addColorStop(0, this.theme.bgInner);
    g.addColorStop(1, this.theme.bgOuter);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawBed() {
    const { ctx } = this;
    const xs = W / 700;   // keep bed artwork at original proportions regardless of world width
    ctx.save();
    ctx.translate(W / 2, H * 0.8);

    // Draw bed body with x-scale applied
    ctx.save();
    ctx.scale(xs, 1);
    ctx.lineWidth = 3; ctx.strokeStyle = this.theme.line; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-110, -40); ctx.lineTo(-110, 55);
    ctx.moveTo(-110, -40); ctx.lineTo(-100, -48); ctx.lineTo(-100, 10);
    ctx.stroke();

    ctx.fillStyle = this.theme.bed; ctx.beginPath();
    ctx.moveTo(-105, 5); ctx.lineTo(95, -10); ctx.lineTo(105, 30); ctx.lineTo(-100, 42); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = this.theme.bedLight; ctx.beginPath();
    ctx.moveTo(-40, 2); ctx.lineTo(95, -10); ctx.lineTo(105, 30); ctx.lineTo(-38, 40); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.beginPath(); ctx.moveTo(-100, 42); ctx.lineTo(-100, 60); ctx.moveTo(100, 30); ctx.lineTo(100, 50); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-60, -8); ctx.lineTo(60, -14); ctx.moveTo(-20, -12); ctx.lineTo(-10, -2); ctx.stroke();
    ctx.fillStyle = this.theme.pillow; ctx.beginPath(); ctx.ellipse(-82, -16, 22, 14, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();  // undo x-scale

    // Draw head as a true circle at the scaled x position
    this.drawHead(-82 * xs, -30, 20);
    ctx.restore();
  }

  drawHead(x, y, r) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    if (this.faceReady) {
      ctx.drawImage(this.face, x - r, y - r, r * 2, r * 2);
    } else {                                   // fallback face until Person.png loads
      ctx.fillStyle = '#e9c9a6'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = '#222';
      ctx.fillRect(x - 9, y - 4, 4, 3); ctx.fillRect(x + 5, y - 4, 4, 3); ctx.fillRect(x - 6, y + 8, 12, 2);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  }

  drawMosquito(x, y, angle, blink, isMine) {
    const { ctx } = this, t = this.time;
    ctx.save();
    ctx.translate(x, y);
    if (isMine) {                               // ring so you can find yourself among many
      ctx.strokeStyle = this.theme.ring; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.rotate(angle);
    if (blink) ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 30);

    const flap = Math.sin(t * 60) * 0.6;
    ctx.fillStyle = 'rgba(160,160,170,.45)';
    ctx.beginPath(); ctx.ellipse(-2, -5, 8, 3, -0.6 + flap, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-2, 5, 8, 3, 0.6 - flap, 0, TAU); ctx.fill();

    ctx.strokeStyle = this.theme.legs; ctx.lineWidth = 1; ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(0, 0); ctx.lineTo(-6, s * 9);
      ctx.moveTo(2, 0); ctx.lineTo(2, s * 10);
      ctx.moveTo(4, 0); ctx.lineTo(8, s * 8);
    }
    ctx.stroke();

    ctx.fillStyle = '#c0202b'; ctx.beginPath(); ctx.ellipse(-5, 0, 9, 3.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = this.theme.head; ctx.beginPath(); ctx.ellipse(5, 0, 4, 3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = this.theme.head; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(15, 0); ctx.stroke();
    ctx.restore();
  }

  drawLabel(name, x, y) {
    if (!name) return;
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme.text;
    ctx.globalAlpha = 0.85;
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  drawAim(x, y, isMine) {
    const { ctx } = this;
    ctx.save();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = isMine ? this.theme.aimMine : this.theme.aimOther;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ORIGIN.x, ORIGIN.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  drawEffects({ beams, particles, popups }) {
    const { ctx } = this;
    for (const b of beams) {
      const a = Math.max(0, b.life / BEAM_LIFE);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,120,60,${0.35 * a})`; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,150,90,${0.9 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.fillStyle = `rgba(255,210,60,${a})`;
      ctx.beginPath(); ctx.arc(b.x1, b.y1, 7 * a + 2, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = this.theme.text; ctx.font = '600 20px system-ui'; ctx.textAlign = 'center';
    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  drawCountdown({ snap, role }) {
    const { ctx } = this;
    const [title, hint] = hintText(role);
    const top = H * 0.25;
    ctx.fillStyle = this.theme.panel; ctx.fillRect(0, top, W, 260);
    ctx.fillStyle = this.theme.text; ctx.textAlign = 'center';
    ctx.font = '700 26px system-ui'; ctx.fillText(title, W / 2, top + 50);
    ctx.font = '15px system-ui';
    this.wrapText(hint, W / 2, top + 82, W - 20, 22);
    ctx.font = '700 80px system-ui'; ctx.fillText(snap.c, W / 2, top + 225);
  }

  wrapText(text, x, y, maxWidth, lineHeight) {
    const { ctx } = this;
    let line = '';
    for (const word of text.split(' ')) {
      if (ctx.measureText(line + word).width > maxWidth) { ctx.fillText(line, x, y); line = ''; y += lineHeight; }
      line += word + ' ';
    }
    ctx.fillText(line, x, y);
  }
}

export function hintText(role) {
  const touch = navigator.maxTouchPoints > 0;
  return role === 'person'
    ? ['You are the PERSON', `${touch ? 'Tap' : 'Move to aim, click'} to fire. Hit the mosquito ${CONFIG.WIN_HITS} times in ${CONFIG.ROUND_TIME}s.`]
    : ['You are the MOSQUITO', `${touch ? 'Hold & drag' : 'WASD / arrows (or hold & drag)'} to fly. Survive for ${CONFIG.ROUND_TIME}s.`];
}
