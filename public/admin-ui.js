/* RustJan administration views. Uses the shared dashboard state and transport. */
(() => {
  const byId = id => document.getElementById(id);
  const safe = escape;
  let mapServerId = null;
  let selectedPlayer = null, menuTarget = null, dialogAction = null, zoom = 1, panX = 0, panY = 0;
  let credentials = { supported: false, profiles: [] };
  let savedMatch = false;
  titles.plugins = ['Pluginad', 'Oxide / uModi pluginad ja nende olek.'];
  titles.bans = ['Bännid', 'Serveri bänniloend ja viimati nähtud IP-aadressid.'];
  titles.map = ['LiveMap', 'Serveri kaart ja mängijate asukohad reaalajas.'];
  const nav = document.querySelector('nav');
  const makeNav = (id, label, icon) => { const b = document.createElement('button'); b.id = `nav-${id}`; b.dataset.view = id; b.innerHTML = `<span data-icon="${icon}"></span>${label}`; b.onclick = () => location.hash = id; nav.insertBefore(b, nav.querySelector('[data-view="settings"]')); return b; };
  makeNav('map', 'LiveMap', 'globe');
  makeNav('plugins', 'Plugin', 'plug');
  makeNav('bans', 'Bännid', 'shield');
  document.querySelector('footer').insertAdjacentHTML('beforebegin', `
    <section id="view-plugins" class="view" hidden><article class="panel"><div class="panel-heading"><div><h2>Serveri pluginad <span class="count-badge" id="plugin-count">0</span></h2><p id="framework-version">Oxide / uMod</p></div><div class="table-tools"><input id="plugin-search" aria-label="Otsi pluginat" placeholder="Otsi pluginat…"><button class="button secondary" id="plugins-refresh">Värskenda</button></div></div><div id="plugin-notice" class="admin-notice" hidden></div><div id="plugin-table"></div><p class="panel-note">Enabled = serveris laaditud; Disabled = laadimata või laadimisel viga. Versioon kuvatakse, kui server selle väljastab. Täpsemaks loendiks ja LiveMapiks sobib RustJanBridge.</p></article></section>
    <section id="view-bans" class="view" hidden><article class="panel"><div class="panel-heading"><div><h2>Bännitud mängijad <span class="count-badge" id="ban-count">0</span></h2><p>Serveri aktiivne bänniloend</p></div><div class="table-tools"><input id="ban-search" aria-label="Otsi bänni" placeholder="Nimi, SteamID, IP või põhjus…"><button class="button secondary" id="bans-refresh">Värskenda</button></div></div><div id="ban-notice" class="admin-notice" hidden></div><div id="ban-table"></div><p class="panel-note">Rust ei pruugi vanade bännide IP-d väljastada. Siis näidatakse selle sessiooni viimati nähtud IP-d või kriipsu.</p></article></section>
    <section id="view-map" class="view" hidden><article class="panel"><div class="panel-heading"><div><h2>LiveMap <span class="count-badge" id="map-count">0</span></h2><p id="map-caption">Päris asukohad serverist</p></div><div class="table-tools"><label class="map-zoom">Suum <input id="map-zoom" type="range" min="1" max="4" step="0.25" value="1" aria-label="Kaardi suum"></label><button class="button secondary" id="map-reset">Lähtesta</button><button class="button primary" id="map-load">Laadi kaardipilt</button></div></div><div id="map-notice" class="admin-notice" hidden></div><div class="map-layout"><div class="map-stage"><svg id="live-map" viewBox="0 0 1000 1000" role="img" aria-label="Serveri reaalajas kaart"></svg><div class="map-key">N ↑ <span>● mängija</span><span>Lohista kaarti · klõpsa mängijat</span></div></div><aside class="map-player-list" id="map-player-list"></aside></div><div class="panel-note map-ready-note">Maastikupilt ja asukohad vajavad serveris <a href="/server-plugin/RustJanBridge.cs" download>RustJanBridge.cs</a> faili kaustas <code>oxide/plugins</code>. Ilma pildita näidatakse tegelikke koordinaate ruudustikul.</div></article></section>
  `);
  document.body.insertAdjacentHTML('beforeend', `<div id="player-menu" class="player-context" role="menu" hidden></div><dialog id="admin-dialog"><form id="admin-form"><div class="dialog-heading"><h2 id="admin-title">Mängija toiming</h2><button type="button" class="icon-button" id="admin-close" aria-label="Sulge toiming">×</button></div><p id="admin-target" class="dialog-description"></p><label id="admin-reason-row">Põhjus<input id="admin-reason" maxlength="200" value="Serveri reeglite rikkumine"></label><div id="admin-give-row" class="form-row" hidden><label>Eseme lühinimi<input id="admin-item" placeholder="wood, scrap, rifle.ak" pattern="[a-zA-Z0-9_.-]+" maxlength="80" list="rust-items"></label><label>Kogus<input id="admin-amount" type="number" min="1" max="100000" value="1"></label></div><datalist id="rust-items"><option value="wood"><option value="stones"><option value="scrap"><option value="metal.fragments"><option value="metal.refined"><option value="sulfur"><option value="cloth"><option value="rifle.ak"><option value="ammo.rifle"><option value="syringe.medical"></datalist><p id="admin-help" class="panel-note"></p><div id="admin-error" class="admin-notice" hidden></div><div class="dialog-actions"><button class="button secondary" type="button" id="admin-cancel">Tühista</button><button class="button primary" id="admin-submit" type="submit">Kinnita</button></div></form></dialog>`);
  byId('connect-form').querySelector('.privacy-note').insertAdjacentHTML('beforebegin', '<label class="remember-password"><input type="checkbox" name="savePassword" id="remember-password">Salvesta parool selles Windowsi kasutajakontos</label><p id="saved-password-hint" class="saved-hint" hidden>Salvestatud parool on olemas. Jäta parooliväli tühjaks, et seda kasutada.</p>');
  byId('connect-form').querySelector('.privacy-note').innerHTML = '<span data-icon="shield"></span>Valitud parool salvestatakse Windowsi DPAPI krüpteeringuga. Brauserisse parooli ei salvestata.';
  document.querySelector('.settings-content').insertAdjacentHTML('beforeend', '<button class="button secondary" id="forget-passwords">Unusta salvestatud paroolid</button>');
  document.querySelectorAll('.local-note small').forEach(el => el.textContent = 'Parooli salvestamine on valikuline ja krüpteeritud.');
  document.querySelector('.setup-list li:last-child p').textContent = 'Parooli võib soovi korral salvestada Windowsi kasutajakontoga krüpteeritult. Vaikimisi jääb see ainult protsessi mällu.';
  document.querySelector('.version > span:last-child').textContent = 'v1.1';

  function countryCell(p) {
    const code = /^[A-Z]{2}$/.test(p.Country || '') ? p.Country : null;
    const label = code === 'EE' ? 'EST' : code || '—';
    return code ? `<span class="country-cell" title="IP-põhine ligikaudne riik: ${safe(code)}"><img src="/flags/${code.toLowerCase()}.svg" alt="${safe(code)}" width="22" height="16">${safe(label)}</span>` : '<span class="country-cell" title="Riik pole teada / kohalik IP">—</span>';
  }
  playerTable = function(players, compact = false) {
    if (!players.length) return empty('users', available() ? 'Hetkel ei ole mängijaid võrgus.' : 'Mängijate loend ilmub pärast ühendamist.');
    return `<div class="table-wrap"><table><thead><tr><th>RIIK</th><th>MÄNGIJA</th>${compact ? '' : '<th>STEAMID</th>'}<th>PING</th><th>ÜHENDATUD</th>${compact ? '' : '<th>IP</th><th></th>'}</tr></thead><tbody>${players.map(p => `<tr><td>${countryCell(p)}</td><td><button class="player-link" data-history-player="${safe(playerId(p))}" title="Nime- ja külastusajalugu">${safe(playerName(p))}</button></td>${compact ? '' : `<td><span class="steam-id">${safe(playerId(p))}</span><button class="copy-button" data-copy="${safe(playerId(p))}" aria-label="Kopeeri SteamID">⧉</button></td>`}<td><span class="ping ${playerPing(p) > 150 ? 'high' : ''}">${number(playerPing(p))}${playerPing(p) == null ? '' : ' ms'}</span></td><td>${duration(playerSeconds(p))}</td>${compact ? '' : `<td class="steam-id">${safe(p.Address || '—')}</td><td><button class="icon-button player-more" data-player="${safe(playerId(p))}" aria-label="Mängija toimingud">⋮</button></td>`}</tr>`).join('')}</tbody></table></div>`;
  };
  renderChat = function() {
    const output = byId('chat-output'), previousBottom = output.scrollHeight - output.scrollTop - output.clientHeight < 70;
    const signature = JSON.stringify(state.chat); byId('chat-count').textContent = state.chat.length;
    if (signature === lastChat) return; lastChat = signature;
    output.innerHTML = state.chat.length ? state.chat.map(c => `<div class="chat-line" data-entry-id="${Number(c.id)}"><time>[${safe(logTime(c.time))}] -</time><strong>${safe(c.name || 'Server')}:</strong><span>${safe(c.message)}</span></div>`).join('') : empty('chat', 'Siin kuvatakse serverist saabuvad vestlussõnumid.');
    if (previousBottom) scrollEnd(output);
  };
  const originalLogs = renderLogs;
  renderLogs = function() {
    originalLogs();
    byId('console-output').querySelectorAll('.console-line').forEach(line => {
      const clock = line.querySelector('time'), tag = line.querySelector('.log-type');

      if (tag) tag.textContent = `[${tag.textContent.replace(/^\[|\]$/g, '')}]`;
      const content = line.textContent;
      const bad = /\b(?:error|exception|failed|failure|fatal|banned|banning|ban|banid)\b/i.test(content);
      const good = !bad && /\b(?:joined|disconnected|connected|spawned|spawning)\b|liitus|lahkus|on serveris/i.test(content);
      line.classList.toggle('log-error', bad); line.classList.toggle('log-event', good);
    });
  };
  function renderAdmin() {
    byId('nav-plugins').hidden = false;
    byId('framework-version').textContent = `Oxide / uMod ${state.framework?.version || ''}`;
    const plugins = (state.plugins || []).filter(p => `${p.name} ${p.file}`.toLowerCase().includes(byId('plugin-search').value.toLowerCase()));
    byId('plugin-count').textContent = (state.plugins || []).length;
    byId('plugin-notice').textContent = state.pluginError || ''; byId('plugin-notice').hidden = !state.pluginError;
    byId('plugin-table').innerHTML = plugins.length ? `<div class="table-wrap"><table><thead><tr><th>PLUGIN</th><th>STAATUS</th><th>VERSIOON</th><th>TOIMINGUD</th></tr></thead><tbody>${plugins.map(p => `<tr><td><strong>${safe(p.name)}</strong><small class="table-sub">${safe(p.file)}.cs${p.error ? ` · ${safe(p.error)}` : ''}</small></td><td><span class="plugin-state ${p.status === 'enabled' ? 'enabled' : 'disabled'}">${p.status === 'enabled' ? 'Enabled' : 'Disabled'}</span></td><td class="steam-id">${safe(p.version || '—')}</td><td><div class="row-actions">${['load','unload','reload'].map(action => `<button class="button mini ${action === 'unload' ? 'danger-quiet' : 'secondary'}" data-plugin-action="${action}" data-plugin-file="${safe(p.file)}" ${!available() || (action === 'load' ? p.status === 'enabled' : p.status !== 'enabled') ? 'disabled' : ''}>${action}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table></div>` : empty('plug', state.framework?.installed ? 'Serveris pole hetkel loetletud pluginaid.' : 'Ühenda Oxide/uModiga server.');
    const query = byId('ban-search').value.toLowerCase(), bans = (state.bans || []).filter(b => `${b.name} ${b.steamId} ${b.reason} ${b.ip}`.toLowerCase().includes(query));
    byId('ban-count').textContent = (state.bans || []).length; byId('ban-notice').textContent = state.banError || ''; byId('ban-notice').hidden = !state.banError;
    byId('ban-table').innerHTML = bans.length ? `<div class="table-wrap"><table><thead><tr><th>KASUTAJANIMI</th><th>STEAMID</th><th>PÕHJUS</th><th>IP</th><th></th></tr></thead><tbody>${bans.map(b => `<tr><td><strong>${safe(b.name || '—')}</strong></td><td class="steam-id">${safe(b.steamId)}</td><td>${safe(b.reason || '—')}</td><td class="steam-id" title="${b.ipSource === 'last-seen' ? 'Sessiooni viimati nähtud IP' : 'Serveri andmed'}">${safe(b.ip || '—')}${b.ip && b.ipSource === 'last-seen' ? ' *' : ''}</td><td><button class="button mini secondary" data-unban="${safe(b.steamId)}" ${!available() ? 'disabled' : ''}>Eemalda bänn</button></td></tr>`).join('')}</tbody></table></div>` : empty('shield', query ? 'Otsingule vastavaid bänne pole.' : available() ? 'Bänniloend on tühi.' : 'Ühenda server, et laadida bänniloend.');
    for (const id of ['plugins-refresh','bans-refresh','map-load']) byId(id).disabled = !available();
    renderCountryBans(); if (view === 'map') renderMap(); mountIcons();
  }
  byId('view-bans').insertAdjacentHTML('beforeend', '<article class="panel"><div class="panel-heading"><div><h2>Country Guardi IP-bännid <span id="country-ban-count" class="count-badge">—</span></h2><p>Püsivad IP-piirangud · kuni 250 viimast kirjet</p></div></div><div id="country-ban-list"></div></article>');
  function renderCountryBans() {
    if (view !== 'bans') return;
    const stateList = state.countryBans;
    const query = byId('ban-search').value.toLowerCase();
    const container = byId('country-ban-list');
    const signature = JSON.stringify([stateList,query]);
    if (container.dataset.signature === signature) return;
    container.dataset.signature = signature;
    byId('country-ban-count').textContent = stateList?.total ?? '—';
    const rows = (stateList?.rows || []).filter(row => `${row.ip} ${row.country} ${row.reason}`.toLowerCase().includes(query));
    const problem = stateList && !stateList.writable ? '<p class="panel-note">Country Guard ei saa uusi IP-bänne salvestada.</p>' : '';
    container.innerHTML = problem + (rows.length ? `<div class="table-wrap"><table><thead><tr><th>IP</th><th>RIIK</th><th>PÕHJUS</th><th>LISATUD</th></tr></thead><tbody>${rows.map(row => {
      const date = new Date(row.date);
      return `<tr><td class="steam-id">${safe(row.ip)}</td><td>${safe(row.country)}</td><td>${safe(row.reason)}</td><td>${safe(Number.isFinite(date.getTime()) ? date.toLocaleString() : '—')}</td></tr>`;
    }).join('')}</tbody></table></div>` : empty('shield', stateList ? (query ? 'Otsingule vastavaid IP-bänne pole.' : 'IP-bänniloend on tühi.') : 'IP-bänniloend vajab serveris Country Guard 1.1.0 pluginat.'));
    mountIcons(container);
  }
  const originalRender = render;
  render = function() { originalRender(); renderAdmin(); };
  const originalGo = go;
  go = function(next) { originalGo(next); if (['plugins','bans'].includes(view) && available()) action('/api/admin/refresh', {}); if (view === 'map') { renderMap(); } };
  byId('plugin-search').oninput = renderAdmin; byId('ban-search').oninput = renderAdmin;
  byId('plugins-refresh').onclick = byId('bans-refresh').onclick = () => action('/api/admin/refresh', {}, 'Loendi värskendamine tellitud.');

  function hideMenu() { byId('player-menu').hidden = true; }
  function openPlayerMenu(id, x, y) {
    const p = state.players.find(p => playerId(p) === id); if (!p) return;
    menuTarget = id; const menu = byId('player-menu');
    menu.innerHTML = `<strong class="context-name">${safe(playerName(p))}</strong>${[['kick','Kick'],['ban','Ban'],['mute','Mute'],['unmute','Unmute'],['give','Give item'],['copy','Kopeeri SteamID']].map(([key,label]) => `<button role="menuitem" data-player-action="${key}" ${!available() && key !== 'copy' ? 'disabled' : ''}>${label}</button>`).join('')}`;
    menu.hidden = false; menu.style.left = `${Math.max(8, Math.min(x, innerWidth - 200))}px`; menu.style.top = `${Math.max(8, Math.min(y, innerHeight - 310))}px`;
    menu.querySelector('button')?.focus();
  }
  document.addEventListener('contextmenu', event => { const target = event.target.closest('[data-player],[data-map-player]'); if (!target) return; event.preventDefault(); openPlayerMenu(target.dataset.player || target.dataset.mapPlayer, event.clientX, event.clientY); });
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-player]'); if (target) { const b = target.getBoundingClientRect(); openPlayerMenu(target.dataset.player, b.left, b.bottom + 4); return; }
    const choice = event.target.closest('[data-player-action]');
    if (choice) { const p = state.players.find(p => playerId(p) === menuTarget); hideMenu(); if (!p) return; if (choice.dataset.playerAction === 'copy') { navigator.clipboard.writeText(menuTarget).then(() => toast('SteamID kopeeritud.')).catch(() => toast(menuTarget)); return; } showAction({ type: 'player', action: choice.dataset.playerAction, steamId: menuTarget, name: playerName(p) }); return; }
    const plugin = event.target.closest('[data-plugin-action]'); if (plugin) { showAction({ type: 'plugin', action: plugin.dataset.pluginAction, file: plugin.dataset.pluginFile }); return; }
    const ban = event.target.closest('[data-unban]'); if (ban) { const b = (state.bans || []).find(b => b.steamId === ban.dataset.unban); showAction({ type: 'player', action: 'unban', steamId: ban.dataset.unban, name: b?.name || ban.dataset.unban }); return; }
    const mapPlayer = event.target.closest('[data-map-player]'); if (mapPlayer) { selectedPlayer = mapPlayer.dataset.mapPlayer;
      if(mapPlayer.closest('#map-player-list')){const p=state.players.find(p=>playerId(p)===selectedPlayer),m=state.map||{},size=Number(state.info.WorldSize||m.worldSize);if(p?.Position&&size){const image=Boolean(m.imageId&&m.width&&m.height);const x=(.5+p.Position.x*(image?m.scale/m.width:1/size))*1000,y=(.5-p.Position.z*(image?m.scale/m.height:1/size))*1000;panX=(500-x)*zoom;panY=(500-y)*zoom;}}
      renderMap();return; }
    if (!event.target.closest('#player-menu')) hideMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideMenu(); });
  addEventListener('scroll', hideMenu, true);
  function showAction(value) {
    if(value.action==='give'&&window.rustjanOpenItems){window.rustjanOpenItems(value);return;}
    dialogAction = value;
    byId('admin-title').textContent = value.type === 'plugin' ? `Plugin: ${value.action}` : ({ kick: 'Eemalda mängija serverist', ban: 'Kehtesta bänn', unban: 'Eemalda bänn', mute: 'Vaigista vestlus', unmute: 'Lõpeta vaigistus', give: 'Anna mängijale ese' }[value.action]);
    byId('admin-target').textContent = value.type === 'plugin' ? value.file : `${value.name} · ${value.steamId}`;
    byId('admin-reason-row').hidden = !['kick','ban'].includes(value.action);
    byId('admin-give-row').hidden = value.action !== 'give'; byId('admin-item').required = value.action === 'give';
    byId('admin-item').disabled = byId('admin-amount').disabled = value.action !== 'give';
    byId('admin-reason').disabled = !['kick','ban'].includes(value.action);
    byId('admin-help').textContent = value.type === 'plugin' ? `Serverile saadetakse oxide.${value.action} ${value.file}. Staatust kontrollitakse serveri vastusest.` : value.action === 'give' ? 'Kasuta Rusti eseme lühinime. Ese antakse ainult sellele SteamID-le.' : 'Toiming saadetakse serverisse alles kinnitamisel. Serveri vastus ilmub konsooli.';
    byId('admin-error').hidden = true; byId('admin-dialog').showModal();
  }
  byId('admin-close').onclick = byId('admin-cancel').onclick = () => byId('admin-dialog').close();
  byId('admin-form').onsubmit = async event => {
    event.preventDefault(); const button = byId('admin-submit'); button.disabled = true;
    try { await request(dialogAction.type === 'plugin' ? '/api/plugins/action' : '/api/players/action', { ...dialogAction, reason: byId('admin-reason').value, item: byId('admin-item').value.trim(), amount: Number(byId('admin-amount').value) }); byId('admin-dialog').close(); toast(state.status === 'demo' ? 'Näidistoiming. Pärisserverit ei muudeta.' : 'Toiming saadetud. Kontrolli serveri vastust konsoolist.'); }
    catch(e) { byId('admin-error').textContent = e.message; byId('admin-error').hidden = false; }
    finally { button.disabled = false; }
  };

  function renderMap() {
    if(mapServerId!==state.serverId){mapServerId=state.serverId;selectedPlayer=null;zoom=1;panX=panY=0;byId('map-zoom').value='1';}
    const m = state.map || {}, size = Number(state.info.WorldSize || m.worldSize) || 0;
    const players = state.players.filter(p => p.Position && Number.isFinite(p.Position.x) && Number.isFinite(p.Position.z));
    byId('map-count').textContent = players.length;
    byId('map-caption').textContent = state.status === 'demo' ? 'NÄIDISREŽIIM · koordinaatkaart' : `${size ? `${number(size)} m maailm · ` : ''}${m.status === 'ready' ? 'Serveri maastikupilt' : 'Koordinaatkaart'} · ${available() ? 'asukohti uuendatakse koos mängijatega' : 'ühendus puudub'}`;
    const notice = m.error || (!players.length && Number(state.info.Players)>0 ? 'Server ei väljasta veel mängijate asukohti. Paigalda RustJanBridge.cs või RustadminOnline ning värskenda loendit.' : !size ? 'Serveri maailma suurus pole veel teada. Ootan server.worldsize vastust.' : m.status === 'loading' ? 'Kaardipildi loomine serveris…' : '');
    byId('map-notice').textContent = notice; byId('map-notice').hidden = !notice;
    byId('map-load').textContent = m.status === 'loading' ? 'Kaart laeb…' : 'Laadi kaardipilt'; byId('map-load').disabled = !available() || m.status === 'loading';
    const hasImage = Boolean(m.imageId && m.width && m.height);
    let content = '<rect width="1000" height="1000" fill="#132222"/>';
    if (hasImage) content += `<image href="/api/map/image?serverId=${encodeURIComponent(state.serverId || 'server-1')}&v=${Number(m.imageId)}" width="1000" height="1000" preserveAspectRatio="none"/>`;
    for (let n = 0; n <= 10; n++) { const pos = n * 100; content += `<path d="M${pos} 0V1000 M0 ${pos}H1000" stroke="${hasImage ? '#ffffff30' : '#385451'}" stroke-width="1"/>`; if (!hasImage && size && n > 0 && n < 10) content += `<text x="${pos + 5}" y="23" fill="#9eb6ad" font-size="13">${Math.round((n / 10 - .5) * size)}</text>`; }
    if (!hasImage) content += '<text x="20" y="980" fill="#7c9c91" font-size="16">X → / Z ↑ · koordinaadid meetrites</text>';
    if (size) for (const p of players) {
      const x = (hasImage ? .5 + p.Position.x * m.scale / m.width : .5 + p.Position.x / size) * 1000;
      const y = (hasImage ? .5 - p.Position.z * m.scale / m.height : .5 - p.Position.z / size) * 1000;
      const selected = selectedPlayer === playerId(p);
      content += `<g class="map-marker" data-map-player="${safe(playerId(p))}" tabindex="0" role="button" aria-label="${safe(playerName(p))}"><title>${safe(playerName(p))} · X ${Math.round(p.Position.x)}, Z ${Math.round(p.Position.z)}</title><circle class="marker-hit" cx="${x}" cy="${y}" r="12" fill="transparent"/><circle cx="${x}" cy="${y}" r="${selected ? 2.75 : 1.75}" fill="#ff35d3" stroke="#17121d" stroke-width="0.9"/><text x="${x + 7}" y="${y + 4}" fill="#fff" stroke="#17231e" stroke-width="3" paint-order="stroke" font-size="13.6">${safe(playerName(p))}</text></g>`;
    }
    if(window.rustjanMapLayers)content+=window.rustjanMapLayers(state,m,size,hasImage);
    if(window.rustjanMapEvents)content+=window.rustjanMapEvents(state,m,size,hasImage);
    byId('live-map').innerHTML = `<g transform="translate(${panX} ${panY}) translate(500 500) scale(${zoom}) translate(-500 -500)">${content}</g>`;
    byId('map-player-list').innerHTML = `<h3>Asukohad <span>${players.length}</span></h3>${players.length ? players.map(p => `<button class="map-player ${selectedPlayer === playerId(p) ? 'selected' : ''}" data-map-player="${safe(playerId(p))}"><strong>${safe(playerName(p))}</strong><small>X ${Math.round(p.Position.x)} / Z ${Math.round(p.Position.z)}</small></button>`).join('') : '<p class="panel-note">Asukohaandmed ilmuvad siia pärast serveriplugina tuvastamist.</p>'}`;
  }
  byId('live-map').addEventListener('keydown',event=>{const target=event.target.closest('[data-map-player]');if(target && ['Enter',' '].includes(event.key)){event.preventDefault();selectedPlayer=target.dataset.mapPlayer;renderMap();}});
  byId('map-load').onclick = () => action('/api/map/load', {});
  byId('map-zoom').oninput = event => { zoom = Number(event.target.value); renderMap(); };
  byId('map-reset').onclick = () => { zoom = 1; panX = panY = 0; byId('map-zoom').value = '1'; renderMap(); };
  let drag = null;
  byId('live-map').addEventListener('pointerdown', event => { if (event.target.closest('[data-map-player],[data-map-event]')) return; const bounds = event.currentTarget.getBoundingClientRect(); drag = { x: event.clientX, y: event.clientY, panX, panY, scale: 1000 / bounds.width }; event.currentTarget.setPointerCapture(event.pointerId); });
  byId('live-map').addEventListener('pointermove', event => { if (!drag) return; panX = drag.panX + (event.clientX - drag.x) * drag.scale; panY = drag.panY + (event.clientY - drag.y) * drag.scale; renderMap(); });
  byId('live-map').addEventListener('pointerup', () => drag = null); byId('live-map').addEventListener('pointercancel', () => drag = null);

  const originalOpenConnect = openConnect;
  const key = p => `${p.secure ? 'wss' : 'ws'}://${String(p.host).toLowerCase()}:${Number(p.port)}`;
  function updateSavedMatch() {
    const form = byId('connect-form'); const profile = { host: form.elements.host.value.trim(), port: form.elements.port.value, secure: form.elements.secure.checked };
    savedMatch = credentials.profiles.some(p => key(p) === key(profile));
    form.elements.password.required = !savedMatch; form.elements.password.placeholder = savedMatch ? 'Tühi = kasuta salvestatud parooli' : 'Serveri RCON-parool';
    byId('saved-password-hint').hidden = !savedMatch; byId('remember-password').disabled = !credentials.supported;
  }
  openConnect = async function() {
    try { const res = await fetch('/api/credentials'); const value = await res.json(); credentials = res.ok ? value : { supported: false, profiles: [] }; } catch { credentials = { supported: false, profiles: [] }; }
    originalOpenConnect();
    const form = byId('connect-form');
    if (!form.elements.host.value && credentials.profiles.length) { const p = credentials.profiles[0]; for (const k of ['name','host','port','interval']) form.elements[k].value = p[k] ?? ''; form.elements.secure.checked = Boolean(p.secure); }
    updateSavedMatch(); byId('remember-password').checked = savedMatch;
  };
  document.querySelectorAll('[data-connect]').forEach(el => el.onclick = () => openConnect());
  for (const name of ['host','port','secure']) byId('connect-form').elements[name].addEventListener('input', updateSavedMatch);
  byId('connect-form').onsubmit = async event => {
    event.preventDefault(); const form = event.currentTarget;
    const profile = { name: form.elements.name.value.trim(), host: form.elements.host.value.trim(), port: Number(form.elements.port.value), secure: form.elements.secure.checked, interval: Number(form.elements.interval.value) };
    const button = byId('connect-submit'); button.disabled = true; button.textContent = 'Ühendan…'; byId('form-error').hidden = true;
    try { await request('/api/connect', { ...profile, password: form.elements.password.value, useSaved: savedMatch && !form.elements.password.value, savePassword: form.elements.savePassword.checked }); try { localStorage.setItem('rustjan-profile', JSON.stringify(profile)); } catch {} form.elements.password.value = ''; byId('connect-dialog').close(); toast('Ühenduse loomine alustatud.'); }
    catch (e) { byId('form-error').textContent = e.message; byId('form-error').hidden = false; }
    finally { button.disabled = false; button.textContent = 'Ühenda server ↗'; }
  };
  byId('forget-passwords').onclick = async () => { try { await request('/api/credentials/forget', {}); credentials.profiles = []; savedMatch = false; toast('Salvestatud paroolid unustatud.'); } catch(e) { toast(e.message); } };
  render(); go(location.hash.slice(1) || 'overview');
})();
