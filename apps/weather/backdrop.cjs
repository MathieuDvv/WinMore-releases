// The existing phone renderers derive their edge-to-edge backdrop from image colors.
// A tiny opaque PNG supplies the sky palette without painting another background in the body.
const zlib=require('node:zlib');
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(name,data){
  const type=Buffer.from(name),body=Buffer.concat([type,data]);let crc=0xFFFFFFFF;
  for(const byte of body)crc=(crc>>>8)^crcTable[(crc^byte)&255];
  const size=Buffer.alloc(4),tail=Buffer.alloc(4);size.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xFFFFFFFF)>>>0);
  return Buffer.concat([size,body,tail]);
}
const cache=new Map();
function backdropFor(theme,sky){
  const colors=theme==='nothing'?['#303030','#262626','#202020']:sky||['#245B94','#4987BB','#8AB6D0'];
  const key=colors.join('|');if(cache.has(key))return cache.get(key);
  const header=Buffer.alloc(13);header.writeUInt32BE(6,0);header.writeUInt32BE(18,4);header[8]=8;header[9]=2;
  const rows=[];
  for(let y=0;y<18;y++){
    const hex=colors[Math.min(2,Math.floor(y/6))],color=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    rows.push(Buffer.from([0,...Array.from({length:6},()=>color).flat()]));
  }
  const png=Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
  const value='data:image/png;base64,'+png.toString('base64');cache.set(key,value);return value;
}
module.exports={backdropFor};
