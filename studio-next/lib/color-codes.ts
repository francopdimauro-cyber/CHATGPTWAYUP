/** WayUp Studio: parser de colores sólidos para el Inspector.
 * Solo acepta HEX y RGB(A) de valores reales, nunca expresiones CSS arbitrarias.
 * El documento puede contener degradados anteriores: se muestran y se preservan.
 */
const byte=(v:string):number|null=>{
  if(!/^\d{1,3}$/.test(v.trim()))return null;
  const n=Number(v);return n>=0&&n<=255?n:null;
};
export function parseColorCode(value:string):string|null {
  const v=value.trim();
  if(v.length>64)return null;
  if(/^#[\da-f]{3}$/i.test(v))return '#'+[...v.slice(1)].map(c=>c+c).join('').toUpperCase();
  if(/^#[\da-f]{6}$/i.test(v))return v.toUpperCase();
  if(/^#[\da-f]{8}$/i.test(v))return v.toUpperCase();
  if(v.toLowerCase()==='transparent')return 'transparent';
  const match=v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d{1,3}))?\s*\)$/i);
  if(!match)return null;
  const red=byte(match[1]),green=byte(match[2]),blue=byte(match[3]);
  if(red===null||green===null||blue===null)return null;
  if(match[4]!==undefined){
    const alpha=Number(match[4]);if(!Number.isFinite(alpha)||alpha<0||alpha>1)return null;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return `rgb(${red}, ${green}, ${blue})`;
}
export function colorAsRgb(v:string):string|null {
  const result=parseColorCode(v);
  if(!result)return null;
  if(result.startsWith('rgb'))return result;
  if(result==='transparent')return null;
  const hex=result.slice(1);
  const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return hex.length===8?`rgba(${r}, ${g}, ${b}, ${Number((parseInt(hex.slice(6,8),16)/255).toFixed(3))})`:`rgb(${r}, ${g}, ${b})`;
}
