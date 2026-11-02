import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {serverFields,parseServerField} from '../server-info.mjs';
import {Monitor} from '../monitor.mjs';
test('server fields require exact correlated convar replies; missing, defaults/help and unrelated numbers are not invented',()=>{
 assert.equal(parseServerField('server.worldsize','server.worldsize: "5000"'),5000);
 assert.equal(parseServerField('server.seed','server.seed: "23456789"'),23456789);
 assert.equal(parseServerField('server.seed','server.seed: "0"'),0);
 assert.equal(parseServerField('server.tags','server.tags: "monthly,vanilla,EU"'),'monthly,vanilla,EU');
 assert.equal(parseServerField('server.gamemode','server.gamemode: ""'),null);
 for(const reply of ['Unknown command: server.worldsize','Help: server.worldsize default 4500','serverXworldsize: "5000"','server.worldsize: "5000"\nDefault: 4500','server.worldsize: "5000oops"','server.worldsize: "-1"','server.worldsize: "150000"'])assert.equal(parseServerField('server.worldsize',reply),null,reply);
 assert.equal(parseServerField('server.tags','server.tags: ""'),null);
});
test('server metadata refresh clears unsupported values and serverinfo/map cannot overwrite authoritative convar fields',()=>{
 const m=new Monitor();let id=1;
 for(const [command,field]of Object.entries(serverFields)){
  m.state.info[field]='stale';m.pending.set(id,{kind:'serverField',command,field,timer:setTimeout(()=>{},1000)});m.receive(JSON.stringify({Identifier:id++,Message:'Unknown command'}));assert.equal(m.state.info[field],null);
 }
 m.state.info.Seed=123;m.state.info.WorldSize=5000;
 m.pending.set(id,{kind:'info',sent:Date.now(),timer:setTimeout(()=>{},1000)});m.receive(JSON.stringify({Identifier:id,Message:JSON.stringify({Hostname:'Actual server',Seed:999,WorldSize:4500})}));
 assert.equal(m.state.info.Seed,123);assert.equal(m.state.info.WorldSize,5000);m.destroy();
});
test('save interval displays minutes and remaining seconds, including none and zero',async()=>{
 const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const formatter=vm.runInNewContext(source.slice(source.indexOf('const saveInterval ='),source.indexOf('const duration ='))+'saveInterval;');
 assert.equal(formatter(300),'5min');assert.equal(formatter(200),'3min20sec');assert.equal(formatter(20),'0min20sec');assert.equal(formatter(0),'0min');assert.equal(formatter(null),'none');assert.equal(formatter('bad'),'none');
});

test('timed-out metadata becomes none without disconnecting a healthy RCON session',async()=>{
 const m=new Monitor({timeout:20});m.state.status='connected';m.socket={readyState:1,send(){},close(){}};m.state.info.Tags='old';m.request('server.tags','serverField',{command:'server.tags',field:'Tags'});
 await new Promise(r=>setTimeout(r,50));assert.equal(m.state.info.Tags,null);assert.equal(m.state.status,'connected');assert.equal(m.pending.size,0);m.destroy();
});
