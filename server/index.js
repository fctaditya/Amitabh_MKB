// Mosquito game server: serves ./public and runs online rooms over WebSocket.
import http from 'node:http';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import { handleStatic } from './static.js';
import { Room } from './room.js';

const PORT = process.env.PORT || 3456;
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

const server = http.createServer(handleStatic);
const wss = new WebSocketServer({ server, maxPayload: 1024 });
const rooms = new Map();

function lanUrls() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.'))
    .map(i => `http://${i.address}:${PORT}`);
}

function makeCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const reply = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function joinedMessage(ws, room) {
  return { t: 'joined', id: ws.playerId, code: room.code, lan: lanUrls() };
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  room.remove(ws.playerId);
  if (room.isEmpty) rooms.delete(room.code);
}

function enter(ws, room, name) {
  const error = room.add(ws, name);
  if (error) return reply(ws, { t: 'err', msg: error });
  ws.room = room;
  rooms.set(room.code, room);
  reply(ws, joinedMessage(ws, room));
  room.broadcastLobby();
}

const handlers = {
  create(ws, m) {
    if (!ws.room) enter(ws, new Room(makeCode()), m.name);
  },
  join(ws, m) {
    if (ws.room) return;
    const room = rooms.get(String(m.code || '').toUpperCase().slice(0, 4));
    if (!room) return reply(ws, { t: 'err', msg: 'Room not found. Check the code.' });
    enter(ws, room, m.name);
  },
  role: (ws, m) => ws.room?.setRole(ws.playerId, m.role),
  start: ws => ws.room?.start(ws.playerId),
  in: (ws, m) => ws.room?.handleInput(ws.playerId, m),
  again: ws => ws.room?.vote(ws.playerId),
  leave,
};

wss.on('connection', ws => {
  ws.room = null;
  ws.playerId = null;

  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg && typeof msg.t === 'string' && Object.hasOwn(handlers, msg.t)) handlers[msg.t](ws, msg);
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`Mosquito game running at http://localhost:${PORT}`);
  const lan = lanUrls();
  if (lan.length) console.log('Other devices on your Wi-Fi can open: ' + lan.join('  '));
});
