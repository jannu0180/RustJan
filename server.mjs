import http from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { Monitor, validateProfile, normalizeProfile } from './monitor.mjs';
import { CredentialVault } from './vault.mjs';
import { loadCountries } from './geo.mjs';
import { ConfigStore, defaults } from './config.mjs';
import { SessionLogger } from './file-logger.mjs';
import { Fleet } from './fleet.mjs';
import { PlayerHistory } from './player-history.mjs';
import { MapCache } from './map-cache.mjs';
import { ServerFiles } from './server-files.mjs';
import { Statistics } from './statistics.mjs';
import { acquireRuntimeLock } from './runtime-lock.mjs';
import { Extras } from './extras.mjs';
import { DisplayRules } from './display-rules.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
export function createApp({ monitor = new Monitor(), vault = new CredentialVault(path.join(root, 'conf')), config = null, logger = null, history = null, maps = null, statistics = null, extras = null, rules = null, iconsDirectory = path.join(root,'public','item-icons'), settings = defaults(), monitorFactory = () => new Monitor() } = {}) {
  const clients = new Set();
  let localSettings = settings;
  const fleet = new Fleet({monitor,settings,factory:monitorFactory,logger,history,maps,statistics,rules});
  const saveSettings = async (input, target= fleet.get()) => {
    if(input.profile) {
      const next=normalizeProfile(input.profile), previous=target.state.profile;
      if(previous.host && (previous.host!==next.host || previous.port!==next.port || previous.secure!==next.secure || previous.rconWeb!==next.rconWeb)) {
        target.disconnect({quiet:true});target.mapImage=null;target.knownPlayers.clear();
        Object.assign(target.state,{info:{},players:[],playerHistory:[],statistics:null,statisticsError:null,gameClock:null,history:[],logs:[],chat:[],lastUpdate:null,connectedAt:null,framework:{installed:null},plugins:[],bans:[],bridge:null,map:{status:'empty',error:null}});
      }
      target.savedProfile=next; target.state.profile=next;
    }
    const change={servers:fleet.profiles(), selectedServerId:fleet.selectedId, ...(typeof input.savePassword==='boolean'?{rememberPassword:input.savePassword}:{}), ...(input.logging?{logging:input.logging}:{}), ...(input.language?{language:input.language}:{})};
    if(config) localSettings=await config.save(change);
    else localSettings={...localSettings,...change,profile:target.state.profile,logging:{...localSettings.logging,...input.logging}};
    logger?.configure(localSettings.logging); fleet.applyForeground(); fleet.publish(); return localSettings;
  };
  const update = state => {
    const data = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
    for (const client of clients) {
      if (client.writableLength > 2_000_000) { client.destroy(); clients.delete(client); }
      else client.write(data);
    }
  };
  fleet.on('state', update);
  const notify=alert=>{for(const client of clients)if(client.writableLength<2000000)client.write('event: notification\ndata: '+JSON.stringify(alert)+'\n\n');};rules?.on('notification',notify);
  const server = http.createServer(async (req, res) => {
    const address = server.address();
    const port = address?.port;
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (!hosts.includes(req.headers.host)) { res.writeHead(403); res.end('Invalid host'); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const requestUrl = new URL(req.url, `http://127.0.0.1:${port}`);
    const pathname = requestUrl.pathname;
    const requestedId = requestUrl.searchParams.get('serverId') || fleet.selectedId;
    const monitor = fleet.monitors.get(requestedId);
    if (!monitor && pathname.startsWith('/api/')) { res.writeHead(404, {'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false,error:'Unknown server slot.'})); return; }
    const json = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
    if (req.headers.origin && !hosts.some(host => req.headers.origin === `http://${host}`)) { json(403, { ok: false, error: 'Väline päritolu pole lubatud.' }); return; }
    if(req.method==='GET'&&pathname==='/api/rules'){try{json(200,{rules:rules?await rules.load(monitor.state.profile):[],sounds:rules?await rules.sounds():[]});}catch(e){json(400,{error:e.message});}return;}
    if(req.method==='GET'&&pathname==='/api/rules/audio'){try{if(!rules)throw Error('Audio unavailable');const audio=await rules.audio(requestUrl.searchParams.get('sound'));res.writeHead(200,{'Content-Type':audio.mime});res.end(audio.bytes);}catch{res.writeHead(404);res.end();}return;}
    if(req.method==='POST'&&pathname==='/api/rules/sound'){try{if(!rules)throw Error('Audio unavailable');const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024){json(413,{error:'Sound limit: 5 MB'});return;}chunks.push(chunk);}json(200,{ok:true,sound:await rules.importSound(Buffer.concat(chunks),requestUrl.searchParams.get('name')),sounds:await rules.sounds()});}catch(e){json(400,{error:e.message});}return;}
    if(req.method==='GET'&&pathname==='/api/plugins/links'){try{json(200,{links:extras?await extras.links(monitor.state.profile):[]});}catch(e){json(400,{error:e.message});}return;}
    if(req.method==='GET'&&pathname==='/api/logs'){try{if(!extras)throw Error('Archive unavailable');const kind=requestUrl.searchParams.get('kind');const date=requestUrl.searchParams.get('date');json(200,date?await extras.archive(monitor.state.profile,{kind,date,search:requestUrl.searchParams.get('search')||'',cursor:requestUrl.searchParams.get('cursor')||'0:0'}):{files:await extras.logFiles(monitor.state.profile,kind)});}catch(e){json(400,{error:e.message});}return;}
    if (req.method === 'GET' && pathname === '/api/state') { json(200, fleet.snapshot()); return; }
    if(req.method==='GET' && pathname==='/api/players/history'){try{json(200,{ok:true,player:history?await history.visits(monitor.state.profile,requestUrl.searchParams.get('steamId')):null});}catch(e){json(500,{ok:false,error:e.message});}return;}
    if (req.method === 'GET' && pathname === '/api/credentials') { try { json(200, await vault.metadata()); } catch (e) { json(500, { ok: false, error: e.message }); } return; }
    if (req.method === 'GET' && pathname === '/api/settings') { try { json(200, { settings: { ...(config ? await config.load() : localSettings), profile: monitor.savedProfile || null }, logging: logger?.status() || localSettings.logging, directories: { conf: config?.directory || path.join(root, 'conf'), logs: logger?.directory || path.join(root, 'logs') } }); } catch(e) { json(500, { ok: false, error: e.message }); } return; }
    if (req.method === 'GET' && pathname === '/api/map/image') { if (!monitor.mapImage) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'Content-Type': monitor.mapImage.mime }); res.end(monitor.mapImage.bytes); } return; }
    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`event: state\ndata: ${JSON.stringify(fleet.snapshot())}\n\n`);
      clients.add(res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
      req.on('close', () => { clients.delete(res); clearInterval(heartbeat); });
      return;
    }
    if (req.method === 'POST' && pathname.startsWith('/api/')) {
      if (!String(req.headers['content-type']).startsWith('application/json')) { json(415, { ok: false, error: 'Vajalik on JSON-päring.' }); return; }
      let body = '';
      try {
        for await (const chunk of req) { body += chunk; if (body.length > (pathname==='/api/rules'?100000:8192)) { json(413, { ok: false, error: 'Päring on liiga suur.' }); return; } }
        const input = JSON.parse(body || '{}');
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Vigane päring.');
        if(pathname==='/api/rules'){if(!rules)throw Error('Rules unavailable');json(200,{ok:true,rules:await rules.save(monitor.state.profile,input.rules)});return;}
        else if(pathname==='/api/plugins/link'){if(!extras)throw Error('Storage unavailable');json(200,{ok:true,links:await extras.saveLink(monitor.state.profile,input)});return;}
        else if(pathname==='/api/items'){monitor.itemsUnsupported=false;monitor.request('rustjan.items','items');}
        else if(pathname==='/api/map/layers'){monitor.mapLayers={sleepers:input.sleepers===true,cupboards:input.cupboards===true};monitor.state.mapLayers={...monitor.mapLayers};monitor.pollTimes.layers=0;monitor.pollTick();}
        else if(pathname==='/api/view'){if(typeof input.clientId!=='string'||input.clientId.length>80||!['overview','players','map','console','chat','settings','plugins','bans'].includes(input.view))throw Error('Invalid view');fleet.view(input.clientId,requestedId,input.view,input.visible===true);}
        else if(pathname==='/api/statistics/reset'){if(!statistics||input.confirm!==true||input.expectedServerId!==requestedId||monitor.state.status==='demo'||!monitor.state.profile.host)throw Error('Statistika nullimine vajab kinnitust valitud serverile.');monitor.state.statistics=await statistics.reset(monitor.state.profile);monitor.state.statisticsError=null;monitor.state.history=[];monitor.publish();}
        else if(pathname==='/api/bridge/check'){monitor.eventsUnsupported=false;monitor.clockUnsupported=false;monitor.refreshAdmin();if(monitor.state.bridge==='rustjan'){monitor.request('rustjan.events','mapEvents');monitor.refreshClock();}}
        else if(pathname==='/api/time')monitor.refreshClock();
        else if (pathname === '/api/servers/select') { fleet.select(input.id); await saveSettings({}); }
        else if (pathname === '/api/servers/add') { fleet.add(); await saveSettings({}); }
        else if (pathname === '/api/servers/delete') { fleet.remove(input.id); await saveSettings({}); }
        else if (pathname === '/api/connect') {
          const profile = validateProfile({ ...input, password: input.password || (input.useSaved ? '[saved]' : '') });
          const password = input.password || (input.useSaved ? await vault.read(profile) : '');
          if (input.savePassword === true) await vault.save(profile, password);
          await saveSettings({ profile, savePassword: input.savePassword }, monitor);
          monitor.connect({ ...profile, password });
        }
        else if (pathname === '/api/settings') {
          if (input.profile && input.savePassword === true) {
            const profile = normalizeProfile(input.profile);
            const password = input.password || (input.useSaved ? await vault.read(profile) : '');
            if (password) { if (typeof password !== 'string' || password.length > 512) throw new Error('Vigane RCON-parool.'); await vault.save(profile, password); }
          }
          const settings = await saveSettings(input, monitor);
          json(200, { ok: true, settings, logging: logger?.status() || settings.logging }); return;
        }
        else if (pathname === '/api/disconnect') monitor.disconnect();
        else if (pathname === '/api/demo') monitor.demo();
        else if (pathname === '/api/refresh') { monitor.refresh(); monitor.refreshAdmin(); }
        else if (pathname === '/api/command') monitor.command(input.command);
        else if (pathname === '/api/chat') monitor.sendChat(input.message);
        else if (pathname === '/api/admin/refresh') monitor.refreshAdmin();
        else if (pathname === '/api/plugins/action') monitor.pluginAction(input);
        else if (pathname === '/api/players/action') monitor.playerAction(input);
        else if (pathname === '/api/map/load') monitor.loadMap();
        else if (pathname === '/api/credentials/forget') await vault.forget();
        else { json(404, { ok: false, error: 'Tundmatu tegevus.' }); return; }
        json(200, { ok: true });
      } catch (error) { json(400, { ok: false, error: error instanceof SyntaxError ? 'Vigane JSON.' : fleet.redact(error.message) }); }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(405, { ok: false, error: 'Meetod pole lubatud.' }); return; }
    const files = { '/rule-engine.js':['rule-engine.cjs','text/javascript'], '/rules-ui.js':['rules-ui.js','text/javascript'], '/rules.css':['rules.css','text/css'], '/item-icons.json':['item-icons.json','application/json'], '/item-placeholder.svg':['item-placeholder.svg','image/svg+xml'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/jannu.png': ['jannu.png','image/png'] };
    const flag = pathname.match(/^\/flags\/([a-z]{2})\.svg$/);
    const itemIcon=pathname.match(/^\/item-icons\/([a-zA-Z0-9_.-]{1,80})\.png$/);
    if(itemIcon){try{const bytes=await readFile(path.join(iconsDirectory,itemIcon[1]+'.png'));res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});res.end(bytes);}catch{res.writeHead(404);res.end();}return;}
    const extraFile=pathname.match(/^\/(enhancements\.js|enhancements\.css|items\.json)$/);
    const file = extraFile ? [extraFile[1],extraFile[1].endsWith('.css')?'text/css':extraFile[1].endsWith('.json')?'application/json':'text/javascript'] : flag ? [`flags/${flag[1]}.svg`, 'image/svg+xml'] : pathname === '/statistics-ui.js' ? ['statistics-ui.js','text/javascript'] : pathname === '/map-events-ui.js' ? ['map-events-ui.js','text/javascript'] : pathname === '/activity-ui.js' ? ['activity-ui.js','text/javascript'] : pathname === '/fleet-ui.js' ? ['fleet-ui.js','text/javascript'] : pathname === '/i18n.js' ? ['i18n.js','text/javascript'] : pathname === '/settings-ui.js' ? ['settings-ui.js','text/javascript'] : pathname === '/admin-ui.js' ? ['admin-ui.js', 'text/javascript'] : pathname === '/admin.css' ? ['admin.css','text/css'] : pathname === '/server-plugin/RustJanBridge.cs' ? ['../server-plugin/RustJanBridge.cs','text/plain'] : files[pathname];
    if (!file) { res.writeHead(404); res.end('Not found'); return; }
    try { const bytes = await readFile(path.join(root, 'public', file[0])); res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8` }); res.end(req.method === 'HEAD' ? undefined : bytes); }
    catch { res.writeHead(404); res.end('Not found'); }
  });
  server.on('close', () => { fleet.destroy(); fleet.off('state', update); for (const client of clients) client.end(); logger?.close(); });
  return { server, monitor, fleet, rules, close: async () => { for (const client of clients) client.end(); fleet.destroy(); await new Promise(resolve => server.close(resolve)); const results=await Promise.allSettled([logger?.close(),history?.close(),maps?.close(),statistics?.close(),rules?.close()]);const failures=results.filter(r=>r.status==='rejected');if(failures.length)throw new AggregateError(failures.map(r=>r.reason),'Could not save all RustJan data.'); } };
}

export async function createRuntime({dataDirectory=root,exclusive=true}={}) {
  if(typeof WebSocket!=='function')throw Error('RustJan requires Node.js 22.19 or newer.');
  dataDirectory=path.resolve(dataDirectory);
  const release=exclusive?await acquireRuntimeLock(dataDirectory):async()=>{};
  try{
  const country = await loadCountries(new URL('./data/', import.meta.url));
  const vault = new CredentialVault(path.join(dataDirectory, 'conf'), path.join(dataDirectory, 'data'));
  await vault.migrate();
  const config = new ConfigStore(path.join(dataDirectory, 'conf'));
  let settings = await config.load();
  if (!settings.profile && !config.loadedFromDisk) { const stored = (await vault.metadata()).profiles[0]; if (stored) settings = await config.save({ profile: stored }); }
  const monitor = new Monitor({ country });
  if (settings.profile) monitor.state.profile = settings.profile;
  const logger = new SessionLogger(path.join(dataDirectory, 'logs'), { redact: value => monitor.redact(value) });
  logger.configure(settings.logging);
  let app=null;
  const files=new ServerFiles(path.join(dataDirectory,'logs'),{legacyRoot:path.join(dataDirectory,'data'),getServers:()=>app?.fleet.profiles()||settings.servers});
  const history = new PlayerHistory(path.join(dataDirectory,'logs'),{files});
  const maps = new MapCache(path.join(dataDirectory,'logs'),{files});
  const statistics=new Statistics(path.join(dataDirectory,'logs'),{files,history});
  const rules=new DisplayRules(files,path.join(dataDirectory,'conf','sounds'),path.join(root,'public','sounds'));
  const externalIcons=path.join(dataDirectory,'assets','item-icons');
  const iconsDirectory=await access(externalIcons).then(()=>externalIcons).catch(()=>path.join(root,'public','item-icons'));
  app = createApp({ monitor, vault, config, logger, history, maps, statistics, extras:new Extras(files), rules, iconsDirectory, settings, monitorFactory: () => new Monitor({ country }) });
  const {server,close}=app;

  let closePromise;
  const stop=()=>closePromise ||= (async()=>{try{await close();}finally{await release();}})();
  return {...app,close:stop,dataDirectory,config,vault,settings};
  }catch(error){await release();throw error;}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port=Number(process.env.RUSTJAN_PORT||8787);
  const {server,close}=await createRuntime();
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${port} on kasutusel. Kui RustJan juba töötab, ava http://127.0.0.1:${port}`);
    else console.error('RustJani käivitamine ebaõnnestus:', error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log(`\n  RUSTJAN\n  Juhtpaneel: ${url}\n  Peatamiseks vajuta Ctrl+C.\n`);
    if (process.argv.includes('--open') && process.platform === 'win32') execFile('cmd.exe', ['/d', '/c', 'start', '', url], { windowsHide: true }, () => {});
  });
  process.on('SIGINT', () => { close().then(() => process.exit(0)); });
  process.on('SIGTERM', () => { close().then(() => process.exit(0)); });
}
