// App controller: wires UI, input, sessions, network and the render loop together.
import { CONFIG, ROLES } from './shared/config.js';
import { LocalSession, OnlineSession } from './session.js';
import { Network } from './network.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Renderer } from './renderer.js';
import { beep, playStrike, setBuzz } from './audio.js';
import { ui } from './ui.js';
import { theme } from './theme.js';

const OVER_DELAY_MS = 700;
const NAME_KEY = 'mosquito-name';
const MAX_NAME = 12;

const canvas = ui.$('game');
const renderer = new Renderer(canvas, ui.$('stage'));
const effects = new Effects();
const input = new Input(canvas, () => session !== null);
const network = new Network({ message: onMessage, close: onNetworkClosed });

let session = null;
let lobby = null;           // latest lobby state from the server
let myId = null;
let lanUrls = [];
let lastShotId = 0;
let overShown = false;
let overTimer = null;
let pendingRole = null;     // role chosen before difficulty screen

// ---------- player name ----------
function playerName() {
  const name = ui.$('nameInput').value.trim().slice(0, MAX_NAME);
  try { localStorage.setItem(NAME_KEY, name); } catch { /* storage blocked */ }
  return name;
}

function restoreName() {
  try { ui.$('nameInput').value = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }
}

// ---------- game lifecycle ----------
function resetRound() {
  effects.clear();
  renderer.reset();
  lastShotId = 0;
  overShown = false;
  clearTimeout(overTimer);
}

function enterGame(newSession) {
  resetRound();
  session = newSession;
  ui.show(null);
  ui.setHud(true, { role: `${session.names.get(session.myId)} · ${session.role}`, canPause: session.mode === 'local' });
}

function leaveGame() {
  session = null;
  resetRound();
  setBuzz(false);
  ui.setHud(false);
  ui.setPaused(false);
}

function setPaused(paused) {
  if (!session || session.mode !== 'local') return;
  session.paused = paused;
  ui.setPaused(paused);
}

function startSingle(role, difficulty = 'medium') { enterGame(new LocalSession(role, playerName() || 'You', difficulty)); }

// ---------- reacting to a snapshot ----------
function handleSnapshot(snap) {
  if (snap.sid < lastShotId) lastShotId = 0;             // new round
  for (const shot of snap.sh) {
    if (shot.id <= lastShotId) continue;
    lastShotId = shot.id;
    effects.addShot(shot);
    beep(shot.hit ? 520 : 300, 0.15, { slide: -250 });
    if (shot.hit) playStrike();
  }

  setBuzz(snap.p === 'playing' && !session.paused);

  if (snap.p === 'countdown' && overShown) {             // rematch started
    overShown = false;
    clearTimeout(overTimer);
    ui.show(null);
  }
  if (snap.p === 'over' && !overShown) {
    overShown = true;
    overTimer = setTimeout(showOver, OVER_DELAY_MS);
  }
}

function showOver() {
  const snap = session?.snapshot;
  if (!snap) return;
  const won = snap.w === session.role;
  const text = snap.w === ROLES.PERSON
    ? `The persons hit the mosquito ${snap.tg} times in total.`
    : `The mosquito survived ${CONFIG.ROUND_TIME} seconds. Hits: ${snap.h} / ${snap.tg}.`;
  ui.showOver({ title: won ? 'You win!' : 'You lose', text });
}

// ---------- online ----------
function onMessage(m) {
  switch (m.t) {
    case 'joined':
      myId = m.id;
      lanUrls = m.lan;
      break;
    case 'lobby':
      lobby = m;
      if (session) leaveGame();                          // game was stopped, back to the lobby
      ui.renderLobby(lobby, myId, lanUrls);
      ui.show('lobby');
      if (m.notice) ui.toast(m.notice);
      break;
    case 'started':
      myId = m.id;
      enterGame(new OnlineSession(network, m.id, m.role, new Map(lobby.players.map(p => [p.id, p.name]))));
      break;
    case 'st':
      if (session?.mode === 'online') session.snapshot = m.s;
      break;
    case 'err':
      ui.toast(m.msg);
      break;
  }
}

function onNetworkClosed() {
  if (session?.mode === 'online' || ui.isShowing('lobby')) {
    ui.toast('Disconnected from server');
    leaveGame();
    ui.show('menu');
  }
}

function leaveRoom() {
  network.send({ t: 'leave' });
  network.close();
  lobby = null;
}

// ---------- menu wiring ----------
ui.$('singleBtn').onclick = () => ui.show('singleRole');
ui.$('multiBtn').onclick = () => ui.show('multi');
document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => ui.show('menu'); });
document.querySelectorAll('[data-back-diff]').forEach(b => { b.onclick = () => ui.show('singleRole'); });
document.querySelectorAll('[data-single]').forEach(b => {
  b.onclick = () => { pendingRole = b.dataset.single; ui.show('singleDiff'); };
});
document.querySelectorAll('[data-diff]').forEach(b => {
  b.onclick = () => startSingle(pendingRole, b.dataset.diff);
});
document.querySelectorAll('[data-role]').forEach(b => { b.onclick = () => network.send({ t: 'role', role: b.dataset.role }); });

ui.$('createBtn').onclick = () => {
  if (!network.open(() => network.send({ t: 'create', name: playerName() }))) ui.toast('Cannot connect to server');
};
ui.$('joinBtn').onclick = () => {
  const code = ui.$('codeInput').value.trim().toUpperCase();
  if (code.length !== 4) return ui.toast('Enter the 4-letter room code');
  if (!network.open(() => network.send({ t: 'join', code, name: playerName() }))) ui.toast('Cannot connect to server');
};
ui.$('startBtn').onclick = () => network.send({ t: 'start' });
ui.$('leaveBtn').onclick = () => { leaveRoom(); ui.show('multi'); };

ui.$('againBtn').onclick = () => {
  if (!session) return;
  if (session.mode === 'local') return startSingle(session.role, session.difficulty);
  network.send({ t: 'again' });
  ui.setAgain('Waiting for others…', true);
};
ui.$('menuBtn').onclick = () => {
  if (session?.mode === 'online') leaveRoom();
  leaveGame();
  ui.show('menu');
};

ui.$('pauseBtn').addEventListener('click', e => { e.stopPropagation(); setPaused(!session.paused); });
ui.$('paused').addEventListener('click', () => setPaused(false));
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || session?.mode !== 'local') return;
  if (e.key === ' ' || e.key === 'p' || e.key === 'Escape') { e.preventDefault(); setPaused(!session.paused); }
});

restoreName();
theme.init(ui.$('themeBtn'), dark => renderer.setDark(dark));
ui.show('menu');

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (session) {
    session.update(dt, input);
    const current = session.snapshot;
    if (current) {
      handleSnapshot(current);
      renderer.sync(dt, current, session.mode === 'online');
      ui.updateHud(current);
    }
  }
  effects.update(dt, session?.paused);
  renderer.draw({ snap: session?.snapshot ?? null, myId: session?.myId, role: session?.role, names: session?.names ?? new Map(), input, effects });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
