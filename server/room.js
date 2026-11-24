// One online room: a lobby where players pick a side, then a server-authoritative game.
import { Game } from '../public/js/shared/game.js';
import { CONFIG, ROLES, W, H } from '../public/js/shared/config.js';

const TICK_MS = 16;
const MAX_NAME = 12;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+v) ? +v : 0));
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

export class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();   // id -> { id, name, role, ws, aim, fs, mv }
    this.hostId = null;
    this.game = null;
    this.timer = null;
    this.lastTick = 0;
    this.again = new Set();
    this.nextId = 1;
  }

  get inGame() { return this.game !== null; }
  get isEmpty() { return this.players.size === 0; }
  count(role) { return [...this.players.values()].filter(p => p.role === role).length; }

  // ---- membership ----
  add(ws, name) {
    if (this.inGame) return 'Game already started.';
    if (this.players.size >= CONFIG.MAX_PLAYERS) return 'Room is full.';
    const id = this.nextId++;
    const role = this.count(ROLES.PERSON) <= this.count(ROLES.MOSQUITO) ? ROLES.PERSON : ROLES.MOSQUITO;
    const cleanName = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME);
    this.players.set(id, { id, name: cleanName || `Player ${id}`, role, ws, aim: null, fs: 0, mv: [0, 0] });
    if (this.hostId === null) this.hostId = id;
    ws.playerId = id;
    return null;
  }

  remove(id) {
    const gone = this.players.get(id);
    if (!gone) return;
    this.players.delete(id);
    this.again.delete(id);
    if (this.hostId === id) this.hostId = this.players.keys().next().value ?? null;
    if (this.isEmpty) return this.stopGame();

    if (!this.inGame) return this.broadcastLobby();
    this.game.removePlayer(id);
    const sidesLeft = this.count(ROLES.PERSON) > 0 && this.count(ROLES.MOSQUITO) > 0;
    if (!sidesLeft) this.backToLobby('A whole side left, back to the lobby.');
    else this.maybeRestart();
  }

  setRole(id, role) {
    const p = this.players.get(id);
    if (!p || this.inGame || (role !== ROLES.PERSON && role !== ROLES.MOSQUITO)) return;
    p.role = role;
    this.broadcastLobby();
  }

  // ---- game flow ----
  start(id) {
    if (this.inGame || id !== this.hostId) return;
    if (!this.count(ROLES.PERSON) || !this.count(ROLES.MOSQUITO)) {
      return this.notify(id, 'Need at least one Person and one Mosquito.');
    }
    const ids = role => [...this.players.values()].filter(p => p.role === role).map(p => p.id);
    this.game = new Game({ persons: ids(ROLES.PERSON), mosquitos: ids(ROLES.MOSQUITO) });
    for (const p of this.players.values()) {
      send(p.ws, { t: 'started', id: p.id, role: p.role });
    }
    this.startRound();
  }

  startRound() {
    this.game.reset();
    this.again.clear();
    for (const p of this.players.values()) p.mv = [0, 0];
    this.lastTick = Date.now();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.05, (now - this.lastTick) / 1000);
    this.lastTick = now;

    const input = { mosquitos: {}, persons: {} };
    for (const p of this.players.values()) {
      if (p.role === ROLES.MOSQUITO) input.mosquitos[p.id] = p.mv;
      else input.persons[p.id] = { aim: p.aim, fs: p.fs };
    }
    this.game.step(dt, input);
    this.broadcast({ t: 'st', s: this.game.snapshot() });
    if (this.game.phase === 'over') this.stopTimer();
  }

  handleInput(id, m) {
    const p = this.players.get(id);
    if (!p || !this.inGame) return;
    if (p.role === ROLES.PERSON) {
      if (Array.isArray(m.aim)) p.aim = [clamp(m.aim[0], 0, W), clamp(m.aim[1], 0, H)];
      const fs = m.fs | 0;
      if (fs > p.fs) p.fs = fs;
    } else if (Array.isArray(m.mv)) {
      p.mv = [clamp(m.mv[0], -1, 1), clamp(m.mv[1], -1, 1)];
    }
  }

  vote(id) {
    if (!this.inGame || this.game.phase !== 'over') return;
    this.again.add(id);
    this.maybeRestart();
  }

  maybeRestart() {
    if (this.game?.phase === 'over' && this.again.size >= this.players.size) this.startRound();
  }

  backToLobby(notice) {
    this.stopGame();
    this.broadcastLobby(notice);
  }

  stopTimer() { clearInterval(this.timer); this.timer = null; }
  stopGame() { this.stopTimer(); this.game = null; this.again.clear(); }

  // ---- messaging ----
  broadcast(msg) { for (const p of this.players.values()) send(p.ws, msg); }
  notify(id, msg) { const p = this.players.get(id); if (p) send(p.ws, { t: 'err', msg }); }

  broadcastLobby(notice) {
    this.broadcast({
      t: 'lobby', code: this.code, hostId: this.hostId, notice,
      players: [...this.players.values()].map(({ id, name, role }) => ({ id, name, role })),
    });
  }
}
