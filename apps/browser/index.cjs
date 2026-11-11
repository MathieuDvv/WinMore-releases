// A PC browser window the phone drives through screenshots, clicks and typing. ui/screen.json draws it.
const safeURL=value=>{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error('Use an http or https address.');return u.href;};
// What you type in the address bar: a full address, a bare domain, or a search.
function addressURL(raw){
  const value=String(raw??'').trim();
  if(!value)throw Error('Enter a website or a search.');
  if(/^[a-z][a-z0-9+.-]*:\/\//i.test(value))return safeURL(value);
  if(!/\s/.test(value)&&(/^[^/]+\.[a-z]{2,}(\/|$|:)/i.test(value)||/^[^/.:]+:\d{1,5}(\/|$)/.test(value)))return safeURL('https://'+value);
  return 'https://www.google.com/search?q='+encodeURIComponent(value);
}
function activate(ctx){
  const browser=new ctx.electron.BrowserWindow({show:false,width:1200,height:760,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  browser.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  browser.on('close',event=>{if(!ctx.isQuitting()){event.preventDefault();browser.hide();}});
  return {
    // Only asked for while the Browser screen is open, so screenshots are taken only then.
    async data(){
      let image=null;
      if(browser.webContents.getURL())try{image=(await browser.webContents.capturePage()).resize({width:1000}).toDataURL();}catch{}
      return {url:browser.webContents.getURL(),title:browser.webContents.getTitle(),image,canGoBack:browser.webContents.navigationHistory.canGoBack()};
    },
    async command(action,value){
      if(action==='navigate'){await browser.loadURL(addressURL(value));return;}
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
module.exports={activate,safeURL,addressURL};
