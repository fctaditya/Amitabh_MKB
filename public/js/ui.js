// DOM access in one place: screens, HUD, lobby list, toast.
const $ = id => document.getElementById(id);
const SCREENS = ['menu', 'singleRole', 'multi', 'lobby', 'over', 'paused'];

export const ui = {
  $,

  show(id) { SCREENS.forEach(s => { $(s).style.display = s === id ? 'flex' : 'none'; }); },
  isShowing(id) { return $(id).style.display === 'flex'; },

  toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.style.display = 'block';
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  },

  setHud(visible, { role = '', canPause = false } = {}) {
    $('hud').style.display = visible ? 'block' : 'none';
    $('pauseBtn').style.display = visible && canPause ? 'block' : 'none';
    $('role').textContent = role ? 'You: ' + role : '';
  },

  updateHud(snap) {
    $('hits').textContent = `${snap.h} / ${snap.tg}`;
    const s = Math.ceil(snap.tl);
    $('time').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  },

  setPaused(paused) {
    $('paused').style.display = paused ? 'flex' : 'none';
    $('pauseBtn').textContent = paused ? '▶' : 'II';
  },

  renderLobby({ code, players, hostId }, myId, lanUrls) {
    $('roomCode').textContent = code;
    $('lobbyInfo').textContent = 'Friends on the same Wi-Fi: open '
      + (lanUrls.length ? lanUrls.join(' or ') : 'this page') + ', tap Multiplayer, enter the code.';

    $('playerList').replaceChildren(...players.map(p => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = p.name + (p.id === myId ? ' (you)' : '') + (p.id === hostId ? ' ★' : '');
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = p.role;
      li.append(name, tag);
      return li;
    }));

    const me = players.find(p => p.id === myId);
    document.querySelectorAll('[data-role]').forEach(b => b.classList.toggle('active', me && b.dataset.role === me.role));
    const isHost = myId === hostId;
    $('startBtn').style.display = isHost ? '' : 'none';
    $('startBtn').disabled = !(players.some(p => p.role === 'person') && players.some(p => p.role === 'mosquito'));
  },

  showOver({ title, text, canRestart = true }) {
    $('overTitle').textContent = title;
    $('overText').textContent = text;
    ui.setAgain('Play again', !canRestart);
    ui.show('over');
  },

  setAgain(label, disabled) {
    $('againBtn').textContent = label;
    $('againBtn').disabled = disabled;
  },
};
