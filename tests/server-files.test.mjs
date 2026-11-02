import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PlayerHistory} from '../player-history.mjs';
import {MapCache} from '../map-cache.mjs';
import {ServerFiles} from '../server-files.mjs';
test('server logs folders hold history/maps; legacy import preserves originals and never replaces newer records',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'rustjan-server-files-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const profile={name:'Alpha',host:'127.0.0.1',port:28016},legacy=path.join(root,'data'),logs=path.join(root,'logs');let slots=[{id:'server-1',profile}];
 const old=new PlayerHistory(path.join(legacy,'player-history'));await old.observe(profile,[{SteamID:'76561198000000001',DisplayName:'Player',Country:'EE',ConnectedSeconds:60}],100000);await old.close();
 const oldMaps=new MapCache(path.join(legacy,'maps'));await oldMaps.save(profile,'world',{mime:'image/png',bytes:Buffer.from('map')},{width:1000,height:1000,scale:1});
 const files=new ServerFiles(logs,{legacyRoot:legacy,getServers:()=>slots}),history=new PlayerHistory(logs,{files}),maps=new MapCache(logs,{files});
 await history.load(profile);assert.equal(history.summary(profile)[0].totalSeconds,60);assert.equal((await maps.load(profile,'world')).image.bytes.toString(),'map');
 assert.ok(files.file(profile,'players').includes(path.join('Alpha [server-1]','players')));assert.ok(files.file(profile,'maps').includes(path.join('Alpha [server-1]','maps')));
 await history.observe(profile,[{SteamID:'76561198000000001',DisplayName:'Player',Country:'EE',ConnectedSeconds:90}],130000);await history.close();
 const restored=new PlayerHistory(logs,{files});await restored.load(profile);assert.equal(restored.summary(profile)[0].totalSeconds,90);await restored.close();
 // Original legacy data remains an untouched backup.
 const oldAgain=new PlayerHistory(path.join(legacy,'player-history'));await oldAgain.load(profile);assert.equal(oldAgain.summary(profile)[0].totalSeconds,60);await oldAgain.close();
 const renamed={...profile,name:'Renamed'};slots=[{id:'server-1',profile:renamed}];const renamedHistory=new PlayerHistory(logs,{files});await renamedHistory.load(renamed);assert.equal(renamedHistory.summary(renamed)[0].totalSeconds,90);await renamedHistory.close();
 assert.ok((await readFile(files.file(renamed,'players'),'utf8')).includes('Player'));
 assert.notEqual(files.file({...profile,port:28017},'players'),files.file(profile,'players'));
});
