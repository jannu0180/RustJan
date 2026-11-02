import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import vm from'node:vm';
test('live snapshots and basket edits preserve existing image nodes and scroll; missing icons use a local placeholder',async()=>{
 const elements=new Map();function element(id){if(!elements.has(id))elements.set(id,{value:'',open:false,scrollTop:0,writes:0,events:{},set innerHTML(value){this.html=value;this.writes++;this.scrollTop=0;},get innerHTML(){return this.html||'';},textContent:'',showModal(){this.open=true;},close(){this.open=false;},addEventListener(kind,fn){this.events[kind]=fn;}});return elements.get(id);}
 const items=[{shortname:'wood',name:'Wood',category:'Resources'},{shortname:'motorbike',name:'Motorbike',category:'Items'},{shortname:'missing',name:'Missing image',category:'Items'}];
 const document={documentElement:{lang:'en'},getElementById:element,body:{insertAdjacentHTML(){}}},state={serverId:'one',bridge:'rustjan',items,players:[{SteamID:'76561198000000001',DisplayName:'Tester'}]};
 const context=vm.createContext({document,state,window:{},localStorage:{getItem:()=>null,setItem(){}},fetch:async url=>({json:async()=>url==='/item-icons.json'?['wood','motorbike']:items}),request:async()=>{},render(){},escape:value=>String(value),playerId:p=>p.SteamID,playerName:p=>p.DisplayName,setTimeout});
 const source=await readFile(new URL('../public/enhancements.js',import.meta.url),'utf8');vm.runInContext(source.slice(source.lastIndexOf('\n(() => {')),context);await new Promise(resolve=>setImmediate(resolve));
 context.window.rustjanOpenItems({steamId:state.players[0].SteamID});context.render();const grid=element('item-grid'),writes=grid.writes;grid.scrollTop=340;
 for(let i=0;i<20;i++){state.items=structuredClone(items);state.players=structuredClone(state.players);context.render();}
 assert.equal(grid.writes,writes,'equivalent live snapshots must not recreate images');assert.equal(grid.scrollTop,340,'live snapshots must not reset scroll');assert.match(grid.html,/src="\/item-icons\/motorbike.png"/);assert.match(grid.html,/src="\/item-placeholder.svg"/);assert.doesNotMatch(grid.html,/src="https?:/);
 element('items-dialog').events.click({target:{closest:selector=>selector==='[data-item-add]'?{dataset:{itemAdd:'wood'}}:null}});assert.equal(grid.writes,writes,'basket edits must preserve the grid');assert.equal(grid.scrollTop,340);
 state.items=[...items,{shortname:'stones',name:'Stones',category:'Resources'}];context.render();assert.equal(grid.writes,writes+1,'real catalogue changes still render');
});
