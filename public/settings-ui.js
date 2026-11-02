(() => {
  const el = id => document.getElementById(id);
  let stored = { profile: null, rememberPassword: true, logging: { chat: false, console: false } };
  let knownCredentials = [], locations = {}, loggingDirty = false;
  const form = el('connect-form');
  const workspace = document.querySelector('.workspace > div');
  workspace.insertAdjacentHTML('beforeend', '<span id="sidebar-connection" class="sidebar-connection" role="status">Mitte ühendatud</span>');
  document.querySelector('#view-settings').insertAdjacentHTML('afterbegin', '<div id="connection-summary" class="connection-summary" role="status" aria-live="polite"></div>');
  let connectionConfirmed = false;
  function renderConnection() {
    const connected = state.status === 'connected' && !streamDisconnected;
    const confirmed = connected && state.lastUpdate != null && Number(state.lastUpdate) >= Number(state.connectedAt || 0);
    const demo = state.status === 'demo' && !streamDisconnected;
    const pending = !streamDisconnected && (['connecting','reconnecting'].includes(state.status) || connected && !confirmed);
    const label = streamDisconnected ? 'RustJaniga ühendus puudub' : confirmed ? 'Ühendatud' : connected ? 'Ühendatud · ootan andmeid' : ({ connecting: 'Ühendamine…', reconnecting: 'Taasühendamine…', disconnected: 'Mitte ühendatud', demo: 'Demorežiim' }[state.status] || 'Mitte ühendatud');
    const tone = confirmed ? 'success' : demo || pending ? 'pending' : 'offline';
    const explanation = streamDisconnected ? 'Ühendus kohaliku RustJaniga katkes. Proovin automaatselt uuesti.' : confirmed ? `${state.info.Hostname || state.profile.name} · ${state.profile.host}:${state.profile.port} · server vastab, andmed ${time(state.lastUpdate)}` : demo ? 'Näidisandmed. Päris Rusti serveriga ühendust ei ole.' : state.error || (pending ? 'Ootan serveri kinnitust ja andmeid…' : 'Sisesta serveri andmed ja vajuta „Ühenda server”.');
    el('sidebar-connection').textContent = label; el('sidebar-connection').className = `sidebar-connection ${tone}`;
    el('side-dot').className = `tiny-dot connection-dot ${tone}`;
    el('status').innerHTML = `<i></i>${escape(label)}`;
    el('status').className = `status-pill connection-pill ${tone}`;
    el('connection-summary').className = `connection-summary ${tone}`;
    el('connection-summary').innerHTML = `<span class="connection-indicator" aria-hidden="true">${confirmed ? '✓' : demo ? '◇' : pending ? '↻' : '○'}</span><div><strong>${escape(label)}</strong><p>${escape(explanation)}</p></div>`;
    if (confirmed && !connectionConfirmed) toast(`Ühendatud serveriga „${state.info.Hostname || state.profile.name}”.`);
    connectionConfirmed = confirmed;
  }
  form.elements.port.closest('.form-row').insertAdjacentHTML('afterend', `<div class="extra-ports"><label>Mänguport · UDP<input name="serverPort" type="number" min="1" max="65535" placeholder="nt 16015"><small>Mängijate ühendus: server.port</small></label><label>Query-port · UDP<input name="queryPort" type="number" min="1" max="65535" placeholder="nt 16016 (valikuline)"><small>Steami/serveriloendi päringud; RustJan ei vaja.</small></label><label>Rust+ app-port · TCP<input name="appPort" type="number" min="-1" max="65535" placeholder="nt 16082 (valikuline)"><small>Rust+ kaasrakendus; -1 = väljas. RustJan ei vaja.</small></label><label>RCON Web<select name="rconWeb"><option value="enabled">Enabled · rcon.web = 1</option><option value="disabled">Disabled · rcon.web = 0</option></select><small>RustJan ühendub ainult Enabled-režiimis.</small></label></div><p class="connection-help">RCON-port on haldusühenduse TCP-port, mitte mänguport. Kasuta serveri päris IP-d; <code>0.0.0.0</code> on serveri kuulamisaadress. Need väljad salvestavad RustJani profiili, mitte ei muuda serveri enda seadeid.</p>`);
  form.querySelector('.dialog-actions').insertAdjacentHTML('afterbegin', '<button type="button" class="button secondary" id="save-connection-settings">Salvesta seadistus</button>');
  el('remember-password').closest('label').lastChild.textContent = 'Salvesta parool krüpteeritult RustJani conf kausta';
  form.querySelector('.privacy-note').innerHTML = '<span data-icon="shield"></span>Seadistus: conf/settings.json. Salvestatud parool: conf/credentials.json (Windowsi DPAPI krüpteering).';
  document.querySelector('#view-settings .settings-grid').insertAdjacentHTML('beforeend', `<article class="panel"><div class="panel-heading"><div><h2>Konfiguratsioon arvutis</h2><p>Kogu profiil säilib RustJani conf kaustas</p></div><span data-icon="settings"></span></div><div class="settings-content"><dl id="saved-config-details"></dl><div class="row-actions"><button class="button secondary" id="edit-saved-config">Muuda ja salvesta</button><button class="button secondary" id="copy-game-connect">Kopeeri mänguühendus</button></div><p class="connection-help">Query- ja Rust+ app-port on profiili infoväljad. RustJan suhtleb serveriga RCON-pordi kaudu. Väljade muutmine ei ava porte ega lülita serveris WebRCON-i sisse.</p></div></article><article class="panel"><div class="panel-heading"><div><h2>Faililogid</h2><p>Vestlus ja konsool on eraldi lülitatavad</p></div><span data-icon="terminal"></span></div><div class="settings-content"><label class="remember-password"><input id="log-chat-enabled" type="checkbox">Logi vestlus failidesse</label><label class="remember-password"><input id="log-console-enabled" type="checkbox">Logi konsool failidesse</label><button class="button primary" id="save-logging-settings">Salvesta logimise seaded</button><p class="connection-help">Iga käivitus saab kuupäeva, kellaaja ja unikaalse tunnusega failid. Sama käivituse jooksul lisatakse ridu faili lõppu. Keskööl alustatakse uue päeva faile.</p><div id="logging-status" class="connection-help"></div><div id="logging-error" class="admin-notice" hidden></div></div></article>`);
  const key = p => `${p.secure ? 'wss' : 'ws'}://${String(p.host || '').toLowerCase()}:${Number(p.rconPort ?? p.port)}`;
  function readProfile() {
    const port = Number(form.elements.port.value);
    const optional = name => form.elements[name].value === '' ? null : Number(form.elements[name].value);
    return { name: form.elements.name.value.trim(), host: form.elements.host.value.trim(), port, rconPort: port, serverPort: optional('serverPort'), queryPort: optional('queryPort'), appPort: optional('appPort'), rconWeb: form.elements.rconWeb.value === 'enabled', secure: form.elements.secure.checked, interval: Number(form.elements.interval.value) };
  }
  function updatePasswordHint() {
    const exists = knownCredentials.some(p => key(p) === key(readProfile()));
    form.elements.password.required = !exists;
    form.elements.password.placeholder = exists ? 'Tühi = kasuta conf kausta salvestatud parooli' : 'Serveri RCON-parool';
    el('saved-password-hint').hidden = !exists;
    return exists;
  }
  async function loadSettings() {
    const serverId=state.serverId || 'server-1';
    const [settingsResponse, credentialsResponse] = await Promise.all([fetch('/api/settings?serverId='+encodeURIComponent(state.serverId || 'server-1')), fetch('/api/credentials')]);
    const data = await settingsResponse.json();
    if (!settingsResponse.ok) throw Error(data.error || 'Seadete laadimine ebaõnnestus.');
    if((state.serverId || 'server-1')!==serverId)return data;
    stored = data.settings; locations = data.directories || {};
    const meta = await credentialsResponse.json(); knownCredentials = credentialsResponse.ok ? meta.profiles || [] : [];
    if (!loggingDirty) { el('log-chat-enabled').checked = stored.logging.chat; el('log-console-enabled').checked = stored.logging.console; }
    renderSettings();
    return data;
  }
  function renderSettings() {
    renderConnection();
    const p = stored.profile || {}, active = state.profile || {};
    details('saved-config-details', [['Profiil', p.name || 'Veel salvestamata'], ['Serveri IP', p.host || '—'], ['Mänguport · UDP', p.serverPort ?? '—'], ['RCON-port · TCP', p.rconPort ?? p.port ?? '—'], ['Query-port · UDP', p.queryPort ?? '— (valikuline)'], ['Rust+ app-port · TCP', p.appPort === -1 ? '-1 · väljas' : p.appPort ?? '— (valikuline)'], ['RCON Web', p.rconWeb === false ? 'Disabled · 0' : 'Enabled · 1'], ['Konfiguratsioonikaust', locations.conf || 'RustJan/conf']]);
    if (active.host) details('connection-details', [['Serveri nimi', active.name], ['Aadress', active.host], ['Mänguport · UDP', active.serverPort ?? '—'], ['RCON-port · TCP', active.rconPort ?? active.port], ['Query-port · UDP', active.queryPort ?? '—'], ['Rust+ app-port · TCP', active.appPort ?? '—'], ['RCON Web', active.rconWeb === false ? 'Disabled · 0' : 'Enabled · 1'], ['Ühenduse tüüp', active.secure ? 'WebRCON / WSS' : 'WebRCON / WS'], ['Värskendamine', `${active.interval || 5} sekundit`]]);
    el('copy-game-connect').disabled = !p.host || !p.serverPort;
    const logging = state.logging || stored.logging;
    const files = Object.values(logging.files || {});
    el('logging-status').innerHTML = `<div><strong>Vestlus:</strong> ${logging.chat ? 'sees' : 'väljas'} · <strong>Konsool:</strong> ${logging.console ? 'sees' : 'väljas'}</div><div class="path-text">${escape(locations.logs || logging.directory || 'RustJan/logs')}</div>${files.map(file => `<div class="path-text">${escape(String(file).split(/[\\/]/).at(-1))}</div>`).join('')}`;
    el('logging-error').textContent = logging.error || ''; el('logging-error').hidden = !logging.error;
  }
  const previousRender = render;
  render = function() { previousRender(); renderSettings(); };
  const previousOpen = openConnect;
  openConnect = async function() {
    try { await loadSettings(); } catch(e) { toast(e.message); }
    await previousOpen();
    const active = state.status !== 'demo' && state.profile?.host ? state.profile : null;
    const profile = stored.profile || active || {name:'',host:'',port:28016,interval:5,secure:false};
    if (profile) {
      for (const name of ['name','host','port','interval']) form.elements[name].value = profile[name] ?? '';
      form.elements.secure.checked = Boolean(profile.secure);
    }
    for (const name of ['serverPort','queryPort','appPort']) form.elements[name].value = profile?.[name] ?? '';
    form.elements.rconWeb.value = profile?.rconWeb === false ? 'disabled' : 'enabled';
    el('remember-password').checked = stored.rememberPassword !== false && !el('remember-password').disabled;
    updatePasswordHint();
  };
  document.querySelectorAll('[data-connect]').forEach(button => button.onclick = () => openConnect());
  el('edit-saved-config').onclick = () => openConnect();
  for (const name of ['host','port','secure']) form.elements[name].addEventListener('input', updatePasswordHint);
  async function submit(connect) {
    const profile = readProfile(), password = form.elements.password.value;
    const input = { ...profile, password, useSaved: !password && updatePasswordHint(), savePassword: el('remember-password').checked };
    const connectButton = el('connect-submit'), saveButton = el('save-connection-settings');
    connectButton.disabled = saveButton.disabled = true; el('form-error').hidden = true;
    try {
      await request(connect ? '/api/connect' : '/api/settings', connect ? input : { profile, password: input.password, useSaved: input.useSaved, savePassword: input.savePassword });
      try { localStorage.setItem('rustjan-profile', JSON.stringify(profile)); } catch {}
      form.elements.password.value = '';
      await loadSettings(); updatePasswordHint();
      if (connect) el('connect-dialog').close();
      toast(connect ? 'Ühenduse loomine alustatud. Profiil salvestati conf kausta.' : 'Konfiguratsioon salvestatud conf kausta. Serveri enda seadeid ei muudetud.');
    } catch(e) { el('form-error').textContent = e.message; el('form-error').hidden = false; }
    finally { connectButton.disabled = saveButton.disabled = false; }
  }
  form.onsubmit = event => { event.preventDefault(); submit(true); };
  el('save-connection-settings').onclick = () => submit(false);
  el('copy-game-connect').onclick = async () => { const p = stored.profile; if (!p?.host || !p.serverPort) return; const address = p.host.includes(':') ? `[${p.host}]` : p.host; const command = `client.connect ${address}:${p.serverPort}`; try { await navigator.clipboard.writeText(command); toast('Mänguühenduse käsk kopeeritud.'); } catch { toast(command); } };
  for (const id of ['log-chat-enabled','log-console-enabled']) el(id).onchange = () => loggingDirty = true;
  el('save-logging-settings').onclick = async () => {
    const button = el('save-logging-settings'); button.disabled = true;
    try { await request('/api/settings', { logging: { chat: el('log-chat-enabled').checked, console: el('log-console-enabled').checked } }); loggingDirty = false; await loadSettings(); toast('Logimise seaded salvestatud. Muudatus jõustus kohe.'); }
    catch(e) { toast(e.message); } finally { button.disabled = false; }
  };
  window.addEventListener('rustjan-server-changed',()=>{loggingDirty=false;loadSettings().catch(e=>toast(e.message));});
  const oldForget = el('forget-passwords').onclick;
  el('forget-passwords').onclick = async () => { await oldForget(); await loadSettings(); updatePasswordHint(); };
  document.querySelector('.version > span:last-child').textContent = 'v1.5.3';
  document.querySelector('.setup-list li:last-child p').textContent = 'Parool salvestatakse valiku korral Windowsi kasutajakontoga krüpteeritult RustJani conf kausta. Salvestamata parool jääb ainult protsessi mällu.';
  mountIcons(); loadSettings().catch(e => toast(e.message));
})();
