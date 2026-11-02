/* Shared bounded wildcard matching. No user-supplied regular expressions. */
(function(root){
 function matches(pattern,value,caseSensitive=false){pattern=String(pattern||'');if(!pattern)return false;value=String(value??'');if(!caseSensitive){pattern=pattern.toLowerCase();value=value.toLowerCase();}let from=0;for(const part of pattern.split('*')){if(!part)continue;const at=value.indexOf(part,from);if(at<0)return false;from=at+part.length;}return true;}
 function lines(entry,kind,rules){return String(entry.message??'').replace(/\r\n?/g,'\n').split('\n').map(message=>{const text=kind==='chat'?(entry.name||'Server')+': '+message:message;const found=rules.filter(r=>r.enabled&&r.tabs.includes(kind)&&matches(r.pattern,text,r.caseSensitive));const hidden=found.some(r=>r.type==='hide'),highlights=hidden?[]:found.filter(r=>r.type==='highlight');return{message,hidden,color:highlights[0]?.color||null,sound:highlights.find(r=>r.sound)?.sound||null};});}
 const api={matches,lines};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RustJanRules=api;
})(typeof globalThis==='undefined'?this:globalThis);
