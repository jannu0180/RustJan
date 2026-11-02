const kinds=new Set(['plane','helicopter','airdrop','helicrate','crash']);
const point=p=>p&&['x','z'].every(k=>typeof p[k]==='number'&&Number.isFinite(p[k])&&Math.abs(p[k])<1000000)?{x:p.x,y:Number.isFinite(p.y)?p.y:0,z:p.z}:null;
export function parseMapEvents(message,previous=[],at=Date.now()){
 const value=JSON.parse(message);if(value?.Schema!==1||!Array.isArray(value.Events))throw Error('RustJanBridge schema mismatch. Update the bridge plugin.');
 const old=new Map(previous.map(e=>[e.id,e]));
 return value.Events.slice(0,320).flatMap(e=>{
  const position=point(e.Position);if(!position||!kinds.has(e.Kind)||!String(e.Id||''))return[];
  const expiresAt=Number(e.ExpiresAt)||null;if(expiresAt&&expiresAt<=at)return[];
  const prev=old.get(String(e.Id)),trail=(prev?.trail||[]).filter(p=>at-p.at<=120000);
  if(['plane','helicopter'].includes(e.Kind))trail.push({...position,at});
  return[{id:String(e.Id).slice(0,80),kind:e.Kind,position,direction:point(e.Direction),createdAt:Number(e.CreatedAt)||at,expiresAt,trail:trail.slice(-40)}];
 });
}
