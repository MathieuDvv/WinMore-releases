// Clipboard contents stay in memory and are returned only to the clipboard screen.
const MAX_IMAGE=2*1024*1024, MAX_TEXT=16000;
function activate(ctx){
 const {clipboard,nativeImage}=ctx.electron;
 let incoming=null,expiryTimer=null;
 function active(){if(incoming&&incoming.expiresAt<=Date.now())incoming=null;return incoming;}
 function pc(){
  const image=clipboard.readImage();
  if(!image.isEmpty()){
   const png=image.toPNG();
   return png.length<=MAX_IMAGE?{kind:'image',data:'data:image/png;base64,'+png.toString('base64')}:{error:'PC image is larger than 2 MB. Copy a smaller image.'};
  }
  const text=clipboard.readText();
  return text.length<=MAX_TEXT?{kind:'text',data:text}:{error:'PC text is longer than 16,000 characters.'};
 }
 return {
  // Read only while the Clipboard screen is open (ui/screen.json), never sent anywhere else.
  data:()=>({pc:pc()}),
  command(action,value){
   if(action==='send'){
    if(!value||!['text','image'].includes(value.kind)||typeof value.data!=='string')throw Error('Invalid clipboard content.');
    if(value.kind==='text'&&(!value.data.length||value.data.length>MAX_TEXT))throw Error('Text must contain 1–16,000 characters.');
    if(value.kind==='image'){
     if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value.data)||value.data.length>Math.ceil(MAX_IMAGE/3)*4+30)throw Error('Use a PNG image smaller than 2 MB.');
     const image=nativeImage.createFromDataURL(value.data);
     if(image.isEmpty()||image.getSize().width*image.getSize().height>16000000)throw Error('Image is invalid or too large.');
    }
    clearTimeout(expiryTimer);
    incoming={kind:value.kind,data:value.data,id:require('node:crypto').randomUUID(),expiresAt:Date.now()+30000};
    ctx.island.present({...incoming,title:'From iPhone',action:'copy',dismissAction:'dismiss'});
    expiryTimer=setTimeout(()=>{clearTimeout(expiryTimer);incoming=null;ctx.island.dismiss();},30000);expiryTimer.unref?.();return;
   }
   if(action==='dismiss'){clearTimeout(expiryTimer);incoming=null;ctx.island.dismiss();return;}
   if(action==='copy'){
    const item=active();if(!item||value!==item.id)throw Error('Clipboard item expired.');
    if(item.kind==='image')clipboard.writeImage(nativeImage.createFromDataURL(item.data));else clipboard.writeText(item.data);
    clearTimeout(expiryTimer);incoming=null;ctx.island.dismiss();return;
   }
   throw Error('Unknown clipboard command.');
  },
  close(){clearTimeout(expiryTimer);incoming=null;ctx.island.dismiss();}
 };
}
module.exports={activate};
