import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePlugins, parseBans, playerCommand } from '../admin.mjs';
import { loadCountries, addressOnly } from '../geo.mjs';
import { CredentialVault } from '../vault.mjs';
import { Monitor } from '../monitor.mjs';
import { createApp } from '../server.mjs';

test('Oxide native output distinguishes loaded and unloaded/compile-error rows', () => {
  const result = parsePlugins('Listing 3 plugins:\n  01 "My awesome plugin" (1.0.0) by Oxide (0.04s / 1 MB) - MyAwesomePlugin.cs\n  02 SecondPlugin - Unloaded\n  03 ThirdPlugin - Failed to compile: missing reference');
  assert.equal(result.complete, true);
  assert.equal(result.plugins[0].file, 'MyAwesomePlugin');
  assert.equal(result.plugins[1].status, 'disabled');
  assert.equal(result.plugins[2].status, 'disabled');
  assert.deepEqual(parsePlugins('No plugins are currently loaded.'), { plugins: [], complete: true });
  assert.equal(parsePlugins('Unknown command: oxide.plugins'), null);
});
test('ban parsing preserves quotes, reasons and marks unavailable versus last-seen IP', () => {
  const known = new Map([['76561198000000001', { Address: '1.2.3.4' }]]);
  const bans = parseBans('0 76561198000000001 "Test player" "Bad \\"language\\""\n1 76561198000000002 "Unknown player" "Cheating"', known);
  assert.equal(bans[0].ip, '1.2.3.4'); assert.equal(bans[0].ipSource, 'last-seen');
  assert.equal(bans[1].ip, ''); assert.equal(bans[1].ipSource, 'unknown');
  assert.deepEqual(parseBans('0 bans'), []);
  assert.equal(parseBans('Unknown command: banlistex'), null);
});
test('player actions target SteamID, quote reasons and reject command injection', () => {
  const p = { DisplayName: 'Player', SteamID: '76561198000000001' };
  assert.equal(playerCommand({ steamId: p.SteamID, action: 'kick', reason: 'Test' }, p), 'kick 76561198000000001 "Test"');
  assert.equal(playerCommand({ steamId: p.SteamID, action: 'give', item: 'rifle.ak', amount: 1 }, p), 'inventory.giveto 76561198000000001 rifle.ak 1');
  assert.equal(playerCommand({ steamId: p.SteamID, action: 'mute' }, p), 'mute 76561198000000001');
  assert.throws(() => playerCommand({ steamId: p.SteamID, action: 'give', item: 'wood;quit', amount: 1 }, p));
  assert.throws(() => playerCommand({ steamId: p.SteamID, action: 'ban', reason: 'bad\nquit' }, p));
  assert.throws(() => playerCommand({ steamId: '123', action: 'kick' }, p));
});
test('offline country lookup supports IPv4, IPv6, ports and private/unknown IPs', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rustjan-geo-')); t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(path.join(dir, 'country-ipv4.csv'), '16777216,16777471,EE\n');
  await writeFile(path.join(dir, 'country-ipv6.csv'), `${BigInt('0x20010db8000000000000000000000000')},${BigInt('0x20010db8ffffffffffffffffffffffff')},FI\n`);
  const country = await loadCountries(pathToFileURL(dir + path.sep));
  assert.equal(country('1.0.0.10:28015'), 'EE');
  assert.equal(country('[2001:db8::1]:28015'), 'FI');
  assert.equal(country('127.0.0.1'), null); assert.equal(country('10.0.0.1'), null);
  assert.equal(country('8.8.8.8'), null); assert.equal(addressOnly('1.2.3.4:28015'), '1.2.3.4');
});
test('Windows vault encrypts the password on disk, isolates server identity and forgets it', { skip: process.platform !== 'win32' }, async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rustjan-vault-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const vault = new CredentialVault(dir), profile = { host: '127.0.0.1', port: 28016, secure: false, name: 'Test', interval: 5 };
  await vault.save(profile, 'test-secret-õä-!');
  assert.ok(!(await readFile(vault.file, 'utf8')).includes('test-secret'));
  assert.equal(await vault.read(profile), 'test-secret-õä-!');
  assert.ok(!JSON.stringify(await vault.metadata()).includes('test-secret'));
  await assert.rejects(vault.read({ ...profile, port: 28017 }));
  await vault.forget(); assert.deepEqual((await vault.metadata()).profiles, []);
});
test('map messages keep image bytes outside SSE state and retain exact projection metadata', () => {
  const monitor = new Monitor();
  monitor.pending.set(7, { kind: 'map', mapScale: 0.3, timer: setTimeout(() => {}, 1000) });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbykAAAAASUVORK5CYII=', 'base64');
  monitor.receive(JSON.stringify({ Identifier: 7, Message: JSON.stringify({ Base64: png.toString('base64'), Width: 1600, Height: 1600, WorldSize: 3500, Scale: 0.3 }) }));
  assert.equal(monitor.state.map.status, 'ready'); assert.equal(monitor.state.map.scale, 0.3);
  assert.deepEqual(monitor.mapImage.bytes, png); assert.ok(!JSON.stringify(monitor.state).includes('Base64'));
  monitor.destroy();
});
test('saved-credential API reuses a password without sending it back to the browser', async t => {
  const profile = { name: 'Test', host: '127.0.0.1', port: 28016, secure: false, interval: 5 };
  let saved;
  const vault = { metadata: async () => ({ supported: true, profiles: saved ? [saved.profile] : [] }), save: async (p, password) => saved = { profile: p, password }, read: async p => { if (p.port !== saved?.profile.port) throw new Error('No saved password'); return saved.password; }, forget: async () => saved = null };
  class InertSocket extends EventTarget { close() {} }
  const monitor = new Monitor({ WebSocketClass: InertSocket });
  const app = createApp({ monitor, vault });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const post = (route, value) => fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  assert.equal((await post('/api/connect', { ...profile, password: 'private-api-test', savePassword: true })).status, 200);
  monitor.disconnect();
  assert.equal((await post('/api/connect', { ...profile, password: '', useSaved: true })).status, 200);
  assert.equal(monitor.password, 'private-api-test');
  assert.ok(!(await (await fetch(url + '/api/credentials')).text()).includes('private-api-test'));
  assert.ok(!(await (await fetch(url + '/api/state')).text()).includes('private-api-test'));
  assert.equal((await post('/api/connect', { ...profile, port: 28017, useSaved: true })).status, 400);
  await post('/api/credentials/forget', {});
  assert.equal(saved, null);
});
