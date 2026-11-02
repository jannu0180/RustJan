(() => {
 const by=id=>document.getElementById(id);
 by('view-plugins').insertAdjacentHTML('afterbegin','<div class="admin-notice plugin-requirement" role="note"><strong>Pluginahaldus vajab Oxide/uModi.</strong><div>See vaade töötab siis, kui ühendatud Rusti serverisse on paigaldatud Oxide/uMod. Ilma selleta ei saa siin pluginaid loetleda, laadida, peatada ega uuesti laadida.</div></div><article class="bridge-health panel"><div class="panel-heading"><div><h2>RustJanBridge</h2><p id="bridge-health-text"></p></div><span id="bridge-health-badge" class="plugin-state"></span></div><p id="bridge-health-help" class="panel-note"></p><div class="bridge-actions"><button class="button secondary" id="bridge-check">Kontrolli pluginat</button><a class="button primary" href="/server-plugin/RustJanBridge.cs" download>Laadi uus plugin</a></div></article>');
 by('map-notice').insertAdjacentHTML('afterend','<div id="map-event-notice" class="admin-notice" hidden></div><div class="event-options"><span id="map-event-count"></span><label class="offline-toggle"><input id="show-map-events" type="checkbox" checked>Näita kopterit, lennukit ja looti</label><span>Kollane: kopter · sinine: lennuk · roheline: loot · punane: hävimiskoht</span></div>');
 by('map-notice').insertAdjacentHTML('afterend','<div id="map-unavailable" class="map-unavailable" hidden><span class="map-unavailable-icon" data-icon="globe"></span><h2>LiveMap ei ole saadaval</h2><p id="map-unavailable-reason"></p><div id="map-install-instructions"><h3>Kuidas LiveMap tööle panna</h3><ol><li>Paigalda Rusti serverisse Oxide/uMod, kui see veel puudub.</li><li>Leia oma arvutis RustJani kaustast <code>server-plugin/RustJanBridge.cs</code>.</li><li>Kopeeri see üks fail Rusti serveri kausta <code>oxide/plugins/</code>. See on serveri, mitte sinu kohaliku RustJani kaust.</li><li>Laadi serveris RustJanBridge. Vajadusel kasuta serveri konsoolis käsku <code>oxide.reload RustJanBridge</code>.</li><li>Vaata RustJani Plugin-vaatest, et RustJanBridge oleks laaditud. Seejärel ava LiveMap uuesti ja vajuta esimesel korral „Laadi kaardipilt”.</li></ol><a class="button primary" href="/server-plugin/RustJanBridge.cs" download>Laadi RustJanBridge.cs alla</a></div></div>');
 by('bridge-check').onclick=()=>action('/api/bridge/check',{});by('show-map-events').onchange=()=>render();
 const labels={plane:['Lennuk','Cargo plane'],helicopter:['Patrullkopter','Patrol helicopter'],airdrop:['Dropbox','Dropbox'],helicrate:['Kopteri loot','Helicopter loot'],crash:['Kopteri hävimiskoht','Helicopter destroyed']};
 const colors={plane:'#6ee9ff',helicopter:'#ffd36e',airdrop:'#a5f67a',helicrate:'#f8af66',crash:'#ff7272'};
 const label=kind=>labels[kind]?.[document.documentElement.lang==='et'?0:1]||kind;
 window.rustjanMapEvents=(state,m,size,image)=>{
  if(!by('show-map-events').checked||!size)return'';
  const coordinate=p=>[(image?.5+p.x*m.scale/m.width:.5+p.x/size)*1000,(image?.5-p.z*m.scale/m.height:.5-p.z/size)*1000];
  return(state.mapEvents?.items||[]).filter(e=>!e.expiresAt||e.expiresAt>Date.now()).map(e=>{
   const [x,y]=coordinate(e.position),color=colors[e.kind],trail=(e.trail||[]).filter(p=>Date.now()-p.at<=120000).map(p=>coordinate(p).join(',')).join(' ');
   let html=trail?'<polyline points="'+trail+'" stroke="'+color+'" stroke-width="1.5" fill="none" opacity=".75" vector-effect="non-scaling-stroke"/>':'';
   if(e.direction && ['plane','helicopter'].includes(e.kind)){const length=Math.hypot(e.direction.x,e.direction.z);if(length>.01){const dx=e.direction.x/length*24,dy=-e.direction.z/length*24;html+='<path d="M'+x+' '+y+'l'+dx+' '+dy+'" stroke="'+color+'" stroke-width="2" vector-effect="non-scaling-stroke"/>';}}
   if(['airdrop','helicrate'].includes(e.kind)){
    const name=e.kind==='airdrop'?'Dropbox':label(e.kind);
    return html+'<g class="event-marker loot-marker" data-map-event="'+escape(e.id)+'" tabindex="0" role="button" aria-label="'+escape(name)+'"><title>'+escape(name)+' · X '+Math.round(e.position.x)+', Z '+Math.round(e.position.z)+'</title><circle class="event-hit" cx="'+x+'" cy="'+y+'" r="10" fill="transparent" stroke="none"/><circle class="event-location" cx="'+x+'" cy="'+y+'" r="2" fill="'+color+'" stroke="#101713" stroke-width="1"/><text class="loot-label" x="'+(x+8)+'" y="'+(y+4)+'" fill="'+color+'" stroke="#101713" stroke-width="3" paint-order="stroke" font-size="14">'+escape(name)+'</text></g>';
   }
   const symbol={plane:'✈',helicopter:'H',airdrop:'↓',helicrate:'□',crash:'✹'}[e.kind];
   return html+'<g class="event-marker" data-map-event="'+escape(e.id)+'" tabindex="0" role="button" aria-label="'+escape(label(e.kind))+'"><title>'+escape(label(e.kind))+' · X '+Math.round(e.position.x)+', Z '+Math.round(e.position.z)+(e.kind==='crash'?' · 10 min':'')+'</title><circle cx="'+x+'" cy="'+y+'" r="8" fill="#13201e" stroke="'+color+'" stroke-width="1"/><text x="'+x+'" y="'+(y+4)+'" fill="'+color+'" font-size="12" text-anchor="middle">'+symbol+'</text></g>';
  }).join('');
 };
 function diagnostic(){
  by('map-event-count').textContent=state.mapEvents?.supported?'Kaardisündmusi: '+(state.mapEvents.items||[]).filter(e=>!e.expiresAt||e.expiresAt>Date.now()).length:'';
  const p=(state.plugins||[]).find(p=>p.file?.toLowerCase()==='rustjanbridge'),version=p?.version||null;let title,help,tone='disabled';
  if(!available()){title='Ühenda server';help='Pluginat saab kontrollida pärast ühendamist.';}
  else if(state.framework?.installed!==true){title='Oxide/uMod puudub';help='Meie serveriplugin vajab Oxide/uModi.';}
  else if(!p){title='Plugin puudub';help='Paigalda RustJanBridge.cs serveri oxide/plugins kausta.';}
  else if(p.status!=='enabled'){title='Plugin on laadimata';help=p.error||'Kontrolli serveri konsoolist kompileerimisviga. Proovi laadimist või uuenda pluginat.';}
  else if(version&&Number(version.split('.')[0])===1&&Number(version.split('.')[1])<4){title='Uuendus vajalik';help='Laadi alla RustJanBridge 1.4.0 ja asenda serveris vana fail. Magajate ja TC-de kuvamine vajab uut versiooni.';}
  else if(state.mapEvents?.error){title='Plugina andmeviga';help=state.mapEvents.error;}
  else {title='Plugin töötab';tone='enabled';help='Lennu- ja loodiinfot küsitakse ainult avatud LiveMapi korral. Pärast Rusti uuendust kontrolli seda olekut uuesti.';}
  by('bridge-health-text').textContent=version?'Server: v'+version+' · RustJanBridge v1.4.0':'RustJanBridge v1.4.0';by('bridge-health-badge').textContent=title;by('bridge-health-badge').className='plugin-state '+tone;by('bridge-health-help').textContent=help;by('bridge-check').disabled=!available();
  const mapReady=available()&&state.framework?.installed===true&&p?.status==='enabled';
  by('map-unavailable').hidden=mapReady;
  document.querySelector('#view-map .map-layout').hidden=!mapReady;
  document.querySelector('#view-map .event-options').hidden=!mapReady;
  document.querySelector('#view-map .map-ready-note').hidden=!mapReady;
  for(const id of ['map-load','map-reset'])by(id).hidden=!mapReady;
  document.querySelector('#view-map .map-zoom').hidden=!mapReady;
  by('map-install-instructions').hidden=!available()||state.framework?.installed==null;
  by('map-unavailable-reason').textContent=!available()?'Ühenda esmalt oma Rusti server, et kontrollida LiveMapi tuge.':state.framework?.installed==null?'Kontrollin serveri tuge. Ootan Oxide/uModi vastust.':state.framework?.installed!==true?'Serveris ei ole Oxide/uModi tuvastatud. LiveMap vajab Oxide/uModi ja meie RustJanBridge pluginat.':!p?'RustJanBridge puudub serverist. LiveMap vajab meie serveripluginat.':'RustJanBridge ei ole serveris laaditud või on välja lülitatud. Laadi plugin uuesti, et LiveMap töötaks.';
  if(!mapReady){by('map-notice').hidden=true;by('map-caption').textContent='LiveMapi nõuded ja paigaldus';}
  const missing=mapReady&&tone!=='enabled';by('map-event-notice').hidden=!missing;by('map-event-notice').innerHTML=missing?'<strong>'+escape(title)+'</strong><div>'+escape(help)+'</div>':'';
 }
 document.addEventListener('click',e=>{const target=e.target.closest('[data-map-event]');if(!target)return;const item=state.mapEvents?.items.find(v=>v.id===target.dataset.mapEvent);if(item)toast(label(item.kind)+' · X '+Math.round(item.position.x)+' / Z '+Math.round(item.position.z));});
 document.addEventListener('keydown',e=>{if(e.target.closest('[data-map-event]')&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
 const old=render;render=function(){old();diagnostic();};render();
})();
