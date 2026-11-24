// Keyboard / mouse / touch input in world coordinates.
import { W, H } from './shared/config.js';

const KEYMAP = {
  ArrowLeft: 'l', a: 'l', A: 'l',
  ArrowRight: 'r', d: 'r', D: 'r',
  ArrowUp: 'u', w: 'u', W: 'u',
  ArrowDown: 'd', s: 'd', S: 'd',
};

export class Input {
  /** isActive(): whether a game is running (so arrow keys don't scroll etc.) */
  constructor(canvas, isActive) {
    this.canvas = canvas;
    this.isActive = isActive;
    this.keys = new Set();
    this.pointerDown = false;
    this.x = W / 2;          // aim / pointer position (world coords)
    this.y = H * 0.4;
    this.fireCount = 0;      // increments on each click (robust against dropped network packets)
    this.bind();
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('pointermove', e => this.setPointer(e));
    c.addEventListener('pointerdown', e => { this.setPointer(e); this.pointerDown = true; this.fireCount++; });
    addEventListener('pointerup', () => { this.pointerDown = false; });
    addEventListener('blur', () => { this.keys.clear(); this.pointerDown = false; });
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || !KEYMAP[e.key]) return;
      this.keys.add(KEYMAP[e.key]);
      if (this.isActive()) e.preventDefault();
    });
    addEventListener('keyup', e => { if (KEYMAP[e.key]) this.keys.delete(KEYMAP[e.key]); });
  }

  setPointer(e) {
    const r = this.canvas.getBoundingClientRect();
    this.x = ((e.clientX - r.left) / r.width) * W;
    this.y = ((e.clientY - r.top) / r.height) * H;
  }

  /** Mosquito flight direction from keys, or toward the pointer while held. */
  direction(pos) {
    const k = this.keys;
    let x = (k.has('r') ? 1 : 0) - (k.has('l') ? 1 : 0);
    let y = (k.has('d') ? 1 : 0) - (k.has('u') ? 1 : 0);
    if (!x && !y && this.pointerDown && pos) {
      const dx = this.x - pos.x, dy = this.y - pos.y, d = Math.hypot(dx, dy);
      if (d > 8) { x = dx / d; y = dy / d; }
    }
    return [x, y];
  }
}
