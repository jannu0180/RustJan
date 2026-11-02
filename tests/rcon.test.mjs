import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { Monitor, validateProfile } from '../monitor.mjs';
import { createApp } from '../server.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 4000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out'); await delay(20); }
}
// A small independent WebSocket server: tests the actual Node WebSocket transport,
// HTTP upgrade, masked frames, correlation and unsolicited WebRCON messages.
async function mockRcon() {
  const requests = [], sockets = new Set(); let endpoint;
  const server = http.createServer();
  function send(socket, value) {
    const payload = Buffer.from(JSON.stringify(value));
    const header = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.from([0x81, 126, payload.length >> 8, payload.length & 255]);
    socket.write(Buffer.concat([header, payload]));
  }
  server.on('upgrade', (req, socket) => {
    endpoint = req.url; sockets.add(socket);
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    let buffer = Buffer.alloc(0);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 2) {
        let length = buffer[1] & 127, offset = 2;
        if (length === 126) { if (buffer.length < 4) return; length = buffer.readUInt16BE(2); offset = 4; }
        if (length === 127) { if (buffer.length < 10) return; length = Number(buffer.readBigUInt64BE(2)); offset = 10; }
        const masked = !!(buffer[1] & 128), opcode = buffer[0] & 15;
        if (buffer.length < offset + (masked ? 4 : 0) + length) return;
        const mask = masked ? buffer.subarray(offset, offset + 4) : null; if (masked) offset += 4;
        const data = Buffer.from(buffer.subarray(offset, offset + length));
        if (mask) for (let i = 0; i < length; i++) data[i] ^= mask[i % 4];
        buffer = buffer.subarray(offset + length);
        if (opcode === 8) { socket.end(Buffer.from([0x88, 0])); return; }
        if (opcode !== 1) continue;
        const request = JSON.parse(data.toString()); requests.push(request);
        const reply = value => send(socket, { Identifier: request.Identifier, Message: JSON.stringify(value), Type: 'Generic' });
        if (request.Message === 'serverinfo') reply({ Hostname: 'Integration server', Players: 1, MaxPlayers: 100, Framerate: 60, Memory: 4096, EntityCount: 12000, Uptime: 600 });
        else if (request.Message === 'playerlist') {
          reply([{ SteamID: '76561198000000001', DisplayName: '<img src=x onerror=alert(1)>', Ping: 42, ConnectedSeconds: 120 }]);
          send(socket, { Identifier: -1, Type: 'Chat', Message: JSON.stringify({ Username: 'Test player', Message: 'Hello from WebRCON', Channel: 0 }) });
          send(socket, { Identifier: -1, Type: 'Generic', Message: 'Server tick completed' });
        } else if (request.Message === 'chat.tail 100') reply([{ Username: 'Earlier player', Message: 'Historical message', Time: Math.floor(Date.now() / 1000) - 30, Channel: 0 }]);
        else if (request.Message === 'oxide.version') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'Oxide.Rust Version: 2.0.7000' });
        else if (request.Message === 'oxide.plugins') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'Listing 2 plugins:\n  01 "Kits" (4.4.0) by Author (0.04s / 1 MB) - Kits.cs\n  02 Welcome - Unloaded' });
        else if (request.Message === 'banlistex') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: '0 76561198000000009 "Banned user" "Test reason"' });
        else if (request.Message === 'server.seed') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'server.seed: "23456789"' });
        else if (request.Message === 'server.gamemode') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'server.gamemode: "vanilla"' });
        else if (request.Message === 'server.saveinterval') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'server.saveinterval: "200"' });
        else if (request.Message === 'server.tags') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'server.tags: "monthly,vanilla,EU"' });
        else if (request.Message === 'server.worldsize') send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'server.worldsize: "3500"' });
        else send(socket, { Identifier: request.Identifier, Type: 'Generic', Message: 'Command accepted' });
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, requests, endpoint: () => endpoint, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

test('validates address, RCON port, password and polling interval', () => {
  assert.equal(validateProfile({ host: 'localhost', port: 28016, password: 'p' }).interval, 5);
  for (const extra of [{ host: 'http://localhost/x' }, { port: 0 }, { port: 2.5 }, { password: '' }, { interval: 0 }]) {
    assert.throws(() => validateProfile({ host: 'localhost', port: 28016, password: 'p', ...extra }));
  }
});

test('real WebSocket handshake, read-only polling, correlated JSON, chat and explicit commands', async t => {
  const mock = await mockRcon(); const monitor = new Monitor();
  t.after(async () => { monitor.destroy(); await mock.close(); });
  monitor.connect({ host: '127.0.0.1', port: mock.port, serverPort: 16015, queryPort: 16016, appPort: 16082, password: 'secret /?#', interval: 3 });
  await until(() => monitor.state.players.length === 1 && monitor.state.chat.length === 2 && monitor.state.plugins.length === 2);
  assert.equal(mock.endpoint(), '/secret%20%2F%3F%23');
  assert.equal(monitor.state.info.Hostname, 'Integration server');
  assert.equal(monitor.state.info.Framerate, 60);
  assert.ok(monitor.state.lastUpdate);
  assert.ok(monitor.state.chat.some(c => c.message === 'Hello from WebRCON'));
  assert.equal(monitor.state.chat[0].message, 'Historical message');
  assert.ok(mock.requests.every(r => ['serverinfo', 'playerlist', 'chat.tail 100', 'oxide.version', 'oxide.plugins', 'banlistex', 'server.worldsize', 'server.seed', 'server.gamemode', 'server.saveinterval', 'server.tags'].includes(r.Message)));
  await until(()=>monitor.state.info.Tags==='monthly,vanilla,EU');
  assert.equal(monitor.state.info.Seed,23456789);assert.equal(monitor.state.info.WorldSize,3500);assert.equal(monitor.state.info.GameMode,'vanilla');assert.equal(monitor.state.info.SaveInterval,200);
  assert.equal(monitor.state.plugins[0].version, '4.4.0');
  assert.equal(monitor.state.plugins[1].status, 'disabled');
  assert.equal(monitor.state.bans[0].reason, 'Test reason');
  assert.ok(mock.requests.every(r => r.Name === 'RustJan' && Number.isInteger(r.Identifier)));
  assert.equal(monitor.pending.size, 0);
  monitor.sendChat('Hello "Rust"');
  await until(() => mock.requests.some(r => r.Message.startsWith('say ')));
  assert.equal(mock.requests.at(-1).Message, 'say "Hello \\"Rust\\""'.replaceAll('\\\\', '\\'));
  monitor.log('console', 'secret /?# secret%20%2F%3F%23');
  assert.ok(!JSON.stringify(monitor.state).includes('secret'));
  assert.throws(() => monitor.command('rcon.password'), /parooli/);
  assert.throws(() => monitor.pluginAction({ action: 'reload', file: 'Kits;quit' }));
  monitor.pluginAction({ action: 'reload', file: 'Kits' });
  await until(() => mock.requests.some(r => r.Message === 'oxide.reload Kits'));
  monitor.disconnect();
  assert.equal(monitor.state.status, 'disconnected');
  assert.equal(monitor.password, null);
  assert.equal(monitor.pending.size, 0);
  assert.equal(monitor.state.info.Hostname, 'Integration server');
});

test('demo remains explicit and never opens a server connection', () => {
  class ForbiddenSocket { constructor() { throw new Error('Must not connect'); } }
  const monitor = new Monitor({ WebSocketClass: ForbiddenSocket });
  monitor.demo(); assert.equal(monitor.state.status, 'demo');
  monitor.command('server.save');
  assert.ok(monitor.state.logs.at(-1).message.includes('ei saadetud'));
  monitor.destroy();
});

test('stale connection callbacks cannot reconnect after manual disconnect', async () => {
  const monitor = new Monitor({ timeout: 100 });
  monitor.connect({ host: '127.0.0.1', port: 1, password: 'private' });
  monitor.disconnect();
  await delay(160);
  assert.equal(monitor.state.status, 'disconnected');
  assert.equal(monitor.reconnectTimer, null);
  monitor.destroy();
});

test('malformed messages are bounded, and chat cannot inject new console commands', () => {
  const monitor = new Monitor();
  monitor.receive('not json'); monitor.receive('null'); monitor.receive('[]');
  assert.ok(monitor.state.logs[0].message.includes('vigase JSON'));
  monitor.pending.set(42, { kind: 'players', timer: setTimeout(() => {}, 1000), sent: Date.now() });
  monitor.receive(JSON.stringify({ Identifier: 42, Message: JSON.stringify([null, 'bad row', { SteamID: '76561198000000001', DisplayName: 'Valid row', Ping: null }]) }));
  assert.equal(monitor.state.players.length, 1);
  assert.equal(monitor.state.players[0].Ping, null);
  assert.throws(() => monitor.sendChat('hello\nserver.save'));
  for (let i = 0; i < 450; i++) monitor.log('console', `line ${i}`, false);
  assert.equal(monitor.state.logs.length, 400);
  monitor.destroy();
});

test('missing server responses trigger reconnect, and disconnect cancels retry', async () => {
  class SilentSocket extends EventTarget {
    constructor() { super(); this.readyState = 0; setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 0); }
    send() {}
    close() { this.readyState = 3; }
  }
  const monitor = new Monitor({ WebSocketClass: SilentSocket, timeout: 40 });
  monitor.connect({ host: 'localhost', port: 28016, password: 'test' });
  await until(() => monitor.state.status === 'reconnecting', 1000);
  assert.match(monitor.state.error, /aegus/);
  assert.ok(monitor.reconnectTimer);
  assert.equal(monitor.pending.size, 0);
  monitor.disconnect();
  assert.equal(monitor.reconnectTimer, null);
  assert.equal(monitor.password, null);
  monitor.destroy();
});

test('local API rejects cross-origin changes, wrong hosts and form posts; serves SSE', async t => {
  const app = createApp();
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const initial = await (await fetch(origin + '/api/state')).json();
  assert.equal(initial.status, 'disconnected');
  assert.equal((await fetch(origin + '/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://external.example' }, body: '{}' })).status, 403);
  assert.equal((await fetch(origin + '/api/demo', { method: 'POST', body: '{}' })).status, 415);
  const wrongHostStatus = await new Promise((resolve, reject) => http.get(origin + '/api/state', { headers: { Host: 'external.example' } }, response => { response.resume(); resolve(response.statusCode); }).on('error', reject));
  assert.equal(wrongHostStatus, 403);
  assert.equal((await fetch(origin + '/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"command":"server.save"}' })).status, 400);
  const controller = new AbortController();
  const stream = await fetch(origin + '/api/events', { signal: controller.signal });
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: state/);
  controller.abort();
  await reader.cancel().catch(() => {});
  assert.equal((await fetch(origin + '/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}' })).status, 200);
  assert.equal((await (await fetch(origin + '/api/state')).json()).status, 'demo');
});
