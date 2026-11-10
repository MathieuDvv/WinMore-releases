// Anonymous Twitch chat reader (read-only IRC over WebSocket).
function activate(){
  const chat=[];let socket,channel='',connected=false;
  function join(value){
    if(!/^[a-zA-Z0-9_]{1,25}$/.test(value))throw Error('Enter a Twitch channel name, without a URL.');
    channel=value.toLowerCase();chat.length=0;connected=false;
    socket?.close();
    const current=new WebSocket('wss://irc-ws.chat.twitch.tv:443');socket=current;
    current.onopen=()=>{current.send('NICK justinfan'+Math.floor(Math.random()*90000+10000));current.send('JOIN #'+channel);};
    current.onmessage=event=>{if(current!==socket)return;for(const line of event.data.split('\r\n')){
      if(line.startsWith('PING'))current.send(line.replace('PING','PONG'));
      if(line.includes(' 366 '))connected=true;
      const m=line.match(/^:([^!]+)!.* PRIVMSG #[^ ]+ :(.*)$/);if(m){chat.push({user:m[1],text:m[2]});if(chat.length>80)chat.shift();}
    }};
    current.onclose=current.onerror=()=>{if(current===socket)connected=false;};
  }
  return {
    state:()=>({chat,channel,chatConnected:connected}),
    command(action,value){if(action==='join')return join(String(value));throw Error('Unknown chat command');},
    close(){socket?.close();}
  };
}
module.exports={activate};
