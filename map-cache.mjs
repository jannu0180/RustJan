import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {historyKey} from './player-history.mjs';
export const mapIdentity=state=>JSON.stringify([state.info.Map,state.info.WorldSize,state.info.Seed,state.info.SaveCreatedTime]);
export class MapCache {
 constructor(directory,{files=null}={}){this.files=files;this.directory=directory;this.queue=Promise.resolve();}
 async load(profile,identity){try{const value=JSON.parse(this.files?await this.files.read(profile,'maps'):await readFile(path.join(this.directory,historyKey(profile)+'.json'),'utf8'));if(value.identity!==identity||!['image/png','image/jpeg'].includes(value.mime)||!value.map?.width||value.base64.length>22000000)return null;return{image:{mime:value.mime,bytes:Buffer.from(value.base64,'base64')},map:value.map};}catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return null;throw e;}}
 save(profile,identity,image,map){const work=this.queue.then(async()=>{await mkdir(this.directory,{recursive:true});const file=this.files?this.files.file(profile,'maps'):path.join(this.directory,historyKey(profile)+'.json');await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify({identity,mime:image.mime,base64:image.bytes.toString('base64'),map}),{mode:0o600});await rename(file+'.tmp',file);});this.queue=work.catch(()=>{});return work;}
 async close(){await this.queue;}
}
