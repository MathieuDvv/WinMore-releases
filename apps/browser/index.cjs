// A PC browser window the phone drives through screenshots, clicks and typing.
const safeURL=value=>{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error('Use an http or https address.');return u.href;};
function activate(ctx){
  const browser=new ctx.electron.BrowserWindow({show:false,width:1200,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  browser.on('close',event=>{if(!ctx.isQuitting()){event.preventDefault();browser.hide();}});
  return {
    async state(context){
      let image=null;
      if(context.view==='browser'&&browser.webContents.getURL())try{image=(await browser.webContents.capturePage()).resize({width:1000}).toDataURL();}catch{}
      return {browser:{url:browser.webContents.getURL(),image}};
    },
    async command(action,value){
      if(action==='navigate'){await browser.loadURL(safeURL(value));return;}
      if(action==='setup'){browser.show();return;}
      if(action==='back'){if(browser.webContents.navigationHistory.canGoBack())browser.webContents.navigationHistory.goBack();return;}
      if(action==='click'){
        if(!value||![value.x,value.y].every(n=>typeof n==='number'&&n>=0&&n<=1))throw Error('Invalid position');
        const [w,h]=browser.getContentSize();const event={x:Math.round(value.x*w),y:Math.round(value.y*h),button:'left',clickCount:1};
        browser.webContents.sendInputEvent({type:'mouseDown',...event});browser.webContents.sendInputEvent({type:'mouseUp',...event});return;
      }
      if(action==='type'){browser.webContents.insertText(String(value).slice(0,2000));return;}
      if(action==='scroll'){browser.webContents.sendInputEvent({type:'mouseWheel',x:400,y:300,deltaY:value==='up'?500:-500,deltaX:0});return;}
      throw Error('Unknown browser command');
    },
    close(){if(!browser.isDestroyed())browser.destroy();}
  };
}
module.exports={activate,safeURL};
