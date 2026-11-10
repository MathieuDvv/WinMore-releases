const {createMixer}=require('./mixer.cjs');
function activate(ctx){
  const {app}=ctx.electron;
  const mixer=createMixer({iconFor:file=>app.getFileIcon(file,{size:'large'}).then(icon=>icon.isEmpty()?null:icon.toDataURL())});
  return {
    state:async context=>({mixer:context.view==='mixer'?await mixer.read():null}),
    command:(action,value)=>mixer.command(action,value),
    close(){mixer.close();}
  };
}
module.exports={activate};
