const net=require('node:net');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
// Discord call control through the Discord desktop app's local RPC (named pipe discord-ipc-N).
// No web session is used: WinMore talks to the Discord app already running and signed in on this PC.
// Voice control needs the user's own Discord application (Client ID + Secret); Discord shows its
// own Authorize prompt once, then WinMore keeps the token encrypted with Windows user credentials.
const OP={HANDSHAKE:0,FRAME:1,CLOSE:2,PING:3,PONG:4};
const SCOPES=['rpc','rpc.voice.read','rpc.voice.write'];
const TOKEN_URL='https://discord.com/api/oauth2/token';
const CHANNEL_EVENTS=['VOICE_STATE_CREATE','VOICE_STATE_UPDATE','VOICE_STATE_DELETE','SPEAKING_START','SPEAKING_STOP'];
const SNOWFLAKE=/^\d{15,22}$/;

function encodeFrame(op,payload){
 const body=Buffer.from(JSON.stringify(payload),'utf8'),head=Buffer.alloc(8);
 head.writeUInt32LE(op,0);head.writeUInt32LE(body.length,4);
 return Buffer.concat([head,body]);
}
function createFrameReader(onFrame){
 let buffer=Buffer.alloc(0);
 return chunk=>{
  buffer=buffer.length?Buffer.concat([buffer,chunk]):chunk;
  while(buffer.length>=8){
   const op=buffer.readUInt32LE(0),length=buffer.readUInt32LE(4);
   if(length>8*1024*1024)throw Error('Discord sent an oversized message.');
   if(buffer.length<8+length)break;
   const body=buffer.subarray(8,8+length);buffer=buffer.subarray(8+length);
   let data;try{data=JSON.parse(body.toString('utf8'));}catch{continue;}
   onFrame(op,data);
  }
 };
}
function avatarURL(user){
 if(!user||!SNOWFLAKE.test(String(user.id)))return null;
 if(user.avatar&&/^(a_)?[a-f0-9]{32}$/.test(user.avatar))return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
 const legacy=user.discriminator&&user.discriminator!=='0'?Number(user.discriminator)%5:Number((BigInt(user.id)>>22n)%6n);
 return `https://cdn.discordapp.com/embed/avatars/${legacy}.png`;
}
const displayName=entry=>String(entry?.nick||entry?.user?.global_name||entry?.user?.username||'Someone').slice(0,64);
// One voice participant as the phone sees it. `muted`/`volume` are the local (only-for-me) settings.
function presentMember(entry,{selfId,speaking}){
 const user=entry.user||{},voice=entry.voice_state||{},id=String(user.id);
 return {
  id,name:displayName(entry),avatar:avatarURL(user),you:id===selfId,bot:user.bot===true,speaking:speaking.has(id),
  muted:entry.mute===true,volume:Math.round(Number.isFinite(entry.volume)?entry.volume:100),
  selfMute:voice.self_mute===true,selfDeaf:voice.self_deaf===true,serverMute:voice.mute===true||voice.suppress===true,serverDeaf:voice.deaf===true,
  // Discord includes this only when it reports Go Live; absent means not streaming.
  streaming:voice.self_stream===true
 };
}
function validateDiscordCommand(action,value,members){
 if(action==='mute'||action==='deafen'){
  if(typeof value!=='boolean')throw Error('Choose on or off.');
  return {action,value};
 }
 if(action==='leave')return {action};
 if(action==='user-mute'||action==='user-volume'){
  if(!value||typeof value!=='object'||typeof value.id!=='string'||!members.has(value.id))throw Error('That person is no longer in the call.');
  if(action==='user-mute'){
   if(typeof value.muted!=='boolean')throw Error('Choose mute or unmute.');
   return {action,id:value.id,muted:value.muted};
  }
  if(typeof value.volume!=='number'||!Number.isFinite(value.volume)||value.volume<0||value.volume>200)throw Error('Volume must be between 0 and 200.');
  return {action,id:value.id,volume:Math.round(value.volume)};
 }
 throw Error('Unknown call control.');
}
function validateSetup({clientId,clientSecret}={}){
 clientId=String(clientId||'').trim();clientSecret=String(clientSecret||'').trim();
 if(!SNOWFLAKE.test(clientId))throw Error('The Client ID is the long number on your Discord application’s General Information page.');
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(clientSecret))throw Error('Paste the Client Secret from your Discord application’s OAuth2 page.');
 return {clientId,clientSecret};
}
function openPipe(){
 const base=process.platform==='win32'?'\\\\?\\pipe\\discord-ipc-':path.join(process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||'/tmp','discord-ipc-');
 return new Promise((resolve,reject)=>{
  const attempt=index=>{
   if(index>9)return reject(Error('Discord is not running on this PC.'));
   const socket=net.createConnection(base+index);
   socket.once('connect',()=>{socket.removeAllListeners('error');resolve(socket);});
   socket.once('error',()=>{socket.destroy();attempt(index+1);});
  };
  attempt(0);
 });
}

function createDiscord({file,encryption,fetch=globalThis.fetch,connect=openPipe,retryDelay=5000}={}){
 let config=null,socket=null,status='setup',error=null,user=null,closed=false,retryTimer=null;
 let channel=null,guild=null,watched=null,loading=Promise.resolve();
 const members=new Map(),speaking=new Set(),voice={mute:false,deaf:false},guildNames=new Map(),pending=new Map();
 // Saved setup: { clientId, secret, tokens } with secrets encrypted by Windows (safeStorage).
 function load(){
  try{
   const saved=JSON.parse(fs.readFileSync(file,'utf8'));
   if(!SNOWFLAKE.test(saved.clientId)||!saved.secret)return null;
   const tokens=saved.tokens?JSON.parse(encryption.decryptString(Buffer.from(saved.tokens,'base64'))):null;
   return {clientId:saved.clientId,clientSecret:encryption.decryptString(Buffer.from(saved.secret,'base64')),tokens};
  }catch{return null;}
 }
 function save(){
  if(!config){try{fs.rmSync(file,{force:true});}catch{}return;}
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,JSON.stringify({version:1,clientId:config.clientId,secret:encryption.encryptString(config.clientSecret).toString('base64'),
   tokens:config.tokens?encryption.encryptString(JSON.stringify(config.tokens)).toString('base64'):null}),{mode:0o600});
 }
 function resetCall(){channel=null;guild=null;watched=null;members.clear();speaking.clear();}
 function schedule(){clearTimeout(retryTimer);if(!closed&&config&&status!=='error')retryTimer=setTimeout(()=>start(),retryDelay);}
 function request(cmd,args={},{evt,timeout=10000}={}){
  if(!socket)return Promise.reject(Error('Discord is not connected.'));
  const nonce=crypto.randomUUID();
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(nonce);reject(Error('Discord did not respond.'));},timeout);
   pending.set(nonce,{resolve,reject,timer});
   socket.write(encodeFrame(OP.FRAME,{cmd,args,nonce,...(evt?{evt}:{})}));
  });
 }
 async function exchange(params){
  const send=extra=>fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...params,...extra})});
  let response=await send({}),data=await response.json().catch(()=>({}));
  // Some applications require the registered redirect URI, even for desktop RPC codes.
  if(!response.ok&&params.grant_type==='authorization_code'&&/redirect/i.test(JSON.stringify(data))){
   response=await send({redirect_uri:'http://localhost'});data=await response.json().catch(()=>({}));
  }
  if(!response.ok){
   if(data.error==='invalid_client')throw Error('Discord rejected the Client ID or Client Secret.');
   if(/redirect/i.test(JSON.stringify(data)))throw Error('Add http://localhost as a Redirect on your Discord application’s OAuth2 page, then connect again.');
   throw Error(data.error_description||'Discord did not accept the sign-in.');
  }
  return {access:data.access_token,refresh:data.refresh_token,expiresAt:Date.now()+Number(data.expires_in||0)*1000};
 }
 async function login(allowAuthorize){
  let tokens=config.tokens;
  if(tokens?.refresh&&tokens.expiresAt<Date.now()+3600e3){
   try{tokens=await exchange({grant_type:'refresh_token',refresh_token:tokens.refresh});config.tokens=tokens;save();}catch{tokens=null;}
  }
  if(tokens?.access){
   try{return await request('AUTHENTICATE',{access_token:tokens.access});}
   catch{config.tokens=null;save();}
  }
  if(!allowAuthorize){status='authorize';error=null;return null;}
  status='authorizing';error=null;
  // Discord opens its own consent prompt in the desktop app; give the user time to answer.
  const {code}=await request('AUTHORIZE',{client_id:config.clientId,scopes:SCOPES},{timeout:180000});
  config.tokens=await exchange({grant_type:'authorization_code',code});save();
  return request('AUTHENTICATE',{access_token:config.tokens.access});
 }
 async function watch(id){
  if(watched===id)return;
  const previous=watched;watched=id;
  if(previous)for(const evt of CHANNEL_EVENTS)request('UNSUBSCRIBE',{channel_id:previous},{evt}).catch(()=>{});
  if(id)await Promise.all(CHANNEL_EVENTS.map(evt=>request('SUBSCRIBE',{channel_id:id},{evt})));
 }
 // The selected voice channel is re-read whenever Discord reports a channel change.
 function reloadChannel(){
  loading=loading.then(async()=>{
   const selected=await request('GET_SELECTED_VOICE_CHANNEL');
   members.clear();speaking.clear();
   if(!selected?.id){await watch(null);channel=null;guild=null;return;}
   await watch(selected.id);
   channel={id:String(selected.id),name:String(selected.name||'Voice call'),guildId:selected.guild_id?String(selected.guild_id):null};
   for(const entry of selected.voice_states||[])if(entry?.user?.id)members.set(String(entry.user.id),entry);
   guild=channel.guildId?guildNames.get(channel.guildId)||null:null;
   const guildId=channel.guildId;
   if(guildId&&!guild)request('GET_GUILD',{guild_id:guildId}).then(value=>{const name=value?.name?String(value.name):null;guildNames.set(guildId,name);if(channel?.guildId===guildId)guild=name;}).catch(()=>{});
  }).catch(e=>{if(socket)console.warn('Discord call could not be read:',e.message);});
  return loading;
 }
 function dispatch(message){
  const data=message.data||{};
  switch(message.evt){
   case 'VOICE_STATE_CREATE':case 'VOICE_STATE_UPDATE':if(data.user?.id)members.set(String(data.user.id),data);break;
   case 'VOICE_STATE_DELETE':if(data.user?.id){members.delete(String(data.user.id));speaking.delete(String(data.user.id));}break;
   case 'SPEAKING_START':if(data.user_id)speaking.add(String(data.user_id));break;
   case 'SPEAKING_STOP':if(data.user_id)speaking.delete(String(data.user_id));break;
   case 'VOICE_SETTINGS_UPDATE':if(typeof data.mute==='boolean')voice.mute=data.mute;if(typeof data.deaf==='boolean')voice.deaf=data.deaf;break;
   case 'VOICE_CHANNEL_SELECT':reloadChannel();break;
  }
 }
 async function ready(allowAuthorize){
  try{
   const auth=await login(allowAuthorize);
   if(!auth)return;
   user=auth.user||null;status='ready';error=null;
   await request('SUBSCRIBE',{},{evt:'VOICE_CHANNEL_SELECT'});
   await request('SUBSCRIBE',{},{evt:'VOICE_SETTINGS_UPDATE'});
   const settings=await request('GET_VOICE_SETTINGS');voice.mute=settings?.mute===true;voice.deaf=settings?.deaf===true;
   await reloadChannel();
  }catch(e){
   if(!socket)return;
   status=config.tokens?'offline':'authorize';error=/denied|cancel|closed/i.test(e.message)?'Discord authorization was declined.':e.message;
   if(status==='authorize')return;
   socket.destroy();
  }
 }
 async function start({authorize=false}={}){
  clearTimeout(retryTimer);
  if(closed||!config)return;
  if(socket){if(authorize&&status==='authorize')ready(true);return;}
  if(status!=='authorize'&&status!=='error')status='connecting';
  let pipe;
  try{pipe=await connect();}catch{status='offline';error=null;schedule();return;}
  if(closed||!config||socket){pipe.destroy();return;}
  socket=pipe;
  const reader=createFrameReader((op,data)=>{
   if(op===OP.PING){pipe.write(encodeFrame(OP.PONG,data));return;}
   if(op===OP.CLOSE){status='error';error=data?.message?`Discord: ${data.message}`:'Discord closed the connection.';pipe.destroy();return;}
   if(op!==OP.FRAME)return;
   if(data.cmd==='DISPATCH'&&data.evt==='READY'){ready(authorize);return;}
   if(data.cmd==='DISPATCH'){dispatch(data);return;}
   const request=data.nonce&&pending.get(data.nonce);
   if(!request)return;
   pending.delete(data.nonce);clearTimeout(request.timer);
   data.evt==='ERROR'?request.reject(Error(data.data?.message||'Discord refused the request.')):request.resolve(data.data);
  });
  pipe.on('data',chunk=>{try{reader(chunk);}catch(e){error=e.message;pipe.destroy();}});
  pipe.on('error',()=>{});
  pipe.on('close',()=>{
   if(socket!==pipe)return;
   socket=null;user=null;resetCall();
   for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Discord closed the connection.'));}
   pending.clear();
   if(status!=='error')status=config?'offline':'setup';
   schedule();
  });
  pipe.write(encodeFrame(OP.HANDSHAKE,{v:1,client_id:config.clientId}));
 }
 function disconnect(){clearTimeout(retryTimer);const current=socket;socket=null;current?.destroy();user=null;resetCall();for(const r of pending.values()){clearTimeout(r.timer);r.reject(Error('Disconnected.'));}pending.clear();}

 config=load();
 if(config)status='connecting';
 return {
  start,
  state(){
   const selfId=user?.id?String(user.id):null;
   const list=[...members.values()].map(entry=>presentMember(entry,{selfId,speaking})).sort((a,b)=>(b.you-a.you));
   return {
    configured:!!config,status,error,
    user:user?{id:String(user.id),name:String(user.global_name||user.username||''),avatar:avatarURL(user)}:null,
    voice:{mute:voice.mute||voice.deaf,deaf:voice.deaf},
    call:status==='ready'&&channel?{id:channel.id,name:channel.name,guild,members:list}:null
   };
  },
  // Island-only setup: secrets are typed on the PC and never come from the phone.
  async setup(value){
   const {clientId,clientSecret}=validateSetup(value);
   disconnect();
   config={clientId,clientSecret,tokens:config?.clientId===clientId?config.tokens:null};save();
   status='connecting';error=null;
   await start({authorize:true});
  },
  async reconnect(){if(!config)throw Error('Set up Discord first.');if(status==='error'){status='connecting';error=null;}if(socket&&status!=='authorize')disconnect();await start({authorize:true});},
  forget(){disconnect();config=null;save();status='setup';error=null;},
  async command(action,value){
   if(status!=='ready')throw Error(status==='offline'?'Open Discord on your PC.':'Discord is not connected on your PC.');
   const command=validateDiscordCommand(action,value,members);
   if(command.action==='mute'){await request('SET_VOICE_SETTINGS',{mute:command.value});voice.mute=command.value;return;}
   if(command.action==='deafen'){await request('SET_VOICE_SETTINGS',{deaf:command.value});voice.deaf=command.value;return;}
   if(command.action==='leave'){
    if(!channel)throw Error('You are not in a call.');
    await request('SELECT_VOICE_CHANNEL',{channel_id:null,force:true});return;
   }
   const entry=members.get(command.id);
   if(entry?.user?.id===user?.id)throw Error('Use Mute or Deafen for yourself.');
   if(command.action==='user-mute'){await request('SET_USER_VOICE_SETTINGS',{user_id:command.id,mute:command.muted});if(entry)entry.mute=command.muted;return;}
   await request('SET_USER_VOICE_SETTINGS',{user_id:command.id,volume:command.volume});if(entry)entry.volume=command.volume;
  },
  close(){closed=true;disconnect();}
 };
}
module.exports={createDiscord,encodeFrame,createFrameReader,avatarURL,presentMember,validateDiscordCommand,validateSetup,OP,SCOPES};
