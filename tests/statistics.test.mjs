import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Statistics} from '../statistics.mjs';
import {PlayerHistory} from '../player-history.mjs';
import {ServerFiles} from '../server-files.mjs';
import {Monitor} from '../monitor.mjs';
import {createApp} from '../server.mjs';
const p={name:'Stats',host:'127.0.0.1',port:28016},player={SteamID:'76561198000000001',DisplayName:'Player',ConnectedSeconds:60};
async function temp(t){const d=await mkdtemp(path.join(os.tmpdir(),'rustjan-stats-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('statistics and chart points survive restart, deduplicate a continuing visit and isolate servers',async t=>{
 const d=await temp(t),files=new ServerFiles(d,{getServers:()=>[{id:'server-1',profile:p}]}),s=new Statistics(d,{files});const at=Date.parse('2026-11-01T09:00:00Z');
 await s.recordSample(p,{time:at,players:3,fps:60,memory:4000});await s.recordSample(p,{time:at+3000,players:4,fps:59,memory:4100});assert.equal(s.samples(p).length,1);s.samples(p).push({bad:true});assert.equal(s.samples(p).length,1);
 await s.recordPlayers(p,[player],at);await s.recordPlayers(p,[{...player,ConnectedSeconds:70}],at+10000);await s.close();
 const restarted=new Statistics(d,{files});await restarted.load(p);await restarted.recordPlayers(p,[{...player,ConnectedSeconds:80}],at+20000);assert.equal(restarted.snapshot(p).uniqueVisitors,1);assert.equal(restarted.snapshot(p).visits,1);assert.equal(restarted.snapshot(p).peak,4);assert.equal(restarted.samples(p)[0].fps,59);assert.ok(restarted.file(p).includes(path.join('Stats [server-1]','statistics')));
 await restarted.recordPlayers(p,[],at+30000);await restarted.recordPlayers(p,[{...player,ConnectedSeconds:5}],at+60000);assert.equal(restarted.snapshot(p).visits,2);
 await restarted.load({...p,port:28017});assert.equal(restarted.snapshot({...p,port:28017}).visits,0);await restarted.close();
});
test('saved player visits seed new statistics once; reset preserves player history and backup and stays reset after restart',async t=>{
 const d=await temp(t),h=new PlayerHistory(path.join(d,'players')),at=Date.now();await h.observe(p,[player],at);await h.flush();
 const s=new Statistics(path.join(d,'statistics'),{history:h});await s.load(p);assert.equal(s.snapshot(p).visits,1);await s.recordPlayers(p,[player],at);assert.equal(s.snapshot(p).visits,1);
 await s.recordSample(p,{time:at,players:8,fps:60,memory:5000});await s.reset(p);assert.equal(s.snapshot(p).visits,0);assert.equal(s.samples(p).length,0);assert.equal(h.summary(p)[0].visits,1);await s.close();
 const names=await readdir(path.join(d,'statistics'));const backup=names.find(f=>f.endsWith('.bak'));assert.ok(backup);assert.equal(JSON.parse(await readFile(path.join(d,'statistics',backup),'utf8')).visits,1);
 const again=new Statistics(path.join(d,'statistics'),{history:h});await again.load(p);assert.equal(again.snapshot(p).visits,0);await again.close();await h.close();
});
test('reset API requires explicit confirmation and exact server identity',async t=>{
 const d=await temp(t),statistics=new Statistics(d),monitor=new Monitor();monitor.state.profile=p;await statistics.recordPlayers(p,[player]);monitor.state.statistics=statistics.snapshot(p);const app=createApp({monitor,statistics});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());const base='http://127.0.0.1:'+app.server.address().port;
 const post=body=>fetch(base+'/api/statistics/reset?serverId=server-1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post({})).status,400);assert.equal((await post({confirm:true,expectedServerId:'server-2'})).status,400);assert.equal(statistics.snapshot(p).visits,1);
 assert.equal((await post({confirm:true,expectedServerId:'server-1'})).status,200);assert.equal(statistics.snapshot(p).visits,0);assert.equal((await(await fetch(base+'/api/state')).json()).statistics.visits,0);
});
