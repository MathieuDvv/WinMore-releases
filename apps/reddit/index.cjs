const {createReddit,createRedditPages}=require('./reddit.cjs');
const {createRedgifs}=require('./redgifs.cjs');
// The phone draws ui/screen.json with WinMore's native components; data() feeds it and
// command() receives its actions. Changing either file updates the iPhone without a rebuild.
function activate(ctx){
  const pages=createRedditPages({BrowserWindow:ctx.electron.BrowserWindow,isQuitting:ctx.isQuitting});
  const reddit=createReddit({pages,historyFile:ctx.migrate('reddit-history.json'),redgifs:createRedgifs()});
  return {
    data:()=>reddit.data(),
    command:(action,value)=>reddit.command(action,value),
    close:()=>pages.close()
  };
}
module.exports={activate};
