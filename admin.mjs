const clean = value => String(value ?? '').slice(0, 2000);
export const unknownCommand = value => /(?:unknown|not found|not recognized|invalid)\s+(?:console\s+)?command|command\s+[^\n]*not found/i.test(value);
export function parsePlugins(output) {
  if (/no plugins (?:are )?(?:found|currently loaded|loaded)/i.test(output)) return { plugins: [], complete: true };
  if (!/Listing\s+\d+\s+plugins?/i.test(output)) return null;
  const plugins = [];
  for (const line of output.split(/\r?\n/)) {
    const loaded = line.match(/^\s*\d+\s+"(.+?)"\s+\(([^)]+)\)\s+by\s+(.*?)\s+\([^)]*\)\s+-\s+(.+?)\.(?:cs|js|lua|py)\s*$/i);
    if (loaded) { plugins.push({ name: clean(loaded[1]), version: clean(loaded[2]), author: clean(loaded[3]), file: clean(loaded[4]), status: 'enabled', error: '' }); continue; }
    const failed = line.match(/^\s*\d+\s+([A-Za-z0-9_.-]+)\s+-\s+(.*)$/i);
    if (failed) plugins.push({ name: clean(failed[1].replace(/^"|"$/g, '')), file: clean(failed[1].replace(/^"|"$/g, '').replace(/\.cs$/, '')), version: null, author: '', status: 'disabled', error: clean(failed[2]) });
  }
  const expected = Number(output.match(/Listing\s+(\d+)/i)?.[1]);
  return { plugins, complete: plugins.length === expected };
}
export function parseBans(output, known = new Map()) {
  let records;
  try { const parsed = JSON.parse(output); records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bans) ? parsed.bans : null; } catch {}
  if (records) return records.filter(b => b && typeof b === 'object').map(b => {
    const steamId = clean(b.SteamID ?? b.steamid ?? b.steamId ?? b.id);
    return { steamId, name: clean(b.Username ?? b.username ?? b.DisplayName ?? b.name), reason: clean(b.Reason ?? b.reason ?? b.notes), ip: clean(b.IP ?? b.ip ?? b.Address ?? known.get(steamId)?.Address ?? ''), ipSource: b.IP || b.ip || b.Address ? 'server' : known.has(steamId) ? 'last-seen' : 'unknown' };
  });
  if (unknownCommand(output)) return null;
  const rows = [];
  for (const line of output.split(/\r?\n/)) {
    const row = line.match(/^\s*(?:\d+\s+)?(\d{17})\s+"((?:\\.|[^"\\])*)"\s+"((?:\\.|[^"\\])*)"(.*)$/);
    if (!row) continue;
    const decode = v => v.replace(/\\(["\\])/g, '$1');
    const ip = row[4].match(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/)?.[0] || known.get(row[1])?.Address || '';
    rows.push({ steamId: row[1], name: decode(row[2]), reason: decode(row[3]), ip, ipSource: !ip ? 'unknown' : known.has(row[1]) ? 'last-seen' : 'server' });
  }
  if (rows.length || !output.trim() || /(?:0\s+(?:banned|bans)|no\s+(?:users|players|bans)|ban(?:ned)?\s+(?:users|players)?\s*[:=]\s*0)/i.test(output)) return rows;
  return null;
}
export function playerCommand(input, player) {
  const id = String(input.steamId ?? '');
  if (!/^\d{17}$/.test(id)) throw new Error('Vigane SteamID.');
  const reason = String(input.reason || 'Serveri reeglite rikkumine');
  if (reason.length > 200 || /[\r\n\0;]/.test(reason)) throw new Error('Vigane põhjus (kuni 200 märki).');
  const quote = v => JSON.stringify(String(v));
  switch (input.action) {
    case 'kick': if (!player) throw new Error('Mängija pole enam võrgus.'); return `kick ${id} ${quote(reason)}`;
    case 'ban': return `banid ${id} ${quote(player?.DisplayName || input.name || id)} ${quote(reason)}`;
    case 'unban': return `unban ${id}`;
    case 'mute': if (!player) throw new Error('Mängija pole enam võrgus.'); return `mute ${id}`;
    case 'unmute': if (!player) throw new Error('Mängija pole enam võrgus.'); return `unmute ${id}`;
    case 'give': {
      if (!player) throw new Error('Mängija pole enam võrgus.');
      const item = String(input.item || ''), amount = Number(input.amount);
      if (!/^[a-zA-Z0-9_.-]{1,80}$/.test(item) || !Number.isInteger(amount) || amount < 1 || amount > 100000) throw new Error('Sisesta eseme lühinimi ja kogus 1–100000.');
      return `inventory.giveto ${id} ${item} ${amount}`;
    }
    default: throw new Error('Tundmatu mängija toiming.');
  }
}
