export const runtime='edge';
function cors(h=new Headers()){h.set('access-control-allow-origin','*');h.set('access-control-allow-methods','GET, POST, OPTIONS');h.set('access-control-allow-headers','*');return h;}
const DEFAULT_DOH='cloudflare-dns.com';
const JSON_HEADERS={'accept':'application/dns-json','user-agent':'HongShi-DoH/edge'} as const;
const ASN_MAP = new Map<number,string>([[13335,'Cloudflare'],[4134,'中国电信'],[4808,'中国联通'],[9808,'中国移动'],[16509,'亚马逊云'],[15169,'谷歌云']]);
function provinceMatch(s?:string){const arr=['内蒙古','黑龙江','河北','山西','吉林','辽宁','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','广西','西藏','宁夏','新疆','北京','天津','上海','重庆'];return s?arr.find(i=>s.includes(i))||'':'';}
const dohHost=(process.env.DOH||DEFAULT_DOH).replace(/^https?:\/\//,'').split('/')[0];
const buildAddr=(ip:string,mask:number)=>{try{const a=ip.split('.').map(x=>parseInt(x));if(a.length!==4)return ip;const m=(0xffffffff<<(32-mask))>>>0;const v=((a[0]<<24)|(a[1]<<16)|(a[2]<<8)|a[3])>>>0;const n=v&m;return `${(n>>>24)&255}.${(n>>>16)&255}.${(n>>>8)&255}.${n&255}/${mask}`;}catch{return ip;}};
async function enrichFromIpApi(ip:string){const r=await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`,{headers:{'user-agent':'HongShi-DoH/edge'}}); if(!r.ok) return null; const j:any=await r.json(); const asnNum = parseInt(String(j.asn||'').replace(/[^\d]/g,''))||undefined; return {
  ip, addr: buildAddr(ip,24),
  as: asnNum?{number: asnNum, name: j.org||undefined, info: (ASN_MAP.get(asnNum)||j.org||undefined)}:undefined,
  country: j.country?{code:j.country, name:j.country_name}:undefined,
  regions: [provinceMatch(j.region)||j.region, j.city].filter(Boolean),
  location: (j.latitude||j.longitude)?{latitude:j.latitude, longitude:j.longitude}:undefined,
  timezone: j.timezone||undefined,
  source:{platform:'vercel', provider:'ipapi', enriched:true}
};}
function urlGoogle(host:string,name:string,type:string){const u=new URL(`https://${host}/resolve`);u.searchParams.set('name',name);u.searchParams.set('type',type);return u.toString();}
function urlCf(host:string,name:string,type:string){const u=new URL(`https://${host}/dns-query`);u.searchParams.set('name',name);u.searchParams.set('type',type);u.searchParams.set('ct','application/dns-json');return u.toString();}
function urlListForHost(host:string,name:string,type:string){const h=host.toLowerCase(); const arr:string[]=[]; if(h.includes('dns.google')) arr.push(urlGoogle(host,name,type), urlCf(host,name,type)); else if(h.includes('cloudflare')) arr.push(urlCf(host,name,type), urlGoogle('1.1.1.1',name,type)); else arr.push(urlCf(host,name,type), urlGoogle(host,name,type)); return arr;}
async function fetchJsonChain(urls:string[]){let last:any=null; for(const u of urls){try{const r=await fetch(u,{headers:JSON_HEADERS, redirect:'follow'}); const t=await r.text(); if(r.ok) return {ok:true,text:t}; last=t||r.statusText;}catch(e:any){last=String(e);} } return {ok:false,err:last};}

export async function GET(req: Request){
  const url=new URL(req.url); const path=url.pathname;
  if(path==='/'){return new Response('<!doctype html><meta charset=\"utf-8\"><title>HongShi-DoH</title><p>主页可用。前往 <a href=\"/ui/\">UI</a></p>',{headers:{'content-type':'text/html; charset=utf-8'}})}
  if(path==='/meta'){const dohPath=process.env.DOH_PATH||process.env.HSD_PATH||process.env.TOKEN||'dns-query';const dnsQueryEnabled=dohPath==='dns-query';return new Response(JSON.stringify({dohPath,dnsQueryEnabled},null,2),{headers:cors(new Headers({'content-type':'application/json'}))})}
  if(path==='/host'){const hostname=process.env.HOSTNAME||undefined;const region=process.env.VERCEL_REGION||undefined;return new Response(JSON.stringify({platform:'vercel',hostname,region},null,2),{headers:cors(new Headers({'content-type':'application/json'}))})}
  if(path==='/ip'){const ip=(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'0.0.0.0'); let base:any={ip,source:{platform:'vercel',provider:null,enriched:false}}; try{const ext=await enrichFromIpApi(ip); if(ext) base=ext;}catch{} return new Response(JSON.stringify(base,null,2),{headers:cors(new Headers({'content-type':'application/json'}))})}
  if(path==='/resolve'){const name=url.searchParams.get('name'); const type=url.searchParams.get('type')||'A'; const doh=url.searchParams.get('doh')||''; if(!name)return new Response(JSON.stringify({error:'name required'}),{status:400,headers:cors(new Headers({'content-type':'application/json'}))}); const origin=`${url.protocol}//${url.host}`; if(!doh||doh.startsWith(origin)){const host=dohHost; const chain=urlListForHost(host,name,type); const out=await fetchJsonChain(chain); if(out.ok) return new Response(out.text,{headers:cors(new Headers({'content-type':'application/json'}))}); return new Response(JSON.stringify({error:'upstream failed',detail:out.err}),{status:502,headers:cors(new Headers({'content-type':'application/json'}))}); } const h=(new URL(doh)).hostname; const chain=urlListForHost(h,name,type); const out=await fetchJsonChain(chain); if(out.ok) return new Response(out.text,{headers:cors(new Headers({'content-type':'application/json'}))}); return new Response(JSON.stringify({error:'upstream error',detail:out.err}),{status:502,headers:cors(new Headers({'content-type':'application/json'}))});}
  if(path==='/ui') return new Response('',{status:302,headers:{Location:'/ui/'}});
  return new Response('Not Found',{status:404,headers:cors()});
}
export async function POST(){return new Response('Not Found',{status:404,headers:cors()});}
export async function OPTIONS(){return new Response(null,{status:204,headers:cors()});}
