import { EventEmitter } from 'node:events';
import { Monitor } from './monitor.mjs';
import { mapIdentity } from './map-cache.mjs';
export class Fleet extends EventEmitter {
  constructor({ monitor=new Monitor(), settings={}, factory=()=>new Monitor(), logger=null, history=null, maps=null, statistics=null, rules=null }={}) {
    super();this.rules=rules;this.statistics=statistics;this.history=history;this.maps=maps;this.viewers=new Map();this.viewerTimer=setInterval(()=>this.applyViews(),15000);this.viewerTimer.unref(); this.factory=factory; this.logger=logger; this.monitors=new Map(); this.selectedId=settings.selectedServerId || 'server-1';
    const slots=settings.servers?.length ? settings.servers : [{id:this.selectedId,profile:settings.profile || null}];
    slots.forEach((slot,i)=>this.attach(slot.id,i===0?monitor:factory(),slot.profile));
    if(!this.monitors.has(this.selectedId)) this.selectedId=this.monitors.keys().next().value;
    this.applyForeground();
    if(logger){const redact=logger.redact;logger.redact=value=>redact(this.redact(value));}
    logger?.on('status',()=>this.publish());
  }
  attach(id,monitor,profile) {
    monitor.savedProfile=profile; if(profile) monitor.state.profile=profile; else if(!monitor.state.profile.host) monitor.state.profile.name='Server '+id.slice(-1);
    this.monitors.set(id,monitor);
    monitor.on('state',()=>this.publish());
    const restoreStats=async p=>{if(!this.statistics)return;await this.statistics.load(p);if(monitor.state.profile.host!==p.host||monitor.state.profile.port!==p.port)return;monitor.state.statistics=this.statistics.snapshot(p);monitor.state.history=this.statistics.samples(p);monitor.publish();};
    if(profile)restoreStats(profile).catch(e=>{monitor.state.statisticsError=e.message;monitor.publish();});
    monitor.on('telemetry-sample',sample=>{if(!this.statistics||monitor.state.status==='demo')return;const p=monitor.state.profile,generation=monitor.generation;this.statistics.recordSample(p,sample).then(stats=>{if(generation!==monitor.generation)return;monitor.state.statistics=stats;monitor.state.history=this.statistics.samples(p);monitor.state.statisticsError=null;monitor.publish();}).catch(e=>{monitor.state.statisticsError=e.message;monitor.publish();});});
    monitor.on('players-snapshot',players=>{if(!this.statistics||monitor.state.status==='demo')return;const p=monitor.state.profile,generation=monitor.generation;this.statistics.recordPlayers(p,players).then(stats=>{if(generation!==monitor.generation)return;monitor.state.statistics=stats;monitor.publish();}).catch(e=>{monitor.state.statisticsError=e.message;monitor.publish();});});
    monitor.on('world-metadata',()=>{
      if(!this.maps||monitor.state.info.WorldSize==null||monitor.state.info.Seed==null)return;
      const identity=mapIdentity(monitor.state),generation=monitor.generation;if(monitor.mapCheckKey===identity)return;monitor.mapCheckKey=identity;
      monitor.mapImage=null;monitor.state.map={status:'empty',error:null};
      this.maps.load(monitor.state.profile,identity).then(cached=>{if(generation!==monitor.generation||identity!==mapIdentity(monitor.state)||!cached)return;monitor.mapImage=cached.image;monitor.state.map={...cached.map,imageId:Date.now(),status:'ready'};monitor.publish();}).catch(()=>{});
    });
    monitor.on('map-image',()=>{if(this.maps)this.maps.save(monitor.state.profile,mapIdentity(monitor.state),monitor.mapImage,monitor.state.map).catch(e=>{monitor.state.map.error=e.message;monitor.publish();});});
    if(profile && this.history)this.history.load(profile).then(()=>{monitor.state.playerHistory=this.history.summary(profile);monitor.publish();}).catch(e=>{monitor.state.historyError=e.message;monitor.publish();});
    monitor.on('players-snapshot',players=>{
      if(!this.history||monitor.state.status==='demo')return;
      const profile=monitor.state.profile,generation=monitor.generation;
      this.history.observe(profile,players).then(rows=>{if(generation!==monitor.generation)return;monitor.state.playerHistory=rows;monitor.state.historyError=this.history.error;monitor.publish();}).catch(e=>{monitor.state.historyError=e.message;monitor.publish();});
    });
    const context=()=>({server:monitor.state.profile.name+' ['+id+']', demo:monitor.state.status==='demo'});
    monitor.on('console-entry',e=>{this.logger?.record('console',e,context());void this.rules?.process(monitor.state.profile,'console',e,id,monitor.generation);});
    monitor.on('chat-entry',e=>{this.logger?.record('chat',e,context());void this.rules?.process(monitor.state.profile,'chat',e,id,monitor.generation);});
    return monitor;
  }
  get(id=this.selectedId) { const m=this.monitors.get(id); if(!m) throw Error('Tundmatu serveriprofiil.'); return m; }
  snapshot() { return {...this.get().state,playerHistory:this.get().views.has('players')?this.get().state.playerHistory||[]:[], serverId:this.selectedId, servers:[...this.monitors].map(([id,m])=>({id,profile:m.state.profile,status:m.state.status,lastUpdate:m.state.lastUpdate,connectedAt:m.state.connectedAt,name:m.state.info.Hostname || m.state.profile.name})), logging:this.logger?.status()}; }
  profiles() { return [...this.monitors].filter(([,m])=>m.savedProfile).map(([id,m])=>({id,profile:m.savedProfile})); }
  select(id) { this.get(id); this.selectedId=id; this.applyForeground(); this.publish(); }
  add() { const id=['server-1','server-2','server-3'].find(id=>!this.monitors.has(id)); if(!id) throw Error('Korraga saab jälgida kuni kolme serverit.'); this.attach(id,this.factory()); this.select(id); return id; }
  remove(id) { const m=this.get(id); m.destroy(); this.monitors.delete(id); if(!this.monitors.size) this.attach('server-1',this.factory()); if(!this.monitors.has(this.selectedId)) this.selectedId=this.monitors.keys().next().value; this.applyForeground(); this.publish(); }
  view(clientId,id,view,visible){if(visible)this.viewers.set(clientId,{id,view,at:Date.now()});else this.viewers.delete(clientId);this.applyViews();this.publish();}
  applyViews(){const now=Date.now();for(const [key,v]of this.viewers)if(now-v.at>45000)this.viewers.delete(key);for(const [id,m]of this.monitors){const views=[...this.viewers.values()].filter(v=>v.id===id).map(v=>v.view);if(JSON.stringify([...m.views].sort())!==JSON.stringify([...new Set(views)].sort()))m.setViews(views);}}
  applyForeground() { for(const [id,m] of this.monitors) m.setForeground(id===this.selectedId); }
  publish() { this.emit('state',this.snapshot()); }
  redact(value) { for(const m of this.monitors.values()) value=m.redact(value); return value; }
  destroy() {clearInterval(this.viewerTimer); for(const m of this.monitors.values()) m.destroy(); this.removeAllListeners(); }
}
