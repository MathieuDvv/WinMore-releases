const fs=require('node:fs');
const path=require('node:path');
const {backdropFor}=require('./backdrop.cjs');
const REFRESH_MS=15*60*1000,RETRY_MS=60*1000,MAX_PLACES=8;
const DEFAULT_PLACE={id:'48.85341,2.3488',name:'Paris',region:'Île-de-France',country:'France',latitude:48.85341,longitude:2.3488};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clean=(v,max=100)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').trim().slice(0,max):'';
const round=v=>finite(v)?String(Math.round(v)):'—';
const pct=v=>finite(v)?`${Math.round(Math.max(0,Math.min(100,v)))}%`:'—';
const themedImages=art=>({appleImage:`assets/apple-${art}.png`,nothingImage:`assets/nothing-${art}.png`});
function place(raw){
  if(!raw||!finite(raw.latitude)||Math.abs(raw.latitude)>90||!finite(raw.longitude)||Math.abs(raw.longitude)>180||!clean(raw.name))throw Error('Choose a city from the search results.');
  const latitude=Number(raw.latitude.toFixed(5)),longitude=Number(raw.longitude.toFixed(5));
  return {id:`${latitude},${longitude}`,name:clean(raw.name),region:clean(raw.region||raw.admin1),country:clean(raw.country),latitude,longitude};
}
function condition(code,isDay=true){
  if(code===0||code===1)return {label:code===0?(isDay?'Clear sky':'Clear night'):'Mostly clear',art:isDay?'sun':'moon'};
  if(code===2)return {label:'Partly cloudy',art:isDay?'partly-cloudy':'night-cloudy'};
  if(code===3)return {label:'Overcast',art:'cloud'};
  if([45,48].includes(code))return {label:'Foggy',art:'fog'};
  if([51,53,55].includes(code))return {label:'Drizzle',art:'rain'};
  if([56,57,66,67].includes(code))return {label:'Freezing rain',art:'rain'};
  if([61,63,65].includes(code))return {label:code===65?'Heavy rain':'Rain',art:'rain'};
  if([71,73,75,77,85,86].includes(code))return {label:'Snow',art:'snow'};
  if([80,81,82].includes(code))return {label:'Rain showers',art:'rain'};
  if([95,96,97,99].includes(code))return {label:'Thunderstorms',art:'storm'};
  return {label:'Conditions unavailable',art:'cloud'};
}
// A continuous sky palette, chosen from the observed conditions and the local sun times.
function appearance(raw){
  const c=raw.current,w=condition(c.weather_code,c.is_day!==0),night=c.is_day===0;
  const palettes={
    clear:['#245B94','#4987BB','#8AB6D0'],
    cloud:['#3B526B','#687E91','#9AAAB4'],
    fog:['#4F6578','#8497A6','#B1BDC4'],
    rain:['#1B3049','#405A70','#748B9A'],
    storm:['#171E32','#354156','#616D7C'],
    snow:['#435F7C','#829AAD','#B3C3CF'],
    night:['#080F25','#192D4F','#354D6B'],
    'night-cloud':['#111D30','#2C4057','#4A6074'],
    dawn:['#3F517D','#9F829B','#D9AF9E'],
    dusk:['#303B68','#8E6F8B','#CF9F93']
  };
  let kind=night?(['cloud','fog','rain','snow','storm'].includes(w.art)?'night-cloud':'night'):['cloud','fog','rain','snow','storm'].includes(w.art)?w.art:'clear';
  if(['sun','moon','partly-cloudy','night-cloudy'].includes(w.art)){
    for(const [key,name] of [['sunrise','dawn'],['sunset','dusk']]){
      if(raw.daily?.[key]?.some(t=>finite(t)&&Math.abs(t-c.time)<45*60)){kind=name;break;}
    }
  }
  return {kind,gradient:palettes[kind],panel:night?'#08132255':'#122D4938',muted:'#FFFFFFB8',
    atmosphere:`assets/sky-${kind}.png`};
}
function forecastURL(p){
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.search=new URLSearchParams({latitude:p.latitude,longitude:p.longitude,timezone:'auto',timeformat:'unixtime',forecast_days:7,
    current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m',
    hourly:'temperature_2m,precipitation_probability,weather_code,is_day',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max',
    temperature_unit:'celsius',wind_speed_unit:'kmh'}).toString();
  return url.toString();
}
function validateForecast(raw){
  if(!raw||!finite(raw.current?.time)||!finite(raw.current.temperature_2m)||!Array.isArray(raw.hourly?.time)||!raw.hourly.time.length||!Array.isArray(raw.daily?.time)||!raw.daily.time.length)throw Error('The weather service returned incomplete data. Try again shortly.');
  try{new Intl.DateTimeFormat('en',{timeZone:raw.timezone});}catch{throw Error('The weather service returned an invalid time zone.');}
  if(typeof raw.timezone!=='string')throw Error('The weather service returned no time zone.');
  for(const [block,keys] of [[raw.hourly,['temperature_2m','precipitation_probability','weather_code','is_day']],[raw.daily,['weather_code','temperature_2m_max','temperature_2m_min','sunrise','sunset','uv_index_max','precipitation_probability_max','wind_speed_10m_max']]]){
    if(block.time.length>200||!block.time.every(finite))throw Error('The weather service returned invalid forecast times.');
    for(const key of keys)if(!Array.isArray(block[key])||block[key].length!==block.time.length||!block[key].every(v=>v===null||finite(v)))throw Error('The weather service returned incomplete forecast data.');
  }
  return raw;
}
function viewForecast(entry,unit,now){
  const raw=entry.raw,c=raw.current,h=raw.hourly,d=raw.daily,tz=raw.timezone;
  const date=(sec,options)=>finite(sec)?new Intl.DateTimeFormat('en-GB',{timeZone:tz,...options}).format(new Date(sec*1000)):'—';
  const dayKey=sec=>date(sec,{year:'numeric',month:'2-digit',day:'2-digit'});
  const tempValue=v=>finite(v)?unit==='fahrenheit'?v*9/5+32:v:null;
  const temp=v=>`${round(tempValue(v))}°`;
  const wind=v=>finite(v)?`${round(unit==='fahrenheit'?v/1.609344:v)} ${unit==='fahrenheit'?'mph':'km/h'}`:'—';
  const nowSec=now/1000,today=dayKey(nowSec),art=condition(c.weather_code,c.is_day!==0);
  const bounds=[...d.temperature_2m_min,...d.temperature_2m_max].filter(finite),rangeMin=bounds.length?Math.min(...bounds):0,rangeMax=bounds.length?Math.max(...bounds):1;
  const rangeTotal=Math.max(1,rangeMax-rangeMin);
  const rangeColor=t=>t<0?'#85CFF4':t<10?'#A6DDE5':t<20?'#E6D99B':t<28?'#F2BC78':'#F49A83';
  const days=d.time.map((sec,i)=>{const w=condition(d.weather_code[i]);return {
    id:String(sec),name:dayKey(sec)===today?'Today':date(sec,{weekday:'short'}),date:date(sec,{weekday:'long',day:'numeric',month:'long'}),
    condition:w.label,image:`assets/${w.art}.png`,...themedImages(w.art),low:temp(d.temperature_2m_min[i]),high:temp(d.temperature_2m_max[i]),
    rain:pct(d.precipitation_probability_max[i]),wind:wind(d.wind_speed_10m_max[i]),uv:round(d.uv_index_max[i]),
    hasRange:finite(d.temperature_2m_min[i])&&finite(d.temperature_2m_max[i]),
    rangeStart:finite(d.temperature_2m_min[i])?(d.temperature_2m_min[i]-rangeMin)/rangeTotal:0,
    rangeSpan:finite(d.temperature_2m_min[i])&&finite(d.temperature_2m_max[i])?Math.max(0.035,(d.temperature_2m_max[i]-d.temperature_2m_min[i])/rangeTotal):0,
    rangeColors:[rangeColor(d.temperature_2m_min[i]),rangeColor(d.temperature_2m_max[i])],
    sunrise:date(d.sunrise[i],{hour:'2-digit',minute:'2-digit'}),sunset:date(d.sunset[i],{hour:'2-digit',minute:'2-digit'})};});
  const todayIndex=d.time.findIndex(sec=>dayKey(sec)===today),di=todayIndex<0?0:todayIndex;
  // Compare absolute times, then format in the city's zone. This also handles DST and travel.
  let start=h.time.findIndex(sec=>sec>nowSec);if(start<0)start=h.time.length;
  const hours=h.time.slice(start,start+24).map((sec,j)=>{const i=start+j,w=condition(h.weather_code[i],h.is_day[i]!==0);return {
    id:String(sec),time:date(sec,{hour:'2-digit',minute:'2-digit'}),temperature:temp(h.temperature_2m[i]),
    value:tempValue(h.temperature_2m[i]),rain:pct(h.precipitation_probability[i]),rainVisible:finite(h.precipitation_probability[i])&&h.precipitation_probability[i]>=20,image:`assets/${w.art}.png`,...themedImages(w.art),condition:w.label};});
  const currentHour=h.time.findLastIndex(sec=>sec<=nowSec);
  const rainIndex=hours.findIndex(x=>parseInt(x.rain,10)>=40);
  const rainNote=rainIndex>=0?`Rain possible around ${hours[rainIndex].time}.`:'Low rain chance over the next 24 hours.';
  const updated=date(entry.at/1000,{hour:'2-digit',minute:'2-digit'});
  const sameDay=dayKey(entry.at/1000)===today;
  const direction=finite(c.wind_direction_10m)?['N','NE','E','SE','S','SW','W','NW'][Math.round(c.wind_direction_10m/45)%8]:'';
  const timeline=[{id:'now',time:'Now',temperature:temp(c.temperature_2m),image:`assets/${art.art}.png`,...themedImages(art.art),condition:art.label,rain:pct(currentHour<0?null:h.precipitation_probability[currentHour]),rainVisible:currentHour>=0&&h.precipitation_probability[currentHour]>=20},...hours.slice(0,23)];
  return {temperature:temp(c.temperature_2m),feelsLike:temp(c.apparent_temperature),condition:art.label,image:`assets/${art.art}.png`,matrix:`assets/matrix-${art.art}.png`,...themedImages(art.art),
    ...appearance(raw),timeline,
    date:date(nowSec,{weekday:'long',day:'numeric',month:'long'}),localTime:date(nowSec,{hour:'2-digit',minute:'2-digit'}),timezone:tz,
    high:todayIndex<0?'—':temp(d.temperature_2m_max[di]),low:todayIndex<0?'—':temp(d.temperature_2m_min[di]),
    summary:hours.length?rainNote:'Refresh to see the latest hourly forecast.',hours,days:days.filter((_,i)=>dayKey(d.time[i])===today||d.time[i]>nowSec),
    chart:hours.filter(x=>finite(x.value)).map(x=>x.value),wind:wind(c.wind_speed_10m),windDirection:direction,humidity:pct(c.relative_humidity_2m),
    rain:pct(currentHour<0?null:h.precipitation_probability[currentHour]),
    sunrise:todayIndex<0?'—':date(d.sunrise[di],{hour:'2-digit',minute:'2-digit'}),sunset:todayIndex<0?'—':date(d.sunset[di],{hour:'2-digit',minute:'2-digit'}),
    uv:todayIndex<0?'—':round(d.uv_index_max[di]),unit:unit==='fahrenheit'?'°F':'°C',
    updated:`Updated ${sameDay?'':date(entry.at/1000,{day:'numeric',month:'short'})+' · '}${updated} · ${tz.replace(/_/g,' ')}`,
    stale:now-entry.at>REFRESH_MS,observation:`Conditions at ${date(c.time,{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}`};
}
function createWeather({dataDir,fetch:fetcher=globalThis.fetch,now=Date.now,log=console}={}){
  let closed=false,places=[{...DEFAULT_PLACE}],selected=DEFAULT_PLACE.id,unit='celsius',theme='apple',error='',persistenceError='';
  const cache=new Map(),pending=new Map(),attempts=new Map(),controllers=new Set();
  let desktopResults=[],desktopSearching=false,desktopError='',desktopSearchVersion=0;
  const stateFile=dataDir&&path.join(dataDir,'weather.json');
  function save(){
    if(closed||!stateFile)return;
    try{fs.mkdirSync(dataDir,{recursive:true});const temp=stateFile+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:1,places,selected,unit,theme,cache:Object.fromEntries(cache)}));fs.renameSync(temp,stateFile);persistenceError='';}
    catch(e){persistenceError='Your preferences could not be saved. Check available disk space.';log?.warn?.('Weather preferences:',e.message);}
  }
  try{
    if(stateFile&&fs.existsSync(stateFile)){
      const saved=JSON.parse(fs.readFileSync(stateFile,'utf8'));
      const valid=(Array.isArray(saved.places)?saved.places:[]).slice(0,MAX_PLACES).flatMap(p=>{try{return [place(p)];}catch{return [];}});
      if(valid.length){places=valid;selected=places.some(p=>p.id===saved.selected)?saved.selected:places[0].id;}
      if(saved.unit==='fahrenheit')unit='fahrenheit';
      if(saved.theme==='nothing')theme='nothing';
      for(const p of places){const entry=saved.cache?.[p.id];if(entry&&finite(entry.at)&&entry.at<=now()+60000){try{cache.set(p.id,{raw:validateForecast(entry.raw),at:entry.at});}catch{}}}
    }
  }catch(e){log?.warn?.('Weather could not read saved preferences:',e.message);}
  async function json(url){
    const controller=new AbortController();controllers.add(controller);
    const timeout=setTimeout(()=>controller.abort(),12000);timeout.unref?.();
    try{
      const response=await fetcher(url,{signal:controller.signal});
      if(!response.ok)throw Error(response.status===429?'Weather is busy. Please wait a minute and try again.':'Weather could not connect. Check your PC’s internet connection and try again.');
      const raw=await response.json();if(raw.error)throw Error('The weather service could not complete this request.');return raw;
    }catch(e){if(e.name==='AbortError')throw Error('Weather took too long to respond. Please try again.');if(e instanceof TypeError)throw Error('Weather could not connect. Check your PC’s internet connection and try again.');throw e;}
    finally{clearTimeout(timeout);controllers.delete(controller);}
  }
  function refresh(force=false){
    const p=places.find(p=>p.id===selected),id=p.id,entry=cache.get(id);
    if(closed)return;
    if(pending.has(id))return pending.get(id);
    if(!force&&((entry&&now()-entry.at<REFRESH_MS)||(attempts.has(id)&&now()-attempts.get(id)<RETRY_MS)))return;
    attempts.set(id,now());if(id===selected)error='';
    const work=json(forecastURL(p)).then(raw=>{
      if(closed||!places.some(p=>p.id===id))return;
      cache.set(id,{raw:validateForecast(raw),at:now()});if(selected===id)error='';save();
    }).catch(e=>{if(!closed&&selected===id)error=e.message;}).finally(()=>pending.delete(id));
    pending.set(id,work);return work;
  }
  async function search(query){
    const q=clean(query,120);if(q.length<2)throw Error('Enter at least two letters of a city or a postal code.');
    const url=new URL('https://geocoding-api.open-meteo.com/v1/search');url.search=new URLSearchParams({name:q,count:8,language:'en',format:'json'}).toString();
    const raw=await json(url.toString());
    return (Array.isArray(raw.results)?raw.results:[]).slice(0,8).flatMap(p=>{try{const v=place(p);return [{...v,detail:[v.region,v.country].filter(Boolean).join(', ')}];}catch{return [];}});
  }
  function select(id){if(!places.some(p=>p.id===id))throw Error('That city is no longer saved.');selected=id;error='';save();refresh();}
  function add(raw){
    const p=place(raw);if(!places.some(v=>v.id===p.id)){if(places.length>=MAX_PLACES)throw Error('You can save up to eight cities. Remove one before adding another.');places.push(p);}
    select(p.id);
  }
  function data(){
    refresh();const p=places.find(p=>p.id===selected),entry=cache.get(selected),weather=entry?viewForecast(entry,unit,now()):null;
    return {place:p,places:places.map(v=>({...v,detail:[v.region,v.country].filter(Boolean).join(', '),selected:v.id===selected})),
      unit,theme,backdrop:backdropFor(theme,weather?.gradient),loading:pending.has(selected),hasWeather:!!weather,weather,error,notice:persistenceError,
      status:pending.has(selected)?'Updating weather…':error?(weather?'Offline · showing saved weather':'Weather unavailable'):weather?.stale?'Saved forecast · refresh to update':'Forecast by Open-Meteo',canRemove:places.length>1};
  }
  function command(action,value){
    if(closed)throw Error('Weather has closed. Reopen the app.');
    switch(action){
      case 'refresh':refresh(true);return null;
      case 'search':return search(value);
      case 'add':add(value);return null;
      case 'select':select(value);return null;
      case 'unit':if(!['celsius','fahrenheit'].includes(value))throw Error('Choose Celsius or Fahrenheit.');unit=value;save();return null;
      case 'theme':if(!['apple','nothing'].includes(value))throw Error('Choose Apple or Nothing.');theme=value;save();return null;
      case 'remove':{
        if(places.length===1)throw Error('Keep at least one saved city.');
        if(!places.some(p=>p.id===value))throw Error('That city is no longer saved.');
        places=places.filter(p=>p.id!==value);cache.delete(value);attempts.delete(value);
        if(selected===value)selected=places[0].id;error='';save();refresh();return null;
      }
      default:throw Error('Unknown weather action.');
    }
  }
  return {data,command,close(){closed=true;for(const c of controllers)c.abort();},
    settings:{
      describe(){const d=data();return {status:{label:d.loading?'Updating':d.error?'Offline':d.hasWeather?`${d.weather.temperature} · ${d.place.name}`:'Choose a city',tone:d.error?'warning':null},items:[
        {type:'text',text:'Your weather, at a glance. Search for a city here or on your phone.'},
        {type:'note',text:`Current city: ${d.place.name}, ${d.place.country}. Paris is the starting city; no location permission is needed.`},
        {type:'input',id:'query',label:'City or postal code',placeholder:'e.g. Lyon or 75001'},
        {type:'button',label:desktopSearching?'Searching…':'Search cities',action:'search'},
        ...(desktopError?[{type:'note',text:desktopError}]:[]),
        ...desktopResults.map(p=>({type:'button',label:`Use ${p.name} · ${p.detail}`,action:'pick-'+p.id})),
        {type:'toggle',label:'Use Fahrenheit',detail:'Also uses mph for wind speed.',value:unit==='fahrenheit',action:'fahrenheit'},
        {type:'toggle',label:'Use Nothing theme',detail:'Monochrome layout with large dot illustrations. Off selects Apple.',value:theme==='nothing',action:'nothing-theme'},
        {type:'button',label:'Refresh weather',action:'refresh'},
        ...(d.error?[{type:'note',text:d.error}]:[]),...(persistenceError?[{type:'note',text:persistenceError}]:[]),
        {type:'link',label:'Weather data by Open-Meteo',url:'https://open-meteo.com/'},
        {type:'note',text:'City search: GeoNames via Open-Meteo. Free API for personal, non-commercial use. Weather refreshes every 15 minutes while open. Saved weather remains available offline.'}
      ]};},
      action(action,values={}){
        if(action==='search'){
          const version=++desktopSearchVersion;desktopSearching=true;desktopError='';desktopResults=[];
          search(values.query).then(r=>{if(!closed&&version===desktopSearchVersion){desktopResults=r;desktopError=r.length?'':'No cities found. Try a nearby city or postal code.';}}).catch(e=>{if(!closed&&version===desktopSearchVersion)desktopError=e.message;}).finally(()=>{if(version===desktopSearchVersion)desktopSearching=false;});return;
        }
        if(action.startsWith('pick-')){const p=desktopResults.find(p=>'pick-'+p.id===action);if(!p)throw Error('Search for that city again.');add(p);desktopResults=[];return;}
        if(action==='fahrenheit')return command('unit',values.on?'fahrenheit':'celsius');
        if(action==='nothing-theme')return command('theme',values.on?'nothing':'apple');
        return command(action);
      }
    }
  };
}
module.exports={createWeather,place,condition,appearance,forecastURL,validateForecast,viewForecast,REFRESH_MS};
