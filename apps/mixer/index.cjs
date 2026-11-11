const {createMixer}=require('./mixer.cjs');
// Windows volume mixer: the default output plus every app playing sound. ui/screen.json draws it.
function activate(ctx){
  const {app}=ctx.electron;
  const mixer=createMixer({iconFor:file=>app.getFileIcon(file,{size:'large'}).then(icon=>icon.isEmpty()?null:icon.toDataURL())});
  return {
    data:()=>mixer.read(),
    command:(action,value)=>mixer.command(action,value),
    close(){mixer.close();}
  };
}
module.exports={activate};
