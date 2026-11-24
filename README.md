# Amitabh_MKB

Mosquito: a small browser game. The **person** lasers the mosquito before it bites the sleeper; the **mosquito** just has to survive.

- **Single player** – you vs the computer (pick Person or Mosquito).
- **Multiplayer** – create a room, share the 4-letter code; many people and many mosquitoes (up to 8 players).
- Player names, light / dark mode.

## Run

```bash
npm install
npm run dev     # restarts on file changes (or: npm start)
```

Open http://localhost:3456 (override with `PORT=...`).

## Controls

| Role | Controls |
| --- | --- |
| Person | move the mouse to aim, click to fire |
| Mosquito | WASD / arrow keys, or hold and drag |
| Single player | Space / P / Esc to pause |

## Layout

```
server/            HTTP + WebSocket server, rooms
public/index.html  markup only
public/css/        styles (light + dark)
public/js/         client modules
public/js/shared/  game rules, AI, config (used by browser and server)
```

Tune the game feel in `public/js/shared/config.js`.
