// A session is "a game being played". Both kinds expose the same interface:
//   mode, role, myId, snapshot, paused, update(dt, input)
import { Game } from './shared/game.js';
import { MosquitoAI, PersonAI } from './shared/ai.js';
import { ROLES, DIFFICULTIES } from './shared/config.js';

const SEND_INTERVAL = 1 / 30;

/** Single player: the browser runs the game, the computer plays the other side. */
export class LocalSession {
  constructor(role, name, difficulty = 'medium') {
    const human = role === ROLES.PERSON;
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.medium;
    this.mode = 'local';
    this.role = role;
    this.difficulty = difficulty;
    this.myId = 'me';
    this.names = new Map([['me', name], ['cpu', 'Computer']]);
    this.paused = false;
    this.game = new Game({
      persons: [human ? 'me' : 'cpu'],
      mosquitos: [human ? 'cpu' : 'me'],
    });
    this.ai = human ? new MosquitoAI('cpu', diff) : new PersonAI('cpu', diff);
    this.snapshot = this.game.snapshot();
  }

  update(dt, input) {
    if (this.paused) return;
    const inp = { persons: {}, mosquitos: {} };
    if (this.role === ROLES.PERSON) {
      inp.persons.me = { aim: [input.x, input.y], fs: input.fireCount };
      inp.mosquitos.cpu = this.ai.think(dt, this.game);
    } else {
      inp.mosquitos.me = input.direction(this.snapshot.ms.find(m => m.id === 'me'));
      inp.persons.cpu = this.ai.think(dt, this.game);
    }
    this.game.step(dt, inp);
    this.snapshot = this.game.snapshot();
  }
}

/** Multiplayer: the server runs the game, we send our input and show its snapshots. */
export class OnlineSession {
  /** names: Map of player id -> display name */
  constructor(network, myId, role, names) {
    this.mode = 'online';
    this.names = names;
    this.network = network;
    this.myId = myId;
    this.role = role;
    this.paused = false;
    this.snapshot = null;
    this.sendTimer = 0;
  }

  update(dt, input) {
    this.sendTimer += dt;
    if (this.sendTimer < SEND_INTERVAL) return;
    this.sendTimer = 0;
    if (this.role === ROLES.PERSON) {
      this.network.send({ t: 'in', aim: [input.x, input.y], fs: input.fireCount });
    } else {
      const me = this.snapshot?.ms.find(m => m.id === this.myId);
      this.network.send({ t: 'in', mv: input.direction(me) });
    }
  }
}
