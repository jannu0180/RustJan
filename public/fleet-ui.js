(() => {
  const workspace=document.querySelector('.workspace');
  workspace.tabIndex=0; workspace.setAttribute('role','button');
  workspace.insertAdjacentHTML('afterend','<div id="server-slots"></div>');
  const name=document.getElementById('side-name');
  let nameText='', animation=null, lastId=null, signature='', switching=false;
  function animateName(){
    const text=name.textContent;
    if(text===nameText && animation)return;
    nameText=text; animation?.cancel(); animation=null;
    requestAnimationFrame(()=>{const overflow=name.scrollWidth-name.parentElement.clientWidth; if(overflow>2 && !matchMedia('(prefers-reduced-motion: reduce)').matches) animation=name.animate([{transform:'translateX(0)',offset:0},{transform:'translateX(0)',offset:.12},{transform:'translateX(-'+overflow+'px)',offset:.5},{transform:'translateX(-'+overflow+'px)',offset:.62},{transform:'translateX(0)',offset:1}],{duration:Math.max(10000,overflow*90),iterations:Infinity,easing:'ease-in-out'});});
  }
  new ResizeObserver(()=>{nameText='';animateName();}).observe(workspace);
  async function select(id){if(switching)return;switching=true;try{await request('/api/servers/select',{id});update(await(await fetch('/api/state')).json());}catch(e){toast(e.message);}finally{switching=false;}}
  async function add(){try{await request('/api/servers/add');update(await(await fetch('/api/state')).json()); await openConnect();}catch(e){toast(e.message);}}
  const slots=document.getElementById('server-slots');
  function renderFleet(){
    const servers=state.servers || [];
    const key=JSON.stringify([state.serverId,servers.map(s=>[s.id,s.name,s.status,s.lastUpdate>=s.connectedAt])]);
    if(signature!==key){signature=key;
      slots.innerHTML=servers.filter(s=>s.id!==state.serverId).map(s=>'<button class="server-slot" data-server-id="'+escape(s.id)+'"><span>'+escape(s.name || s.profile.name || 'Server')+'</span><i class="tiny-dot '+(s.status==='connected' && s.lastUpdate>=s.connectedAt?'green':'offline')+'" aria-label="'+(s.status==='connected'?'Ühendatud':'Mitte ühendatud')+'"></i></button>').join('')+Array.from({length:Math.max(0,3-servers.length)},()=>'<button class="server-add" aria-label="Lisa server" title="Lisa server">+</button>').join('');
    }
    animateName();
    if(state.serverId && lastId!==state.serverId){lastId=state.serverId; document.getElementById('player-menu').hidden=true; document.getElementById('admin-dialog').close(); document.getElementById('connect-dialog').close(); window.dispatchEvent(new Event('rustjan-server-changed'));}
  }
  const previous=render; render=function(){previous();renderFleet();};
  slots.addEventListener('click',e=>{const b=e.target.closest('[data-server-id]');if(b)select(b.dataset.serverId);else if(e.target.closest('.server-add'))add();});
  document.body.insertAdjacentHTML('beforeend','<div id="server-menu" class="player-context" role="menu" hidden><button data-server-action="edit" role="menuitem">Muuda</button><button data-server-action="delete" role="menuitem">Kustuta</button><button data-server-action="add" role="menuitem">Lisa server</button></div><dialog id="delete-server-dialog"><h2>Kustuta server?</h2><p id="delete-server-name"></p><p>Ühendus suletakse ja profiil eemaldatakse. Olemasolevad logifailid säilivad.</p><div class="dialog-actions"><button class="button secondary" id="delete-server-cancel">Tühista</button><button class="button primary" id="delete-server-confirm">Kustuta</button></div></dialog>');
  const menu=document.getElementById('server-menu');let targetId=null;
  document.addEventListener('contextmenu',e=>{const slot=e.target.closest('[data-server-id],.workspace');if(!slot)return;e.preventDefault();targetId=slot.dataset.serverId || state.serverId;menu.hidden=false;menu.style.left=Math.min(e.clientX,innerWidth-200)+'px';menu.style.top=Math.min(e.clientY,innerHeight-160)+'px';menu.querySelector('[data-server-action="add"]').disabled=(state.servers||[]).length>=3;});
  document.addEventListener('click',async e=>{const action=e.target.closest('[data-server-action]')?.dataset.serverAction;if(!e.target.closest('#server-menu'))menu.hidden=true;if(!action)return;menu.hidden=true;if(action==='add')return add();if(action==='edit'){await select(targetId);return openConnect();}document.getElementById('delete-server-name').textContent=(state.servers||[]).find(s=>s.id===targetId)?.name || '';document.getElementById('delete-server-dialog').showModal();});
  document.getElementById('delete-server-cancel').onclick=()=>document.getElementById('delete-server-dialog').close();
  document.getElementById('delete-server-confirm').onclick=async()=>{try{await request('/api/servers/delete',{id:targetId});document.getElementById('delete-server-dialog').close();}catch(e){toast(e.message);}};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')menu.hidden=true;});
  renderFleet();
})();
