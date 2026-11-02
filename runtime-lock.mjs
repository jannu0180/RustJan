import net from 'node:net';
import {mkdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
export async function acquireRuntimeLock(directory){
 await mkdir(directory,{recursive:true});const canonical=await realpath(directory);
 const id=createHash('sha256').update(process.platform==='win32'?canonical.toLowerCase():canonical).digest('hex').slice(0,28);
 const address=process.platform==='win32'?'\\\\.\\pipe\\RustJan-data-'+id:path.join(os.tmpdir(),'rustjan-'+id+'.sock');
 const lock=net.createServer(socket=>socket.destroy());
 try{await new Promise((resolve,reject)=>{lock.once('error',reject);lock.listen(address,()=>{lock.removeListener('error',reject);resolve();});});}
 catch(cause){if(cause.code==='EADDRINUSE'){const error=Error('RustJan is already using this data folder. Close the other RustJan window or terminal first.');error.code='RUSTJAN_ALREADY_RUNNING';throw error;}throw cause;}
 lock.on('error',()=>{});lock.unref();let released=false;
 return async()=>{if(released)return;released=true;await new Promise(resolve=>lock.close(resolve));};
}
