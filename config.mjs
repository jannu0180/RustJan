import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { normalizeProfile } from './monitor.mjs';
export const defaults = () => ({ version: 2, profile: null, servers: [], selectedServerId: 'server-1', language: 'en', rememberPassword: true, logging: { chat: false, console: false } });
function normalize(value) {
  const servers = Array.isArray(value.servers) ? value.servers.slice(0,3).map((s,i) => ({ id: /^server-[123]$/.test(s.id) ? s.id : 'server-'+(i+1), profile: s.profile ? normalizeProfile(s.profile) : null })) : value.profile ? [{ id: 'server-1', profile: normalizeProfile(value.profile) }] : [];
  if (new Set(servers.map(s=>s.id)).size !== servers.length) throw Error('Duplicate server slot');
  const selectedServerId = servers.some(s=>s.id === value.selectedServerId) ? value.selectedServerId : servers[0]?.id || 'server-1';
  return { ...defaults(), servers, selectedServerId, profile: servers.find(s=>s.id===selectedServerId)?.profile || null, language: value.language === 'et' ? 'et' : 'en', rememberPassword: value.rememberPassword !== false, logging: { chat: value.logging?.chat === true, console: value.logging?.console === true } };
}
export class ConfigStore {
  constructor(directory) { this.directory=directory; this.file=path.join(directory,'settings.json'); this.queue=Promise.resolve(); }
  async load() { try { const value=normalize(JSON.parse(await readFile(this.file,'utf8')));this.loadedFromDisk=true;return value; } catch(e) { if(e.code==='ENOENT') {this.loadedFromDisk=false;return defaults();} throw Error('conf/settings.json: invalid configuration. Restore a backup.'); } }
  async save(change) {
    const work=this.queue.then(async()=>{
      const previous=await this.load();
      const nextInput={...previous,...change,logging:{...previous.logging,...change.logging}};
      if(Object.hasOwn(change,'profile') && !Object.hasOwn(change,'servers')) {
        const id=change.selectedServerId || previous.selectedServerId;
        nextInput.servers=previous.servers.filter(s=>s.id!==id).concat({id,profile:change.profile});
      }
      const next=normalize(nextInput);
      await mkdir(this.directory,{recursive:true}); await writeFile(this.file+'.tmp',JSON.stringify(next,null,2),{mode:0o600}); await rename(this.file+'.tmp',this.file); return next;
    }); this.queue=work.catch(()=>{}); return work;
  }
}
