import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { normalizeProfile, validateProfile, Monitor } from '../monitor.mjs';
import { ConfigStore } from '../config.mjs';
import { SessionLogger, formatLogEntry } from '../file-logger.mjs';
import { CredentialVault } from '../vault.mjs';
import { createApp } from '../server.mjs';
const profile = { name: 'Test', host: '127.0.0.1', port: 28016, serverPort: 28015, queryPort: 28017, appPort: 28082, rconWeb: true, interval: 5, secure: false };
async function temp(t) { const dir = await mkdtemp(path.join(os.tmpdir(), 'rustjan-settings-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }
test('separate game/RCON/query/app ports validate without changing RCON transport identity', () => {
  const p = validateProfile({ ...profile, password: 'test' });
  assert.equal(p.port, 28016); assert.equal(p.rconPort, 28016); assert.equal(p.serverPort, 28015);
  assert.equal(normalizeProfile({ ...profile, rconWeb: false }).rconWeb, false);
  assert.throws(() => validateProfile({ ...profile, password: 'test', rconWeb: false }), /WebRCON/);
  assert.throws(() => normalizeProfile({ ...profile, queryPort: 28015 }), /erinevad/);
  assert.throws(() => normalizeProfile({ ...profile, appPort: 28016 }), /erinevad/);
  assert.throws(() => normalizeProfile({ ...profile, host: '0.0.0.0' }), /kuulamisaadress/);
  assert.equal(normalizeProfile({ ...profile, appPort: -1 }).appPort, -1);
  assert.equal(normalizeProfile({ ...profile, serverPort: 28016 }).serverPort, 28016); // UDP may share a number with RCON TCP.
});
test('configuration survives restart, excludes plaintext password and serializes independent setting changes', async t => {
  const dir = await temp(t), config = new ConfigStore(dir);
  await config.save({ profile: { ...profile, password: 'must-not-be-in-settings' }, rememberPassword: true });
  await Promise.all([config.save({ logging: { chat: true } }), config.save({ logging: { console: true } })]);
  const loaded = await new ConfigStore(dir).load();
  assert.equal(loaded.profile.serverPort, 28015); assert.equal(loaded.profile.queryPort, 28017); assert.equal(loaded.profile.appPort, 28082);
  assert.deepEqual(loaded.logging, { chat: true, console: true });
  assert.ok(!(await readFile(config.file, 'utf8')).includes('must-not-be-in-settings'));
});
test('daily logs append, honor independent switches and never overwrite another session', async t => {
  const dir = await temp(t), clock = () => Date.parse('2026-11-01T07:14:42.100Z');
  const first = new SessionLogger(dir, { clock, redact: v => v.replaceAll('secret', '[peidetud]') });
  first.configure({ chat: true, console: false });
  first.record('console', { time: clock(), message: 'not written', type: 'console' });
  first.record('chat', { time: clock(), name: 'Player', message: 'hello secret' });
  first.configure({ chat: false, console: true });
  first.record('chat', { time: clock(), name: 'Player', message: 'not written either' });
  first.record('console', { time: clock(), type: 'error', message: 'ERROR test' });
  first.configure({ chat: true, console: true });
  first.record('chat', { time: clock(), name: 'Player', message: 'second line\ncontinued' });
  await first.close();
  const second = new SessionLogger(dir, { clock }); second.configure({ chat: true });
  second.record('chat', { time: clock(), name: 'Player', message: 'new process/session' }); await second.close();
  const files = await readdir(dir); assert.equal(files.length, 3);
  const firstChat = await readFile(first.files.get('chat:2026-11-01'), 'utf8');
  assert.ok(firstChat.includes('hello [peidetud]')); assert.ok(firstChat.includes('[11.01-09.14] - Player: second line\r\n[11.01-09.14] - Player: continued\r\n')); assert.ok(!firstChat.includes('not written'));
  assert.notEqual(first.files.get('chat:2026-11-01'), second.files.get('chat:2026-11-01'));
  assert.equal(firstChat.trim().split('\r\n').length, 3);
});
test('chat and console log rows follow the requested bracketed time format with Windows line breaks', () => {
  const time = Date.parse('2026-11-01T12:25:00Z');
  assert.equal(formatLogEntry('chat', { time, name: 'Jannu', message: 'No mis toimub?' }), '[11.01-14.25] - Jannu: No mis toimub?\r\n');
  assert.equal(formatLogEntry('console', { time, type: 'command', message: '> say "tere"' }), '[11.01-14.25] - [COMMAND] > say "tere"\r\n');
  assert.equal(formatLogEntry('console', { time, type: 'generic', message: '[RustNav] Saving navmesh to path: test' }), '[11.01-14.25] - [GENERIC] [RustNav] Saving navmesh to path: test\r\n');
  assert.equal(formatLogEntry('chat', { time, name: 'Jannu', message: 'Esimene\nTeine' }), '[11.01-14.25] - Jannu: Esimene\r\n[11.01-14.25] - Jannu: Teine\r\n');
});
test('logging rotates at Tallinn midnight and history publication does not duplicate entries', async t => {
  const dir = await temp(t); let current = Date.parse('2026-11-01T21:59:59Z');
  const logger = new SessionLogger(dir, { clock: () => current }); logger.configure({ console: true });
  const monitor = new Monitor(); monitor.on('console-entry', e => logger.record('console', e));
  monitor.log('console', 'before midnight'); monitor.publish(); monitor.publish();
  current += 2000; monitor.log('console', 'after midnight'); monitor.publish();
  await logger.close(); monitor.destroy();
  const files = await readdir(dir); assert.equal(files.length, 2);
  assert.ok(files.some(f => f.startsWith('konsool.2026-11-01.'))); assert.ok(files.some(f => f.startsWith('konsool.2026-11-02.')));
  const contents = await Promise.all(files.map(f => readFile(path.join(dir, f), 'utf8')));
  assert.equal(contents.join('').match(/before midnight/g).length, 1);
});
test('legacy encrypted credentials migrate to conf without resurrection after forget', async t => {
  const dir = await temp(t), legacy = path.join(dir, 'data'), conf = path.join(dir, 'conf');
  const old = new CredentialVault(legacy); await old.write({ 'ws://127.0.0.1:28016': { profile, cipher: 'opaque-encrypted-data' } });
  const migrated = new CredentialVault(conf, legacy); assert.equal(await migrated.migrate(), true);
  assert.equal(await readFile(migrated.file, 'utf8'), await readFile(old.file, 'utf8'));
  await migrated.forget(); assert.equal(await migrated.migrate(), false); assert.deepEqual((await migrated.metadata()).profiles, []);
});
test('settings API saves an inactive WebRCON profile, applies logging and protects conf/log files', async t => {
  const dir = await temp(t), config = new ConfigStore(path.join(dir, 'conf')), vault = new CredentialVault(path.join(dir, 'conf'));
  const logger = new SessionLogger(path.join(dir, 'logs'));
  const app = createApp({ config, vault, logger });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const response = await fetch(url + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: { ...profile, rconWeb: false }, logging: { chat: false, console: true } }) });
    assert.equal(response.status, 200); assert.equal(app.monitor.state.status, 'disconnected');
    app.monitor.log('console', 'persist me'); await logger.flush();
    const settings = await (await fetch(url + '/api/settings')).json();
    assert.equal(settings.settings.profile.rconWeb, false); assert.equal(settings.logging.console, true);
    assert.equal((await fetch(url + '/conf/settings.json')).status, 404);
    assert.equal((await fetch(url + '/logs/anything.txt')).status, 404);
    const connect = await fetch(url + '/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profile, password: 'dummy', rconWeb: false }) });
    assert.equal(connect.status, 400);
  } finally { await app.close(); }
});
