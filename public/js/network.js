// Thin WebSocket wrapper. Ignores events from sockets that were already replaced/closed.
export class Network {
  /** handlers = { message(msg), close() } */
  constructor(handlers) {
    this.handlers = handlers;
    this.ws = null;
  }

  open(onOpen) {
    this.close();
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    let ws;
    try { ws = new WebSocket(url); } catch { return false; }
    this.ws = ws;
    ws.onopen = onOpen;
    ws.onmessage = ev => {
      if (ws !== this.ws) return;
      try { this.handlers.message(JSON.parse(ev.data)); } catch (e) { console.error(e); }
    };
    ws.onclose = () => {
      if (ws !== this.ws) return;
      this.ws = null;
      this.handlers.close();
    };
    return true;
  }

  send(msg) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg));
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    if (ws) { try { ws.close(); } catch { /* already closed */ } }
  }
}
