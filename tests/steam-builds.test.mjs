import test from 'node:test';
import assert from 'node:assert/strict';
import {createSteamBuildLookup, updateInterval} from '../steam-builds.mjs';
import {Monitor} from '../monitor.mjs';

test('all servers share the public metadata request, compare the correct branch and keep the last successful time on failure', async () => {
  let now = 1000, count = 0, fail = false;
  const lookup = createSteamBuildLookup({clock: () => now, fetcher: async url => {
    count++;
    assert.equal(url, 'https://api.steamcmd.net/v1/info/258550');
    if (fail) throw Error('offline');
    return {ok:true,json:async () => ({data:{258550:{depots:{branches:{
      public:{buildid:'12345'}, staging:{buildid:'23456'}
    }}}}})};
  }});
  const [stable, staging] = await Promise.all([lookup('public'),lookup('staging')]);
  assert.equal(stable.latest,'12345');
  assert.equal(staging.latest,'23456');
  assert.equal(count,1);
  assert.equal((await lookup('unknown')).status,'branch-unavailable');
  assert.equal(count,1);
  fail = true;
  now += updateInterval;
  assert.deepEqual(await lookup('public'),{latest:'12345',checkedAt:1000,status:'steam-error'});
});

test('monitor warns once per newer build and never compares a server with a missing manifest', async () => {
  let sent, alerts = 0;
  const monitor = new Monitor({steamLookup:async () => ({latest:'200',checkedAt:100,status:'ok'}),
    onUpdateNeeded:() => { alerts++; }});
  monitor.state.status = 'connected';
  monitor.socket = {readyState:1,send: value => { sent = JSON.parse(value); },close(){}};
  const reply = async value => {
    monitor.checkServerUpdate(true);
    assert.equal(sent.Message,'rustjan.build');
    monitor.receive(JSON.stringify({Identifier:sent.Identifier,Message:JSON.stringify(value)}));
    await new Promise(resolve => setImmediate(resolve));
  };
  try {
    await reply({Schema:1,BuildId:'199',Branch:'public'});
    assert.equal(monitor.state.serverUpdate.status,'needed');
    assert.equal(monitor.state.serverUpdate.installed,'199');
    await reply({Schema:1,BuildId:'199',Branch:'public'});
    assert.equal(alerts,1);
    await reply({Schema:1,BuildId:'200',Branch:'public'});
    assert.equal(monitor.state.serverUpdate.status,'current');
    await reply({Schema:1,Error:'manifest-unavailable'});
    assert.equal(monitor.state.serverUpdate.status,'manifest-unavailable');
    assert.equal(alerts,1);
  } finally { monitor.destroy(); }
});
