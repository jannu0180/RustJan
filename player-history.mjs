import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export const historyKey=p=>createHash('sha256').update(`${p.secure?'wss':'ws'}://${String(p.host).toLowerCase()}:${p.port}`).digest('hex').slice(0,24);
export class PlayerHistory {
 constructor(directory,{files=null}={}){this.files=files;this.profiles=new Map();this.directory=directory;this.cache=new Map();this.loading=new Map();this.flushQueue=Promise.resolve();this.queues=new Map();this.dirty=new Set();this.timer=null;this.error=null;}
 async load(profile){const key=historyKey(profile);this.profiles.set(key,profile);if(this.cache.has(key))return this.cache.get(key);if(this.loading.has(key))return this.loading.get(key);const work=this.read(key);this.loading.set(key,work);try{return await work;}finally{this.loading.delete(key);}}
 async read(key){let data;try{data=JSON.parse(this.files?await this.files.read(this.profiles.get(key),'players'):await readFile(path.join(this.directory,key+'.json'),'utf8'));if(!data || !Array.isArray(data.players))throw Error('Invalid player history');}catch(e){if(e.code!=='ENOENT')throw e;data={version:1,players:[]};}for(const p of data.players)p.online=false;this.cache.set(key,data);return data;}
 summary(profile,online=[]){const data=this.cache.get(historyKey(profile));const ids=new Set(online.map(p=>p.SteamID));return(data?.players||[]).map(p=>({SteamID:p.SteamID,DisplayName:p.DisplayName,Country:p.Country,Address:p.Address,firstSeen:p.firstSeen,lastSeen:p.lastSeen,totalSeconds:p.sessions.reduce((sum,s)=>sum+s.durationSeconds,0),visits:p.sessions.length,online:ids.has(p.SteamID)}));}
 async observe(profile,players,at=Date.now()){
  const key=historyKey(profile),work=(this.queues.get(key)||Promise.resolve()).then(async()=>{
   const data=await this.load(profile),seen=new Set();
   for(const player of players){const id=String(player.SteamID);if(!/^\d{17}$/.test(id))continue;seen.add(id);let row=data.players.find(p=>p.SteamID===id);if(!row){row={SteamID:id,firstSeen:at,sessions:[]};data.players.push(row);}
    row.names ||= row.DisplayName?[{name:row.DisplayName,firstSeen:row.firstSeen,lastSeen:row.lastSeen}]:[];
    if(player.DisplayName){let alias=row.names.find(n=>n.name===player.DisplayName);if(!alias){alias={name:player.DisplayName,firstSeen:at,lastSeen:at};row.names.push(alias);}alias.lastSeen=at;}
    row.DisplayName=player.DisplayName;row.Country=player.Country||row.Country||null;row.Address=player.Address||row.Address||null;
    const seconds=player.ConnectedSeconds==null?null:Math.max(0,Number(player.ConnectedSeconds));const joined=seconds==null?at:at-seconds*1000;
    let session=row.sessions.at(-1);
    if(!session || session.leftAt!=null || (seconds!=null && Math.abs(session.joinedAt-joined)>10000)){
     if(session && session.leftAt==null){session.leftAt=session.lastSeen;session.uncertainEnd=true;}
     session={joinedAt:joined,lastSeen:at,leftAt:null,durationSeconds:seconds??0,uncertainEnd:false};row.sessions.push(session);
    }
    session.durationSeconds=seconds??Math.max(0,(at-session.joinedAt)/1000);session.lastSeen=at;row.lastSeen=at;row.online=true;
   }
   for(const row of data.players)if(!seen.has(row.SteamID)){const s=row.sessions.at(-1);if(s&&s.leftAt==null){s.leftAt=row.online?at:s.lastSeen;s.uncertainEnd=true;}row.online=false;}
   this.dirty.add(key);if(!this.timer&&!this.closed)this.timer=setTimeout(()=>{this.timer=null;this.flush().catch(e=>{this.error=e.message;});},30000);
   return this.summary(profile,players);
  });this.queues.set(key,work.catch(()=>{}));return work;
 }
 async visits(profile,id){await this.queues.get(historyKey(profile));const data=await this.load(profile);return data.players.find(p=>p.SteamID===id)||null;}
 flush(){const work=this.flushQueue.then(()=>this.writeDirty());this.flushQueue=work.catch(()=>{});return work;}
 async writeDirty(){await Promise.all(this.queues.values());await mkdir(this.directory,{recursive:true});for(const key of [...this.dirty]){this.dirty.delete(key);const file=this.files?this.files.file(this.profiles.get(key),'players'):path.join(this.directory,key+'.json');await mkdir(path.dirname(file),{recursive:true});try{await writeFile(file+'.tmp',JSON.stringify(this.cache.get(key)),{mode:0o600});await rename(file+'.tmp',file);}catch(e){this.dirty.add(key);throw e;}}}
 async close(){this.closed=true;clearTimeout(this.timer);this.timer=null;await this.flush();}
}
