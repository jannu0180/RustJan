const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('rustjanDesktop',Object.freeze({desktop:true,hide:()=>ipcRenderer.send('rustjan:hide'),quit:()=>ipcRenderer.send('rustjan:quit'),info:()=>ipcRenderer.invoke('rustjan:info')}));
let notificationAudio=null;
ipcRenderer.on('rustjan:play-sound',(_event,sound)=>{if(typeof sound!=='string'||! /^(builtin:(chime|bell|ping)|custom:[a-f0-9]{64}\.(wav|mp3|ogg))$/.test(sound))return;notificationAudio?.pause();notificationAudio=new Audio(location.origin+'/api/rules/audio?sound='+encodeURIComponent(sound));notificationAudio.loop=false;notificationAudio.volume=.65;notificationAudio.play().catch(()=>{});});
window.addEventListener('DOMContentLoaded',()=>{
 let last='';const sendLanguage=()=>{const value=document.documentElement.lang;if(value!==last&&['et','en'].includes(value)){last=value;ipcRenderer.send('rustjan:language',value);}};
 new MutationObserver(sendLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sendLanguage();
});
