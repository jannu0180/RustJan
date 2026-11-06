import { EventEmitter } from 'node:events';
import { parsePlugins, parseBans, unknownCommand, playerCommand } from './admin.mjs';
import { addressOnly } from './geo.mjs';
import { parseMapEvents } from './map-events.mjs';
import { serverFields, parseServerField, parseGameTime } from './server-info.mjs';
import { buildId, steamBranch, compareBuilds, updateInterval } from './steam-builds.mjs';

const now = () => Date.now();
const bounded = (list, item, max) => { list.push(item); if (list.length > max) list.splice(0, list.length - max); };
const text = (value, max = 12000) => String(value ?? '').slice(0, max);
const number = (value) => value == null || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
export function normalizeProfile(input) {
  const host = text(input.host, 253).trim().replace(/^\[|\]$/g, '');
  if (!host || !/^[a-zA-Z0-9.:-]+$/.test(host) || host.includes('..')) throw new Error('Sisesta serveri IP või hostinimi, ilma http:// ja pordita.');
  if (host === '0.0.0.0' || host === '::') throw new Error('0.0.0.0 / :: on serveri kuulamisaadress. Ühenduseks kasuta serveri päris IP-d või kohalikus arvutis 127.0.0.1.');
  const port = Number(input.rconPort ?? input.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('RCON-port peab olema 1–65535.');
  const optionalPort = (value, label, allowDisabled = false) => { if (value == null || value === '') return null; const n = Number(value); if (allowDisabled && n === -1) return -1; if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${label} peab olema 1–65535${allowDisabled ? ' või -1 (väljas)' : ''}.`); return n; };
  const serverPort = optionalPort(input.serverPort, 'Mänguport');
  const queryPort = optionalPort(input.queryPort, 'Query-port');
  const appPort = optionalPort(input.appPort, 'Rust+ app-port', true);
  if (appPort > 0 && appPort < 10000) throw new Error('Rust+ app-port peab olema vähemalt 10000 või -1 (väljas).');
  if (serverPort && queryPort === serverPort) throw new Error('Mänguport ja query-port peavad olema erinevad (mõlemad UDP).');
  if (appPort > 0 && appPort === port) throw new Error('RCON-port ja Rust+ app-port peavad olema erinevad (mõlemad TCP).');
  const interval = Number(input.interval ?? 5);
  if (!Number.isFinite(interval) || interval < 3 || interval > 60) throw new Error('Värskendusintervall peab olema 3–60 sekundit.');
  return { name: text(input.name || 'Minu Rusti server', 100), host, port, rconPort: port, serverPort, queryPort, appPort, rconWeb: ![false,0,'0','disabled'].includes(input.rconWeb), secure: input.secure === true, interval };
}
export function validateProfile(input) {
  const profile = normalizeProfile(input);
  if (!profile.rconWeb) throw new Error('RustJan vajab WebRCON-i. Aktiveeri serveris rcon.web=1 ning vali RustJanis Enabled. Legacy RCON pole toetatud.');
  if (typeof input.password !== 'string' || !input.password || input.password.length > 512) throw new Error('Sisesta RCON-parool.');
  return profile;
}

export class Monitor extends EventEmitter {
  constructor({ WebSocketClass = globalThis.WebSocket, timeout = 12000, country = () => null, steamLookup = null, onUpdateNeeded = () => {} } = {}) {
    super();
    this.steamLookup = steamLookup;
    this.onUpdateNeeded = onUpdateNeeded;
    this.WebSocketClass = WebSocketClass;
    this.timeout = timeout;
    this.pending = new Map();
    this.sequence = 1000;
    this.generation = 0;
    this.attempt = 0;
    this.country = country;
    this.knownPlayers = new Map();
    this.actionTimers = new Set();this.views=new Set();this.pollTimes={};
    this.state = { status: 'disconnected', error: null, profile: { name: 'Minu Rusti server', host: '', port: 28016, secure: false, interval: 5 }, info: {}, players: [], history: [], logs: [], chat: [], lastUpdate: null, gameClock:null, playerHistory:[], latency: null, framework: { installed: null }, plugins: [], pluginError: null, bans: [], banError: null, bridge: null, map: { status: 'empty', error: null } };
  }
  publish() { this.emit('state', this.state); }
  redact(value) {
    let result = String(value ?? '');
    if (this.password) {
      for (const secret of [this.password, encodeURIComponent(this.password)]) result = result.split(secret).join('[peidetud]');
    }
    return result;
  }
  log(type, message, publish = true) {
    const entry = { id: ++this.sequence, time: now(), type, message: this.redact(text(message)) };
    bounded(this.state.logs, entry, 400);
    this.emit('console-entry', entry);
    if (publish) this.publish();
  }
  clearTransport() {
    clearInterval(this.adminTimer);
    for (const timer of this.actionTimers) clearTimeout(timer);
    this.actionTimers.clear();
    clearInterval(this.pollTimer); clearInterval(this.demoTimer); clearTimeout(this.reconnectTimer); clearTimeout(this.connectTimer);
    this.pollTimer = this.demoTimer = this.reconnectTimer = this.connectTimer = null;
    for (const pending of this.pending.values()) clearTimeout(pending.timer);
    this.pending.clear();
    const socket = this.socket; this.socket = null;
    if (socket) { try { socket.close(); } catch {} }
  }
  disconnect({ quiet = false } = {}) {
    this.state.serverUpdate = null;
    this.buildCheckedAt = null;
    this.generation++;
    this.clearTransport();
    this.password = null;
    this.state.status = 'disconnected'; this.state.error = null;
    if (!quiet) this.log('system', 'Ühendus suletud. Viimased andmed jäävad nähtavale.');
  }
  connect(input) {
    const profile = validateProfile(input);
    this.disconnect({ quiet: true });
    this.state = { ...this.state, profile, info: {}, players: [], gameClock:null, statistics:null,statisticsError:null,mapEvents:{supported:null,items:[]}, history: [], logs: [], chat: [], lastUpdate: null, connectedAt: null, latency: null, status: 'connecting', error: null, framework: { installed: null }, plugins: [], pluginError: null, bans: [], banError: null, bridge: null, map: { status: 'empty', error: null } };
    this.knownPlayers.clear(); this.mapImage = null;
    this.password = input.password;
    this.attempt = 0;this.pollTimes={};this.clockUnsupported=false;this.eventsUnsupported=false;this.layersUnsupported=false;this.state.mapLayers=null;this.state.items=[];this.state.itemsError=null;this.mapCheckKey=null;
    this.log('system', 'Ühendun serveriga…');
    this.open();
  }
  open() {
    const generation = ++this.generation;
    const p = this.state.profile;
    const host = p.host.includes(':') ? `[${p.host}]` : p.host;
    let socket;
    try { socket = new this.WebSocketClass(`${p.secure ? 'wss' : 'ws'}://${host}:${p.port}/${encodeURIComponent(this.password)}`); }
    catch { this.failed(generation, 'Ühendust ei saanud luua. Kontrolli aadressi ja RCON-porti.'); return; }
    this.socket = socket;
    this.connectTimer = setTimeout(() => this.failed(generation, 'RCON ei vastanud. Kontrolli parooli, porti, tulemüüri ja rcon.web=1 seadet.'), this.timeout);
    socket.addEventListener('open', () => {
      if (generation !== this.generation) return;
      clearTimeout(this.connectTimer);
      this.state.status = 'connected'; this.state.error = null; this.attempt = 0;
      this.state.connectedAt = now();
      this.log('system', 'WebRCON ühendus loodud. Ootan serveri andmeid.');
      this.refresh();
      this.request('chat.tail 100', 'chatHistory');
      this.request('oxide.version', 'framework');
      this.request('banlistex', 'bans');
      this.refreshServerInfo();
      if (this.steamLookup && this.state.status === 'connected') this.checkServerUpdate();

      this.setForeground(this.foreground !== false);
    });
    socket.addEventListener('message', event => {
      if (generation !== this.generation) return;
      if (typeof event.data !== 'string' || event.data.length > 16_000_000) return;
      this.receive(event.data);
    });
    socket.addEventListener('error', () => this.failed(generation, 'WebRCON ühendus ebaõnnestus. Kontrolli serverit, RCON-parooli ja porti.'));
    socket.addEventListener('close', () => this.failed(generation, 'Server sulges ühenduse. Proovin uuesti.'));
  }
  failed(generation, message) {
    if (generation !== this.generation || !this.password) return;
    this.generation++;
    this.clearTransport();
    this.state.status = 'reconnecting'; this.state.error = message;
    const delay = Math.min(30000, 2000 * 2 ** Math.min(this.attempt++, 4));
    this.log('warning', `${message} Uus katse ${delay / 1000} sekundi pärast.`);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
  request(command, kind = 'command', meta = {}) {
    if (this.state.status !== 'connected' || this.socket?.readyState !== 1) throw new Error('Server pole ühendatud.');
    if (!['command','adminAction'].includes(kind) && [...this.pending.values()].some(x => x.kind === kind && (kind !== 'serverField' || x.command === command))) return;
    if (this.pending.size >= 32) throw new Error('Liiga palju ootel käske. Oota serveri vastust.');
    const id = ++this.sequence;
    const generation = this.generation;
    const timer = setTimeout(() => {
      this.pending.delete(id);
      if (generation !== this.generation) return;
      if (kind === 'info') this.failed(generation, 'Serveri andmete päring aegus.');
      else if (kind === 'map') { this.state.map.status = 'error'; this.state.map.error = 'Kaardi päring aegus. Kontrolli serveripluginat.'; this.publish(); }
      else if(kind==='mapEvents'){this.eventsUnsupported=true;this.state.mapEvents={supported:false,items:[],error:'RustJanBridge events request timed out. Update or reload the plugin.'};this.publish();}
      else if(kind==='clock'){this.state.gameClock=null;this.publish();}
      else if (kind === 'steamBuild') void this.finishBuildCheck(null, meta.force);
      else if(kind==='mapLayers'){this.layersUnsupported=true;this.state.mapLayers={supported:false,error:'Layer request timed out. Update RustJanBridge to 1.4.0.'};this.publish();}
      else if(kind==='items'){this.state.itemsError='Item catalogue request timed out.';this.publish();}
      else if (kind === 'serverField') { this.state.info[meta.field] = null; this.publish(); }
      else if (['framework','plugins','pluginJson','worldsize'].includes(kind)) { if (kind === 'plugins') this.state.pluginError = 'Pluginate päring aegus.'; this.publish(); }
      else this.log('warning', kind === 'players' ? 'Mängijate nimekirja päring aegus.' : 'Käsu vastus aegus; käsk võis siiski serveris täituda.');
    }, kind === 'map' ? Math.max(45000, this.timeout) : this.timeout);
    this.pending.set(id, { kind, timer, sent: now(), ...meta });
    try { this.socket.send(JSON.stringify({ Identifier: id, Message: command, Name: 'RustJan' })); }
    catch { clearTimeout(timer); this.pending.delete(id); this.failed(generation, 'Käsu saatmine ebaõnnestus.'); }
    return id;
  }
  setForeground(value) {
    this.foreground=value;
    if(this.state.status==='connected' && !this.pollTimer)this.pollTimer=setInterval(()=>this.pollTick(),1000);
  }
  setViews(views){this.views=new Set(views);this.state.polling={views:[...this.views],interval:this.state.profile.interval||5};this.pollTick();}
  pollTick(){
    if(this.state.status!=='connected')return;
    try {
    const at=now(),has=v=>this.views.has(v),interval=this.state.profile.interval*1000;
    const due=(key,ms)=>at-(this.pollTimes[key]||0)>=ms;
    if(due('info',has('overview')?interval:30000))this.refreshInfo();
    if (this.steamLookup && (this.buildCheckedAt == null || at - this.buildCheckedAt >= updateInterval)) this.checkServerUpdate();
    if(due('players',has('map')&&this.state.bridge==='rustjan'?Math.min(interval,3000):has('overview')||has('players')?interval:30000))this.refreshPlayers();
    if(has('overview')&&this.state.bridge==='rustjan'&&!this.clockUnsupported&&due('clock',10000))this.refreshClock();
    if(has('overview')&&due('metadata',300000))this.refreshServerInfo();
    if((has('plugins')||has('map'))&&due('plugins',30000)){this.pollTimes.plugins=at;if(this.state.framework.installed)this.request('oxide.plugins','plugins');}
    if(has('map')&&this.state.bridge==='rustjan'&&!this.eventsUnsupported&&due('events',Math.min(interval,3000))){this.pollTimes.events=at;this.request('rustjan.events','mapEvents');}
    if(has('map')&&this.state.bridge==='rustjan'&&!this.layersUnsupported&&(this.mapLayers?.sleepers||this.mapLayers?.cupboards)&&due('layers',15000)){this.pollTimes.layers=at;this.request('rustjan.layers '+(this.mapLayers.sleepers?'1':'0')+' '+(this.mapLayers.cupboards?'1':'0'),'mapLayers');}
    if(has('bans')&&due('bans',30000)){this.pollTimes.bans=at;this.request('banlistex','bans');}
    }catch(e){this.log('warning',e.message);}
  }
  checkServerUpdate(force = false) {
    if (!this.steamLookup || this.state.status !== 'connected' || this.state.serverUpdate?.checking) return;
    this.request('rustjan.build', 'steamBuild', { force });
    if (this.state.status !== 'connected') return;
    this.buildCheckedAt = now();
    this.state.serverUpdate = { ...this.state.serverUpdate, checking: true };
    this.publish();
  }
  async finishBuildCheck(message, force) {
    const generation = this.generation;
    let parsed;
    try { parsed = JSON.parse(message); } catch {}
    const installed = parsed?.Schema === 1 ? buildId(parsed.BuildId) : null;
    const branch = installed ? steamBranch(parsed.Branch) : null;
    let steam;
    try { steam = await this.steamLookup(branch || 'public', force); }
    catch { steam = { latest: null, checkedAt: null, status: 'steam-error' }; }
    if (generation !== this.generation || this.state.status !== 'connected') return;
    const status = steam.status !== 'ok' ? steam.status
      : !branch ? parsed?.Error === 'manifest-unavailable' ? 'manifest-unavailable' : 'bridge-required'
      : compareBuilds(installed, steam.latest);
    this.state.serverUpdate = { ...steam, installed, branch, status, checking: false };
    if (status === 'needed') {
      const {host, port, name} = this.state.profile;
      const key = JSON.stringify([host, port, branch, steam.latest]);
      if (key !== this.lastBuildNotification) {
        this.lastBuildNotification = key;
        this.onUpdateNeeded({name: this.state.info.Hostname || name, installed, latest: steam.latest});
      }
    }
    this.publish();
  }
  refreshInfo(){if(this.state.status!=='connected')return;this.pollTimes.info=now();this.request('serverinfo','info');}
  refreshPlayers(){if(this.state.status!=='connected')return;this.pollTimes.players=now();this.request(this.views.has('map')&&this.state.bridge==='rustjan'?'rustjan.players':'playerlist','players');}
  refreshClock(){if(this.state.status!=='connected')return;this.pollTimes.clock=now();const bridge=this.state.bridge==='rustjan'&&!this.clockUnsupported;this.request(bridge?'rustjan.time':'env.time','clock',{clockMode:bridge?'bridge':'env'});}
  refresh() {
    if(this.state.status==='demo'){this.demoTick();return;}
    if(this.state.status!=='connected')return;
    try{this.refreshInfo();this.refreshPlayers();}catch(e){this.log('warning',e.message);}
  }
  receive(raw) {
    let envelope;
    try { envelope = JSON.parse(raw); } catch { this.log('warning', 'Server saatis vigase JSON-vastuse.'); return; }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return;
    const message = typeof envelope.Message === 'string' ? envelope.Message : JSON.stringify(envelope.Message ?? '');
    const pending = this.pending.get(Number(envelope.Identifier));
    if (pending) { clearTimeout(pending.timer); this.pending.delete(Number(envelope.Identifier)); }
    if (pending && this.receiveAdmin(pending, message)) return;
    if (pending?.kind === 'info' || pending?.kind === 'players' || pending?.kind === 'chatHistory') {
      let parsed;
      try { parsed = JSON.parse(message); } catch { this.log('warning', 'Serveri vastus polnud oodatud JSON-andmetena.'); return; }
      if (pending.kind === 'info' && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.state.info = { ...this.state.info, ...Object.fromEntries(['Hostname','Players','MaxPlayers','Queued','Joining','Framerate','Memory','EntityCount','Uptime','Map','GameTime','SaveCreatedTime','Protocol','Version','NetworkIn','NetworkOut'].filter(key => key in parsed).map(key => [key, typeof parsed[key] === 'string' ? text(parsed[key], 300) : number(parsed[key])])) };
        if(!this.state.gameClock || this.state.gameClock.approximate || now()-this.state.gameClock.updatedAt>15000)this.state.gameClock=parseGameTime(parsed.GameTime);
        this.emit('world-metadata');
        this.state.lastUpdate = now(); this.state.latency = now() - pending.sent;
        const sample={ time: now(), players: number(parsed.Players), fps: number(parsed.Framerate), memory: number(parsed.Memory) };
        bounded(this.state.history,sample,720);this.emit('telemetry-sample',sample);
      } else if (pending.kind === 'chatHistory' && Array.isArray(parsed)) {
        // History is requested once per connection. Merge it with any live chat
        // that arrived while the request was in flight instead of dropping it.
        const seen = new Set(this.state.chat.map(c => `${c.name}\0${c.message}\0${c.sourceTime ?? ''}`));
        const historical = [];
        for (const c of parsed.slice(-100)) {
          if (!c || typeof c !== 'object') continue;
          const name = text(c.Username ?? c.Name ?? 'Server', 120), message = text(c.Message, 4000);
          const key = `${name}\0${message}\0${c.Time ?? ''}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const timestamp = number(c.Time);
          historical.push({ id: ++this.sequence, time: timestamp == null ? now() : timestamp < 1e12 ? timestamp * 1000 : timestamp, sourceTime: c.Time ?? '', name, message, channel: c.Channel ?? 0 });
        }
        this.state.chat = [...historical, ...this.state.chat].slice(-300);
        for (const entry of historical) {entry.historical=true;this.emit('chat-entry', entry);}
      } else if (pending.kind === 'players' && Array.isArray(parsed)) {
        const previous = new Map(this.state.players.map(p => [p.SteamID, p]));
        this.state.players = parsed.slice(0, 2000).filter(p => p && typeof p === 'object' && !Array.isArray(p)).map(p => ({ SteamID: text(p.SteamID, 30), DisplayName: text(p.DisplayName ?? p.Name, 120), Ping: number(p.Ping), ConnectedSeconds: number(p.ConnectedSeconds), Health: number(p.Health), Address: addressOnly(p.Address), Country: this.country(p.Address), Position: p.Position && Number.isFinite(Number(p.Position.x)) && Number.isFinite(Number(p.Position.z)) ? { x: Number(p.Position.x), y: number(p.Position.y), z: Number(p.Position.z) } : null, TeamId: text(p.TeamId, 30) }));
        this.emit('players-snapshot',this.state.players);
        for (const player of this.state.players) this.knownPlayers.set(player.SteamID, player);
        for (const player of this.state.players) {
          if (!previous.has(player.SteamID)) this.log('join', `${player.DisplayName} on serveris.`, false);
          previous.delete(player.SteamID);
        }
        for (const player of previous.values()) this.log('leave', `${player.DisplayName} lahkus serverist.`, false);
      } else this.log('warning', 'Serveri vastuse kuju ei vasta oodatule.', false);
      this.publish(); return;
    }
    if (String(envelope.Type).toLowerCase() === 'chat') {
      let chat;
      try { chat = JSON.parse(message); } catch { chat = { Username: 'Server', Message: message }; }
      if (chat && typeof chat === 'object') {
        const stamp=number(chat.Time);
        const entry = { id: ++this.sequence, time: stamp==null ? now() : stamp<1e12 ? stamp*1000 : stamp, sourceTime: chat.Time ?? '', name: text(chat.Username ?? chat.Name ?? 'Server', 120), message: text(chat.Message, 4000), channel: chat.Channel ?? 0 };
        bounded(this.state.chat, entry, 300); this.emit('chat-entry', entry);
      }
      this.publish();
    } else if (message) this.log(text(envelope.Type || 'console', 32).toLowerCase(), message);
  }
  refreshServerInfo() {
    if(this.state.status !== 'connected') return;
    this.pollTimes.metadata=now();
    for(const [command,field] of Object.entries(serverFields)) this.request(command,'serverField',{command,field});
  }
  refreshAdmin() {
    if (this.state.status === 'demo') { this.publish(); return; }
    if (this.state.status !== 'connected') return;
    this.refreshServerInfo();
    if (this.state.framework.installed === true) this.request('oxide.plugins', 'plugins');
    else if (this.state.framework.installed == null) this.request('oxide.version', 'framework');
    this.request('banlistex', 'bans');
  }
  laterRefresh() {
    const generation = this.generation;
    for (const ms of [1200, 4500]) {
      const timer = setTimeout(() => { this.actionTimers.delete(timer); if (generation === this.generation) { this.refreshAdmin(); this.refresh(); } }, ms);
      this.actionTimers.add(timer);
    }
  }
  receiveAdmin(pending, message) {
    if (pending.kind === 'steamBuild') { void this.finishBuildCheck(message, pending.force); return true; }
    const kind = pending.kind;
    if(kind==='mapLayers'){try{const data=JSON.parse(message);if(data.Schema!==1)throw Error('Update RustJanBridge to 1.4.0');const pos=p=>p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.z));this.state.mapLayers={...this.mapLayers,supported:true,sleepers:(data.Sleepers||[]).slice(0,10000).filter(p=>pos(p.Position)).map(p=>({id:String(p.SteamID).slice(0,30),name:text(p.DisplayName,120),position:p.Position})),cupboards:(data.Cupboards||[]).slice(0,10000).filter(p=>pos(p.Position)).map(p=>({id:text(p.Id,40),owner:text(p.Owner,30),position:p.Position})),truncated:data.Truncated===true};}catch{this.layersUnsupported=true;this.state.mapLayers={supported:false,error:'Sleepers and TC layers require RustJanBridge 1.4.0.'};}this.publish();return true;}
    if(kind==='items'){try{const list=JSON.parse(message);if(!Array.isArray(list))throw Error();this.state.items=list.slice(0,5000).filter(i=>/^[a-zA-Z0-9_.-]+$/.test(i.shortname)).map(i=>({shortname:i.shortname,name:text(i.name,150),category:text(i.category,60)}));this.state.itemsError=null;}catch{this.state.itemsError='Server item catalogue requires RustJanBridge 1.4.0.';}this.publish();return true;}
    if(kind==='mapEvents'){try{this.state.mapEvents={supported:true,items:parseMapEvents(message,this.state.mapEvents?.items),updatedAt:now(),error:null};}catch(e){this.eventsUnsupported=true;this.state.mapEvents={supported:false,items:[],error:e instanceof SyntaxError?'RustJanBridge ei väljasta lennuinfot. Paigalda versioon 1.3.0.':e.message};}this.publish();return true;}
    if(kind==='clock'){
      if(pending.clockMode==='bridge'){let value;try{value=JSON.parse(message);}catch{}if(value&&Number(value.Hour)>=0&&Number(value.Hour)<24&&typeof value.IsNight==='boolean'){const hour=Number(value.Hour),m=Math.floor(hour*60)%1440;this.state.gameClock={hour,display:String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'),isNight:value.IsNight,approximate:false,updatedAt:now()};this.publish();return true;}this.clockUnsupported=true;this.refreshClock();return true;}
      const match=message.trim().match(/^env\.time\s*:\s*"?(\d+(?:\.\d+)?)"?$/i);const hour=match?Number(match[1]):NaN;
      if(hour>=0&&hour<24){const minutes=Math.floor(hour*60)%1440;this.state.gameClock={hour,display:String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0'),isNight:hour<6||hour>=18,approximate:true,updatedAt:now()};}else this.state.gameClock=null;
    } else if (kind === 'serverField') {
      this.state.info[pending.field] = parseServerField(pending.command, message);
      this.emit('world-metadata');
    } else if (kind === 'framework') {
      if (unknownCommand(message)) this.state.framework = { installed: false, version: null };
      else if (/\b(?:Oxide|uMod)\b/i.test(message)) { this.state.framework = { installed: true, version: message.match(/\d+\.\d+(?:\.\d+)?(?:\.\d+)?/)?.[0] || null }; this.request('oxide.plugins', 'plugins'); }
      else this.state.pluginError = 'Oxide/uModi vastust ei saanud tuvastada.';
    } else if (kind === 'plugins' || kind === 'pluginJson') {
      let result;
      if (kind === 'pluginJson') { try { const list = JSON.parse(message); if (Array.isArray(list)) result = { plugins: list, complete: true }; } catch {} }
      else result = parsePlugins(message);
      if (result) {
        const previous = new Map(this.state.plugins.map(p => [p.file, p]));
        this.state.plugins = result.plugins.map(p => ({ name: text(p.name, 150), file: text(p.file, 100), status: p.status === 'enabled' ? 'enabled' : 'disabled', version: p.version || previous.get(p.file)?.version || null, author: text(p.author, 150), error: text(p.error, 1000) }));
        this.state.framework.installed = true;
        this.state.pluginError = result.complete ? null : 'Osa pluginate ridu oli tundmatus vormingus.';
        const bridgePlugin=this.state.plugins.find(p=>p.file==='RustJanBridge');
        if(this.bridgeVersion!==bridgePlugin?.version){this.bridgeVersion=bridgePlugin?.version;this.eventsUnsupported=false;this.clockUnsupported=false;this.layersUnsupported=false;}
        this.state.bridgeVersion=this.bridgeVersion;
        this.state.bridge = this.state.plugins.some(p => p.status === 'enabled' && p.file === 'RustJanBridge') ? 'rustjan' : this.state.plugins.some(p => p.status === 'enabled' && p.file === 'RustadminOnline') ? 'rustadmin' : null;
        if (kind === 'plugins' && this.state.bridge === 'rustjan') this.request('rustjan.plugins', 'pluginJson');
      } else if (unknownCommand(message)) { this.state.framework.installed = false; this.state.plugins = []; }
      else this.state.pluginError = 'Pluginate loendit ei saanud lugeda. Vaata serveri konsooli.';
    } else if (kind === 'bans') {
      const bans = parseBans(message, this.knownPlayers);
      if (bans) { this.state.bans = bans; this.state.banError = null; }
      else this.state.banError = 'Serveri bänniloendi vormingut ei saanud lugeda.';
    } else if (kind === 'map') {
      try {
        if (unknownCommand(message)) throw new Error('Kaardipildi jaoks paigalda kaasa pandud RustJanBridge serveri oxide/plugins kausta või laadi RustadminOnline.');
        const image = JSON.parse(message), base64 = String(image.Base64 || '');
        if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64) || base64.length > 15_000_000) throw new Error('Vigane kaardipilt.');
        const buffer = Buffer.from(base64, 'base64');
        const mime = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : buffer[0] === 255 && buffer[1] === 216 ? 'image/jpeg' : null;
        if (!mime || !(Number(image.Width) > 0 && Number(image.Height) > 0)) throw new Error('Server ei tagastanud toetatud kaardipilti.');
        this.mapImage = { bytes: buffer, mime };

        this.state.map = { status: 'ready', imageId: now(), width: Number(image.Width), height: Number(image.Height), scale: Number(image.Scale) || pending.mapScale, worldSize: Number(image.WorldSize) || this.state.info.WorldSize, error: null };
        this.emit('map-image');
      } catch (error) { this.state.map = { ...this.state.map, status: 'error', error: error instanceof SyntaxError ? 'Serveri kaardivastus polnud JSON. Kontrolli serveripluginat.' : error.message }; }
    } else if (kind === 'adminAction') {
      this.log(/error|exception|failed|not found|unknown/i.test(message) ? 'error' : 'console', message || 'Käsk jõudis serverisse; kontrollin uuendatud loendit.', false);
      this.laterRefresh();
    } else return false;
    this.publish(); return true;
  }
  pluginAction({ action, file }) {
    if (!['load','unload','reload'].includes(action) || !/^[A-Za-z0-9_.-]{1,100}$/.test(String(file)) || String(file).includes('..')) throw new Error('Vigane plugina nimi või toiming.');
    if (!this.state.framework.installed) throw new Error('Oxide/uMod pole tuvastatud.');
    const plugin = this.state.plugins.find(p => p.file === file);
    if (!plugin) throw new Error('Pluginat ei leitud serveri loendist. Värskenda loendit.');
    if (this.state.status === 'demo') { plugin.status = action === 'unload' ? 'disabled' : 'enabled'; this.log('command', `DEMO > oxide.${action} ${file}`); return; }
    this.request(`oxide.${action} ${file}`, 'adminAction', { action });
    this.log('command', `> oxide.${action} ${file}`); this.laterRefresh();
  }
  playerAction(input) {
    const player = this.state.players.find(p => p.SteamID === String(input.steamId));
    const command = playerCommand(input, player || this.knownPlayers.get(String(input.steamId)));
    if (['kick','mute','unmute','give'].includes(input.action) && !player) throw new Error('Mängija pole enam võrgus.');
    if (this.state.status === 'demo') { this.command(command); return; }
    this.request(command, 'adminAction', { action: input.action }); this.log('command', `> ${command}`); this.laterRefresh();
  }
  loadMap() {
    if (this.state.status === 'demo') { this.state.map = { status: 'demo', error: null, worldSize: 3500 }; this.publish(); return; }
    if (this.state.status !== 'connected') throw new Error('Ühenda esmalt server.');
    if (!this.state.bridge) { this.state.map = { ...this.state.map, status: 'error', error: 'Kaardipildiks ja asukohtadeks paigalda RustJanBridge.cs serveri oxide/plugins kausta. Olemasolev RustadminOnline sobib samuti.' }; this.publish(); return; }
    const scale = Math.max(0.1, Math.min(0.5, 1200 / (Number(this.state.info.WorldSize) || 4500)));
    this.state.map = { ...this.state.map, status: 'loading', error: null }; this.publish();
    this.request(`${this.state.bridge === 'rustjan' ? 'rustjan' : 'rustadmin'}.rendermap ${scale.toFixed(4)}`, 'map', { mapScale: scale });
  }
  command(command) {
    if (typeof command !== 'string' || !command.trim() || command.length > 2000 || /[\r\n\0]/.test(command)) throw new Error('Sisesta üks käsk (kuni 2000 märki).');
    if (/^\s*rcon\.password\b/i.test(command)) throw new Error('RCON-parooli käske siin ei kuvata ega saadeta. Muuda parool serveri seadistuses.');
    if (this.state.status === 'demo') { this.log('command', `DEMO > ${command}`); this.log('console', 'Näidisrežiim: käsku serverile ei saadetud.'); return; }
    this.request(command.trim()); this.log('command', `> ${command.trim()}`);
  }
  sendChat(message) {
    if (typeof message !== 'string' || !message.trim() || message.length > 500 || /[\r\n\0]/.test(message)) throw new Error('Vestlussõnum peab olema 1–500 märki.');
    this.command(`say ${JSON.stringify(message.trim())}`);
    if (this.state.status === 'demo') {
      const entry = { id: ++this.sequence, time: now(), name: 'Admin · demo', message: message.trim(), channel: 0 };
      bounded(this.state.chat, entry, 300); this.emit('chat-entry', entry);
      this.publish();
    }
  }
  demo() {
    this.disconnect({ quiet: true });
    this.state = { ...this.state, status: 'demo', error: null, profile: { name: 'RustJan Demo', host: 'demo.local', port: 28016, interval: 5, secure: false }, info: { Hostname: 'RustJan Demo | Vanilla', Players: 10, MaxPlayers: 100, Queued: 0, Joining: 0, Framerate: 60, Memory: 4820, EntityCount: 124820, Uptime: 86400, Map: 'Procedural Map', Seed: 42069, WorldSize: 3500, GameMode:'vanilla', SaveInterval:300, Tags:'monthly,eu' }, players: ['Metsavaht','ArcticFox','NorthStar','Rusty','OakRunner','StoneKeeper','BlueHarbor','NightOwl','MapleScout','RiverWolf'].map((name, i) => ({ SteamID: `7656119800000000${i}`, DisplayName: name, Ping: 22 + i * 13, ConnectedSeconds: 420 + i * 800, Health: 100 })), history: [], logs: [], chat: [], lastUpdate: now(), latency: 12 };
    this.state.playerHistory=[];this.state.historyError=null;this.state.statisticsError=null;
    this.state.gameClock={hour:14.5,display:'14:30',isNight:false,approximate:false,updatedAt:now()};
    const days=Array.from({length:30},(_,i)=>{const d=new Date(now()-(29-i)*86400000);return{date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit'}).format(d),uniqueVisitors:7+(i*7)%18,visits:12+(i*11)%29,peak:9+(i*3)%12};});
    this.state.statistics={startedAt:now()-29*86400000,resetAt:now()-29*86400000,uniqueVisitors:128,visits:462,peak:20,days};
    this.state.framework = { installed: true, version: '2.0.0 · demo' }; this.state.pluginError = null; this.state.banError = null; this.state.bridge = 'rustjan'; this.state.map = { status: 'demo', worldSize: 3500, error: null }; this.mapImage = null;
    this.state.plugins = [{name:'RustJan Bridge',file:'RustJanBridge',version:'1.4.0',status:'enabled'}, { name: 'Kits', file: 'Kits', version: '4.4.0', author: 'uMod', status: 'enabled' }, { name: 'Gather Manager', file: 'GatherManager', version: '2.2.78', status: 'enabled' }, { name: 'Welcome Messages', file: 'WelcomeMessages', version: '1.0.0', status: 'disabled' }];
    this.state.bans = [{ steamId: '76561198099999999', name: 'Näidismängija', reason: 'Reeglite rikkumine · demo', ip: '192.0.2.20', ipSource: 'server' }];
    this.state.players.forEach((p, i) => { p.Country = ['EE','FI','SE','GB','DE','LV','LT','NO','US','NL'][i]; p.Address = `192.0.2.${10+i}`; p.Position = { x: -1200+(i%5)*550, y: 20, z: 700-Math.floor(i/5)*900 }; });
    for (let i = 60; i > 0; i--) this.state.history.push({ time: now() - i * 30000, players: 10, fps: 54 + Math.sin(i / 3) * 5, memory: 4750 + Math.cos(i / 7) * 90 });
    this.log('system', 'NÄIDISREŽIIM — need pole päris serveri andmed.');
    const messages=[['Metsavaht','Anyone heading to Outpost?'],['ArcticFox','Yes! Meeting at the road in five minutes.'],['OakRunner','Trading stone for metal fragments.'],['BlueHarbor','Great sunset near the lighthouse.'],['NorthStar','Welcome to the server, RiverWolf!']];
    for(const [index,[name,message]]of messages.entries()){const entry={id:++this.sequence,time:now()-(messages.length-index)*45000,name,message,channel:0};bounded(this.state.chat,entry,300);this.emit('chat-entry',entry);}
    this.log('generic','MapleScout joined from ip 192.0.2.18');
    this.log('generic','Saved 12000 ents, cache(0.20), write(0.05), disk(0.01).');
    this.log('generic','[RustNav] Successfully saved navmesh (0 pending tiles).');
    this.demoTimer = setInterval(() => this.demoTick(), 5000);
    this.publish();
  }
  demoTick() {
    this.state.info.Framerate = Math.round(56 + Math.sin(now() / 15000) * 4);
    this.state.info.Memory = Math.round(4820 + Math.cos(now() / 20000) * 60);
    this.state.info.Uptime += 5;
    this.state.lastUpdate = now();
    for (const player of this.state.players) player.ConnectedSeconds += 5;
    bounded(this.state.history, { time: now(), players: 10, fps: this.state.info.Framerate, memory: this.state.info.Memory }, 720);
    this.publish();
  }
  destroy() { this.disconnect({ quiet: true }); this.removeAllListeners(); }
}
