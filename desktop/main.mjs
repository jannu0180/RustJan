import {app,BrowserWindow,Menu,Tray,dialog,ipcMain,shell,session,screen,Notification} from 'electron';
import {readFile,writeFile,mkdir,rename,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuntime} from '../server.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
app.setName('RustJan');app.setAppUserModelId('ee.jannu.rustjan');
const dataArg=process.argv.find(a=>a.startsWith('--data-dir='));
const dataDirectory=path.resolve(dataArg?dataArg.slice('--data-dir='.length):app.isPackaged?path.dirname(app.getPath('exe')):path.join(here,'..'));
// Browser caches are local user data, never mixed into release files.
app.setPath('userData',path.join(app.getPath('appData'),'RustJan'));
let runtime,window,tray,origin,quitting=false,closed=false,closePromise,geometryTimer,noticeShown=false;
let preferences={reconnectOnLaunch:true,maximized:false,bounds:null};let language='en';
const preferencesFile=path.join(dataDirectory,'conf','desktop.json');
const lifecycleFile=path.join(dataDirectory,'logs','desktop','session.'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+process.pid+'.jsonl');
let lifecycleWrites=Promise.resolve();
function trace(type,details={}){const entry=JSON.stringify({time:new Date().toISOString(),type,...details})+'\n';lifecycleWrites=lifecycleWrites.then(async()=>{await mkdir(path.dirname(lifecycleFile),{recursive:true});await appendFile(lifecycleFile,entry,{mode:0o600});}).catch(()=>{});}
let preferenceWrites=Promise.resolve();
const tr=(en,et)=>language==='et'?et:en;
function savePreferences(){const snapshot=JSON.stringify(preferences,null,2);const work=preferenceWrites.then(async()=>{await mkdir(path.dirname(preferencesFile),{recursive:true});await writeFile(preferencesFile+'.tmp',snapshot,{mode:0o600});await rename(preferencesFile+'.tmp',preferencesFile);});preferenceWrites=work.catch(()=>{});return work;}
function rememberBounds(){if(!window||window.isDestroyed())return;preferences.maximized=window.isMaximized();preferences.bounds=window.getNormalBounds();clearTimeout(geometryTimer);geometryTimer=setTimeout(()=>savePreferences().catch(()=>{}),300);}
function showWindow(){if(!window||window.isDestroyed())return;if(window.isMinimized())window.restore();window.show();window.focus();trace('shown');}
function hideWindow(){if(!window||window.isDestroyed())return;rememberBounds();window.hide();trace('hidden');for(const m of runtime.fleet.monitors.values())m.setViews([]);runtime.fleet.viewers.clear();if(!noticeShown){noticeShown=true;tray?.displayBalloon({title:'RustJan',content:tr('RustJan is still running in the system tray. Connections, logging and statistics continue. Use Exit to stop it.','RustJan töötab edasi süsteemisalves. Ühendused, logimine ja statistika jätkuvad. Peatamiseks vali Välju.'),iconType:'info'});}}
async function quit(){if(closePromise)return closePromise;quitting=true;closePromise=(async()=>{clearTimeout(geometryTimer);rememberBounds();clearTimeout(geometryTimer);if(window&&!window.isDestroyed())window.hide();try{await savePreferences();await runtime?.close();}catch(error){dialog.showErrorBox('RustJan',tr('Could not finish saving data: ','Andmete salvestamise lõpetamine ebaõnnestus: ')+error.message);}trace('stopped');await lifecycleWrites;closed=true;tray?.destroy();if(window&&!window.isDestroyed())window.destroy();app.quit();})();return closePromise;}
async function openLogs(){const directory=path.join(dataDirectory,'logs');await mkdir(directory,{recursive:true});await shell.openPath(directory);}
function menuItems(){return[
 {label:tr('Open RustJan','Ava RustJan'),click:showWindow},
 {label:tr('Hide to tray','Peida süsteemisalve'),click:hideWindow},
 {type:'separator'},
 {label:tr('Open logs folder','Ava logikaust'),click:()=>openLogs().catch(e=>dialog.showErrorBox('RustJan',e.message))},
 {label:tr('Reconnect saved servers on launch','Ühenda salvestatud serverid käivitamisel'),type:'checkbox',checked:preferences.reconnectOnLaunch,click:item=>{preferences.reconnectOnLaunch=item.checked;void savePreferences();updateMenus();}},
 {type:'separator'},
 {label:tr('Exit RustJan','Välju RustJanist'),click:()=>quit()}
 ];}
function updateMenus(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate(menuItems()));Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'RustJan',submenu:menuItems()},
 {label:tr('Edit','Redigeeri'),submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
 {label:tr('View','Vaade'),submenu:[{label:tr('Reload window','Laadi aken uuesti'),accelerator:'Ctrl+R',click:()=>window?.webContents.reload()},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));}
function allowedSender(event){return window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame?.url?.startsWith(origin+'/');}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',showWindow);
 app.on('before-quit',event=>{if(!closed){event.preventDefault();void quit();}});
 app.on('window-all-closed',()=>{});
 app.on('activate',showWindow);
 app.whenReady().then(async()=>{
  try{
   try{const p=JSON.parse(await readFile(preferencesFile,'utf8'));preferences={reconnectOnLaunch:p.reconnectOnLaunch!==false,maximized:p.maximized===true,bounds:p.bounds};}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
   runtime=await createRuntime({dataDirectory,onUpdateNeeded: ({name,installed,latest}) => {
    if (!Notification.isSupported() || quitting) return;
    const notice = new Notification({title: language === 'et' ? 'Rusti server vajab uuendust' : 'Rust server update needed',
      body: `${name} · ${installed} → ${latest}`});
    notice.on('click',showWindow);
    notice.show();
   }});language=runtime.settings.language==='et'?'et':'en';
   await new Promise((resolve,reject)=>{runtime.server.once('error',reject);runtime.server.listen(0,'127.0.0.1',()=>{runtime.server.removeListener('error',reject);resolve();});});
   origin='http://127.0.0.1:'+runtime.server.address().port;trace('started',{port:runtime.server.address().port,version:app.getVersion()});
   const icon=path.join(here,'assets','rustjan.ico');
   tray=new Tray(icon);tray.setToolTip('RustJan');tray.on('click',showWindow);tray.on('double-click',showWindow);updateMenus();
   session.defaultSession.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===window?.webContents&&permission==='clipboard-sanitized-write'));
   session.defaultSession.setPermissionCheckHandler((contents,permission,requestingOrigin)=>contents===window?.webContents&&requestingOrigin===origin&&permission==='clipboard-sanitized-write');
   const display=screen.getPrimaryDisplay().workArea;const saved=preferences.bounds;const fits=saved&&[saved.x,saved.y,saved.width,saved.height].every(Number.isFinite)&&screen.getAllDisplays().some(d=>saved.x>=d.workArea.x-50&&saved.y>=d.workArea.y-50&&saved.x+100<d.workArea.x+d.workArea.width&&saved.y+100<d.workArea.y+d.workArea.height);
   const bounds=fits?{x:saved.x,y:saved.y,width:Math.max(900,Math.min(saved.width,display.width)),height:Math.max(640,Math.min(saved.height,display.height))}:{width:Math.min(1400,display.width),height:Math.min(940,display.height)};
   window=new BrowserWindow({...bounds,minWidth:900,minHeight:640,show:false,title:'RustJan',backgroundColor:'#111312',icon,webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:true,autoplayPolicy:'no-user-gesture-required',spellcheck:false}});
   window.on('close',event=>{if(!quitting){event.preventDefault();hideWindow();}});
   window.on('resize',rememberBounds);window.on('move',rememberBounds);
   window.on('query-session-end',()=>{void quit();});
   window.on('page-title-updated',event=>event.preventDefault());
   const external=url=>{try{const u=new URL(url);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)void shell.openExternal(u.href);}catch{}};
   window.webContents.setWindowOpenHandler(({url})=>{external(url);return{action:'deny'};});
   window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();external(url);}});
   window.webContents.on('will-attach-webview',event=>event.preventDefault());
   window.webContents.on('render-process-gone',async()=>{if(!quitting){const choice=await dialog.showMessageBox({type:'warning',title:'RustJan',message:tr('The window stopped responding. Background monitoring is still running.','Rakenduse aken lõpetas töö. Serverite jälgimine jätkub taustal.'),buttons:[tr('Reload window','Laadi aken uuesti'),tr('Exit','Välju')]});if(choice.response===0)window.webContents.reload();else void quit();}});
   ipcMain.on('rustjan:language',(event,value)=>{if(allowedSender(event)&&['et','en'].includes(value)){language=value;updateMenus();}});
   ipcMain.on('rustjan:hide',event=>{if(allowedSender(event))hideWindow();});
   ipcMain.on('rustjan:quit',event=>{if(allowedSender(event))void quit();});
   ipcMain.handle('rustjan:info',event=>{if(!allowedSender(event))throw Error('Invalid sender');return{version:app.getVersion(),dataDirectory,desktop:true};});
   runtime.rules.on('notification',alert=>{if(window&&!window.isDestroyed())window.webContents.send('rustjan:play-sound',alert.sound);});
   let lastTooltip='';runtime.fleet.on('state',state=>{const connected=state.servers.filter(s=>s.status==='connected').length,text='RustJan · '+connected+'/'+state.servers.length+' '+tr('servers connected','serverit ühendatud');if(text!==lastTooltip){lastTooltip=text;tray?.setToolTip(text);}});
   await window.loadURL(origin);
   if(preferences.maximized)window.maximize();showWindow();
   if(preferences.reconnectOnLaunch&&runtime.settings.rememberPassword!==false){
    const metadata=await runtime.vault.metadata();
    for(const monitor of runtime.fleet.monitors.values()){
     const p=monitor.savedProfile;if(!p||p.rconWeb===false||!metadata.profiles.some(v=>v.host===p.host&&Number(v.port)===Number(p.port)&&Boolean(v.secure)===Boolean(p.secure)))continue;
     try{const password=await runtime.vault.read(p);monitor.connect({...p,password});}catch(error){monitor.state.error=error.message;monitor.publish();}
    }
   }
  }catch(error){dialog.showErrorBox('RustJan',error.code==='RUSTJAN_ALREADY_RUNNING'?tr('Another RustJan is already using these settings. Close its terminal/window first, then try RustJan.exe again.','Teine RustJan kasutab juba neid seadeid. Sulge selle terminal/aken ja käivita RustJan.exe uuesti.'):error.message);quitting=true;await runtime?.close().catch(()=>{});closed=true;tray?.destroy();app.quit();}
 });
}
