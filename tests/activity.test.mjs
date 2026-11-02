import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Monitor} from '../monitor.mjs';
import {PlayerHistory} from '../player-history.mjs';
import {MapCache} from '../map-cache.mjs';
import {parseMapEvents} from '../map-events.mjs';
import {parseGameTime} from '../server-info.mjs';
const profile={host:'127.0.0.1',port:28016,name:'A'};
async function temp(t){const d=await mkdtemp(path.join(os.tmpdir(),'rustjan-activity-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('view-based polling separates overview, map movement, background heartbeat and static settings',()=>{
 const m=new Monitor();m.state.status='connected';m.state.profile.interval=3;m.state.bridge='rustjan';m.clockUnsupported=true;
 const calls=[];m.request=(command)=>calls.push(command);const reset=()=>{calls.length=0;m.pollTimes={info:Date.now(),players:Date.now(),metadata:Date.now(),clock:Date.now(),events:Date.now(),plugins:Date.now()};};
 reset();m.pollTimes.info-=4000;m.pollTimes.players-=4000;m.setViews(['overview']);assert.deepEqual(calls,['serverinfo','playerlist']);
 reset();m.pollTimes.players-=4000;m.pollTimes.events-=4000;m.setViews(['map']);assert.deepEqual(calls,['rustjan.players','rustjan.events']);
 reset();m.setViews(['chat']);assert.equal(calls.length,0);
 reset();m.pollTimes.info-=31000;m.pollTimes.players-=31000;m.setViews([]);assert.deepEqual(calls,['serverinfo','playerlist']);
 assert.ok(!calls.includes('rustjan.rendermap'));m.destroy();
});
test('clock uses server game time and bridge night state; old bridges fall back without failing RCON',()=>{
 const m=new Monitor();m.state.status='connected';m.state.bridge='rustjan';let fallback=false;m.refreshClock=()=>fallback=true;
 m.pending.set(1,{kind:'clock',clockMode:'bridge',timer:setTimeout(()=>{},1000)});m.receive(JSON.stringify({Identifier:1,Message:'Unknown command'}));assert.equal(fallback,true);assert.equal(m.clockUnsupported,true);
 m.pending.set(2,{kind:'clock',clockMode:'bridge',timer:setTimeout(()=>{},1000)});m.receive(JSON.stringify({Identifier:2,Message:JSON.stringify({Hour:17.5,IsNight:true})}));assert.equal(m.state.gameClock.display,'17:30');assert.equal(m.state.gameClock.isNight,true);assert.equal(m.state.gameClock.approximate,false);
 assert.equal(parseGameTime('09/29/1983 18:01:57').display,'18:01');assert.equal(parseGameTime('invalid'),null);m.destroy();
});
test('history persists countries, separate visits and last observed durations; restart does not duplicate a continuing visit',async t=>{
 const d=await temp(t),h=new PlayerHistory(d),id='76561198000000001',start=Date.parse('2026-11-01T08:00:00Z');
 const p={SteamID:id,DisplayName:'Jannu',Country:'EE',Address:'1.2.3.4',ConnectedSeconds:60};
 await h.observe(profile,[p],start);await h.observe(profile,[{...p,ConnectedSeconds:70}],start+10000);await h.close();
 const next=new PlayerHistory(d);await next.observe(profile,[{...p,ConnectedSeconds:80}],start+20000);let row=await next.visits(profile,id);assert.equal(row.sessions.length,1);assert.equal(row.sessions[0].durationSeconds,80);
 await next.observe(profile,[],start+30000);await next.observe(profile,[{...p,ConnectedSeconds:5}],start+60000);await next.observe(profile,[],start+70000);row=await next.visits(profile,id);assert.equal(row.sessions.length,2);assert.equal(next.summary(profile)[0].totalSeconds,85);assert.equal(row.Country,'EE');await next.close();
 const restarted=new PlayerHistory(d);await restarted.load(profile);assert.equal(restarted.summary(profile)[0].visits,2);assert.equal(restarted.summary({...profile,port:28017}).length,0);await restarted.close();
});
test('map cache survives restarts but does not reuse an image from another server or wipe',async t=>{
 const d=await temp(t),cache=new MapCache(d),image={mime:'image/png',bytes:Buffer.from('image')},map={width:1000,height:1000,scale:.2};
 await cache.save(profile,'wipe-a',image,map);const stored=await new MapCache(d).load(profile,'wipe-a');assert.equal(stored.image.bytes.toString(),'image');assert.equal(await cache.load(profile,'wipe-b'),null);assert.equal(await cache.load({...profile,port:28017},'wipe-a'),null);await cache.close();
});
test('event schema validates inputs, bounds flight trails and expires crash markers',()=>{
 const event={Id:'1',Kind:'plane',Position:{x:10,z:20},Direction:{x:1,z:0},CreatedAt:1,ExpiresAt:0};let previous=[];
 for(let i=0;i<100;i++)previous=parseMapEvents(JSON.stringify({Schema:1,Events:[event]}),previous,1000+i*3000);assert.ok(previous[0].trail.length<=40);assert.ok(previous[0].trail.every(p=>298000-p.at<=120000));
 assert.equal(parseMapEvents(JSON.stringify({Schema:1,Events:[{...event,Kind:'crash',ExpiresAt:1}]}),[],100).length,0);
 assert.equal(parseMapEvents(JSON.stringify({Schema:1,Events:[{...event,Position:{x:'bad',z:0}}]})).length,0);
 assert.throws(()=>parseMapEvents('{"Schema":2,"Events":[]}'),/schema/);
});

test('polling pressure cannot crash the local application',()=>{const m=new Monitor();m.state.status='connected';m.request=()=>{throw Error('busy');};assert.doesNotThrow(()=>m.pollTick());assert.ok(m.state.logs.some(l=>l.message==='busy'));m.destroy();});
