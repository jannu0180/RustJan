import test from 'node:test';
import assert from 'node:assert/strict';
import{mkdtemp,rm}from'node:fs/promises';
import os from'node:os';import path from'node:path';
import{acquireRuntimeLock}from'../runtime-lock.mjs';
import{createRuntime}from'../server.mjs';
import{ConfigStore}from'../config.mjs';
async function temp(t){const d=await mkdtemp(path.join(os.tmpdir(),'rustjan-desktop-'));t.after(()=>rm(d,{recursive:true,force:true}));return d;}
test('data directory lock prevents concurrent web/desktop writers and releases cleanly',async t=>{const d=await temp(t),release=await acquireRuntimeLock(d);await assert.rejects(acquireRuntimeLock(d),e=>e.code==='RUSTJAN_ALREADY_RUNNING');const releaseOther=await acquireRuntimeLock(path.join(d,'other'));await releaseOther();await release();const again=await acquireRuntimeLock(d);await again();});
test('desktop runtime uses the supplied data folder and restores state without a fixed port',async t=>{const d=await temp(t),config=new ConfigStore(path.join(d,'conf'));await config.save({profile:{name:'Desktop test',host:'127.0.0.1',port:28016},logging:{chat:true,console:true}});const runtime=await createRuntime({dataDirectory:d});await new Promise(resolve=>runtime.server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+runtime.server.address().port;const settings=await(await fetch(url+'/api/settings')).json();assert.equal(settings.directories.conf,path.join(d,'conf'));assert.equal(settings.directories.logs,path.join(d,'logs'));assert.equal((await(await fetch(url+'/api/state')).json()).profile.name,'Desktop test');await assert.rejects(createRuntime({dataDirectory:d}),e=>e.code==='RUSTJAN_ALREADY_RUNNING');await Promise.all([runtime.close(),runtime.close()]);const release=await acquireRuntimeLock(d);await release();});
