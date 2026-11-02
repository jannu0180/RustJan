// Only accept replies explicitly naming the requested convar, never numbers in help/errors.
export const serverFields = Object.freeze({
  'server.worldsize':'WorldSize', 'server.seed':'Seed', 'server.gamemode':'GameMode',
  'server.saveinterval':'SaveInterval', 'server.tags':'Tags'
});
export function parseServerField(command, message) {
  if(!Object.hasOwn(serverFields,command)) return null;
  const escaped=command.replaceAll('.', '\\.');
  const match=String(message).trim().match(new RegExp('^'+escaped+'\\s*:\\s*(?:"([^"\\r\\n]*)"|([^"\\r\\n]*))\\s*$','i'));
  if(!match) return null;
  const raw=(match[1] ?? match[2]).trim();
  if(['WorldSize','Seed','SaveInterval'].includes(serverFields[command])) {
    if(!/^\d+(?:\.\d+)?$/.test(raw)) return null;
    const value=Number(raw);
    if(!Number.isFinite(value) || value<0) return null;
    if(command==='server.worldsize' && (!Number.isInteger(value) || value<=0 || value>100000)) return null;
    if(command==='server.seed' && (!Number.isInteger(value) || value>4294967295)) return null;
    if(command==='server.saveinterval' && value>31536000) return null;
    return value;
  }
  return raw.slice(0,1000) || null;
}

export function parseGameTime(value){
 if(typeof value!=='string')return null;
 const match=value.match(/(?:^|[T ])(\d{1,2}):(\d{2})(?::(\d{2}))?/);if(!match)return null;
 const h=Number(match[1]),m=Number(match[2]);if(h>23||m>59)return null;
 return {hour:h+m/60,display:String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'),isNight:h<6||h>=18,approximate:true,updatedAt:Date.now()};
}
