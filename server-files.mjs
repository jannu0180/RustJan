import {readFile,readdir,mkdir,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {serverFolder} from './file-logger.mjs';
import {historyKey} from './player-history.mjs';
export class ServerFiles {
 constructor(directory,{legacyRoot=null,getServers=()=>[]}={}){this.directory=directory;this.legacyRoot=legacyRoot;this.getServers=getServers;}
 file(profile,kind){
  if(!['players','maps','statistics'].includes(kind))throw Error('Invalid server storage kind');
  const key=historyKey(profile),slot=this.getServers().find(s=>s.profile && historyKey(s.profile)===key);
  const folder=serverFolder(profile.name+' ['+(slot?.id||key.slice(0,8))+']');
  return path.join(this.directory,folder,kind,key+'.json');
 }
 async read(profile,kind){
  const target=this.file(profile,kind);
  try{return await readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const key=historyKey(profile),candidates=[];
  // Preserve history when a server profile is renamed or moved to another slot.
  let folders=[];try{folders=await readdir(this.directory,{withFileTypes:true});}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const folder of folders)if(folder.isDirectory()&&!folder.isSymbolicLink()){
   const candidate=path.join(this.directory,folder.name,kind,key+'.json');
   if(candidate===target)continue;
   try{candidates.push({file:candidate,mtime:(await stat(candidate)).mtimeMs});}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  candidates.sort((a,b)=>b.mtime-a.mtime);
  if(this.legacyRoot&&kind!=='statistics')candidates.push({file:path.join(this.legacyRoot,kind==='players'?'player-history':'maps',key+'.json')});
  for(const candidate of candidates){
   try{
    const contents=await readFile(candidate.file,'utf8');JSON.parse(contents);
    await mkdir(path.dirname(target),{recursive:true});
    try{await copyFile(candidate.file,target,constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
    // The new file is authoritative; never overwrite newer observations.
    return await readFile(target,'utf8');
   }catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const error=Error('Server data not found');error.code='ENOENT';throw error;
 }
}
