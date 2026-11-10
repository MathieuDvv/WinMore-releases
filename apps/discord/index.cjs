// Discord package: call controls for the phone, setup in the island's settings panel.
const path=require('node:path');
const {createDiscord}=require('./discord.cjs');
const LABELS={setup:'Not set up',connecting:'Connecting…',offline:'Discord closed',authorize:'Needs approval',authorizing:'Approve in Discord',ready:'Connected',error:'Error'};
const TONES={ready:'good',error:'warn',authorize:'warn',authorizing:'warn'};
function activate(ctx){
  const discord=createDiscord({file:ctx.migrate('discord.json')||path.join(ctx.dataDir,'discord.json'),encryption:ctx.electron.safeStorage});
  discord.start();
  function describe(){
    const d=discord.state(),items=[];
    if(!d.configured){
      items.push(
        {type:'steps',items:['Create an application in the Discord Developer Portal.','On its OAuth2 page, add the redirect http://localhost.','Paste its Client ID and Client Secret, then approve WinMore in the Discord app.']},
        {type:'link',label:'Open the Developer Portal',url:'https://discord.com/developers/applications'},
        {type:'input',id:'clientId',label:'Client ID',placeholder:'Client ID'},
        {type:'input',id:'clientSecret',label:'Client Secret',placeholder:'Client Secret',secret:true},
        {type:'button',action:'connect',label:'Connect to Discord',primary:true}
      );
    }else{
      let detail={offline:'Open Discord on this PC. WinMore reconnects automatically.',connecting:'Looking for the Discord app on this PC…',authorize:'Choose Reconnect, then Authorize in the Discord window.',authorizing:'Discord is asking for permission. Choose Authorize in the Discord app.'}[d.status]||'';
      if(d.status==='ready'){const call=d.call;detail=(d.user?`Signed in as ${d.user.name}. `:'')+(call?`In ${call.name}${call.guild?' · '+call.guild:''} with ${call.members.length} ${call.members.length===1?'person':'people'}.`:'Not in a call. Join a voice channel and your iPhone shows the controls.');}
      if(d.error)detail=d.error+(detail?' '+detail:'');
      items.push({type:'text',text:detail},{type:'button',action:'reconnect',label:'Reconnect',primary:true},{type:'button',action:'forget',label:'Forget Discord'});
    }
    items.push({type:'note',text:'Uses the Discord app on this PC. Secrets stay encrypted on this PC.'});
    return {status:{label:LABELS[d.status]||d.status,tone:TONES[d.status]||null},items};
  }
  return {
    state:()=>({discord:discord.state()}),
    command:(action,value)=>discord.command(action,value),
    // Island-only settings: secrets are typed on the PC and never come from the phone.
    settings:{
      describe,
      async action(action,values={}){
        if(action==='connect')return discord.setup({clientId:String(values.clientId||''),clientSecret:String(values.clientSecret||'')});
        if(action==='reconnect')return discord.reconnect();
        if(action==='forget')return discord.forget();
        throw Error('Unknown Discord setting.');
      }
    },
    close(){discord.close();}
  };
}
module.exports={activate};
