const {createWeather}=require('./weather.cjs');

function activate(ctx){
  return createWeather({
    dataDir:ctx.dataDir,
    fetch:ctx.electron?.net?.fetch?.bind(ctx.electron.net)||globalThis.fetch,
    log:ctx.log
  });
}
module.exports={activate};
