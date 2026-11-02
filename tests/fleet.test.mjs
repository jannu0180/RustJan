import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Monitor} from '../monitor.mjs';
import {ConfigStore} from '../config.mjs';
import {SessionLogger,serverFolder} from '../file-logger.mjs';
import {createApp} from '../server.mjs';
const profile=n=>({name:'Server '+n,host:'127.0.0.1',port:28015+n,interval:3});
async function temp(t){const dir=await mkdtemp(path.join(os.tmpdir(),'rustjan-fleet-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
class StubMonitor extends Monitor {
 connect(p){this.password=p.password;const {password,...safe}=p;this.state.profile=safe;this.state.status='connected';this.state.connectedAt=Date.now();this.state.lastUpdate=Date.now();this.publish();}
 command(c){this.log('command',c);}
}
test('legacy profile migrates to slot one; three profiles and language survive restart without plaintext secrets',async t=>{
 const dir=await temp(t);await writeFile(path.join(dir,'settings.json'),JSON.stringify({profile:profile(1),logging:{chat:true}}));
 const config=new ConfigStore(dir),old=await config.load();assert.equal(old.servers[0].id,'server-1');assert.equal(old.language,'en');
 await config.save({servers:[1,2,3].map(n=>({id:'server-'+n,profile:{...profile(n),password:'secret'}})),selectedServerId:'server-2',language:'et'});
 const next=await new ConfigStore(dir).load();assert.equal(next.profile.name,'Server 2');assert.equal(next.servers.length,3);assert.equal(next.language,'et');assert.ok(!(await readFile(config.file,'utf8')).includes('secret'));
});
test('three simultaneous monitors isolate views, commands, maps, persistence and background logging',async t=>{
 const dir=await temp(t),config=new ConfigStore(path.join(dir,'conf')),logger=new SessionLogger(path.join(dir,'logs'));
 const app=createApp({monitor:new StubMonitor(),monitorFactory:()=>new StubMonitor(),config,logger});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base='http://127.0.0.1:'+app.server.address().port;
 const post=async(route,body={},id)=>{const r=await fetch(base+route+(id?'?serverId='+id:''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()};};
 await post('/api/settings',{logging:{chat:true,console:true}});
 for(let n=1;n<=3;n++){
  if(n>1)assert.equal((await post('/api/servers/add')).status,200);
  assert.equal((await post('/api/connect',{...profile(n),password:'private-'+n})).status,200);
  const m=app.fleet.get('server-'+n);m.state.players=[{SteamID:String(n),DisplayName:'Player '+n}];m.mapImage={mime:'image/png',bytes:Buffer.from('map '+n)};
 }
 assert.equal((await post('/api/servers/add')).status,400);
 await post('/api/servers/select',{id:'server-1'});
 assert.equal(app.fleet.get('server-1').foreground,true);assert.equal(app.fleet.get('server-2').foreground,false);
 app.fleet.get('server-2').log('generic','background event');
 await post('/api/command',{command:'only second'},'server-2');
 assert.equal(app.fleet.get('server-1').state.logs.length,0);
 let state=await(await fetch(base+'/api/state')).json();assert.equal(state.players[0].DisplayName,'Player 1');assert.equal(state.servers.length,3);assert.ok(!JSON.stringify(state).includes('private-'));
 await post('/api/servers/select',{id:'server-2'});state=await(await fetch(base+'/api/state')).json();assert.equal(state.players[0].DisplayName,'Player 2');assert.ok(state.logs.some(l=>l.message==='background event'));
 assert.equal(await(await fetch(base+'/api/map/image?serverId=server-3')).text(),'map 3');
 await logger.flush();assert.ok((await readdir(logger.directory)).some(s=>s.startsWith('Server 2')));
 assert.equal((await config.load()).servers.length,3);
 await post('/api/servers/delete',{id:'server-2'});assert.equal(app.fleet.monitors.size,2);assert.equal((await config.load()).servers.length,2);assert.equal(app.fleet.get('server-3').state.status,'connected');
 assert.equal((await post('/api/command',{command:'stale'},'server-2')).status,404);
});
test('log directories sanitize traversal and Windows device names and separate equal-day server entries',async t=>{
 const dir=await temp(t),logger=new SessionLogger(dir);logger.configure({console:true});
 logger.record('console',{type:'generic',message:'one'},{server:'Server A'});logger.record('console',{type:'generic',message:'two'},{server:'Server B'});await logger.close();
 assert.deepEqual((await readdir(dir)).sort(),['Server A','Server B']);assert.equal(serverFolder('CON'),'_CON');assert.ok(!serverFolder('../../evil').includes('/'));assert.ok(!serverFolder('x\\y').includes('\\'));
 for(const folder of ['Server A','Server B']){const files=await readdir(path.join(dir,folder));assert.equal(files.length,1);const text=await readFile(path.join(dir,folder,files[0]),'utf8');assert.ok(text.includes(folder==='Server A'?'one':'two'));}
});

test('editing an endpoint clears stale views and demo never replaces a saved profile',async t=>{
 const dir=await temp(t),config=new ConfigStore(dir),monitor=new StubMonitor(),app=createApp({monitor,config});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const url='http://127.0.0.1:'+app.server.address().port;
 const post=async(route,body)=>{const response=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200);};
 await post('/api/connect',{...profile(1),password:'private'});monitor.state.players=[{DisplayName:'Old'}];
 await post('/api/settings',{profile:{...profile(1),host:'localhost'}});
 assert.equal(monitor.state.status,'disconnected');assert.equal(monitor.state.players.length,0);
 await post('/api/demo',{});await post('/api/settings',{language:'et'});
 assert.equal((await config.load()).profile.host,'localhost');
 await post('/api/servers/delete',{id:'server-1'});assert.equal((await config.load()).servers.length,0);assert.equal(config.loadedFromDisk,true);
});
