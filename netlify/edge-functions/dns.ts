const DEFAULT_DOH='cloudflare-dns.com';
const ASN_MAP: Record<number,string> = {
  9812:'东方有线',9389:'中国长城',17962:'天威视讯',17429:'歌华有线',7497:'科技网',24139:'华数',9801:'中关村',4538:'教育网',24151:'CNNIC',
  38019:'中国移动',139080:'中国移动',9808:'中国移动',24400:'中国移动',134810:'中国移动',24547:'中国移动',56040:'中国移动',56041:'中国移动',
  56042:'中国移动',56044:'中国移动',132525:'中国移动',56046:'中国移动',56047:'中国移动',56048:'中国移动',59257:'中国移动',24444:'中国移动',
  24445:'中国移动',137872:'中国移动',9231:'中国移动',58453:'中国移动',4134:'中国电信',4812:'中国电信',23724:'中国电信',136188:'中国电信',
  137693:'中国电信',17638:'中国电信',140553:'中国电信',4847:'中国电信',140061:'中国电信',136195:'中国电信',17799:'中国电信',139018:'中国电信',
  134764:'中国电信',4837:'中国联通',4808:'中国联通',134542:'中国联通',134543:'中国联通',59019:'金山云',135377:'优刻云',45062:'网易云',
  37963:'阿里云',45102:'阿里云国际',45090:'腾讯云',132203:'腾讯云国际',55967:'百度云',38365:'百度云',58519:'华为云',55990:'华为云',
  136907:'华为云',4609:'澳門電訊',13335:'Cloudflare',55960:'亚马逊云',14618:'亚马逊云',16509:'亚马逊云',15169:'谷歌云',396982:'谷歌云',36492:'谷歌云'
};
function provinceMatch(s: string){const arr=['内蒙古','黑龙江','河北','山西','吉林','辽宁','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','海南','四川','贵州','云南','陕西','甘肃','青海','广西','西藏','宁夏','新疆','北京','天津','上海','重庆'];for(const i of arr){if(s?.includes(i))return i;}return '';}
function cors(h=new Headers()){h.set('Access-Control-Allow-Origin','*');h.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');h.set('Access-Control-Allow-Headers','*');return h;}
const dohHost= (env:Record<string,string>) => (env.DOH||DEFAULT_DOH).replace(/^https?:\/\//,'').split('/')[0];
const buildAddr=(ip:string,mask:number)=>{try{const parts=ip.split('.').map(x=>parseInt(x)); if(parts.length!==4) return ip; const m=(0xffffffff<< (32-mask))>>>0; const v=((parts[0]<<24)|(parts[1]<<16)|(parts[2]<<8)|parts[3])>>>0; const n=v&m; const a=[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255].join('.'); return `${a}/${mask}`;}catch{return ip;}};
const enrichFromIpApi= async (ip:string)=>{const r=await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`); if(!r.ok) return null; const j:any=await r.json(); const asnNum = parseInt(String(j.asn||'').replace(/[^\d]/g,''))||undefined; const ispName = j.org || (asnNum?ASN_MAP[asnNum]:undefined); const prov = provinceMatch(j.region)||j.region; const out:any={
  ip, addr: buildAddr(ip, 24),
  as: asnNum?{number: asnNum, name: j.org||undefined, info: ASN_MAP[asnNum]||j.org||undefined}:undefined,
  country: j.country?{code:j.country, name:j.country_name}:undefined,
  regions: [prov, j.city].filter(Boolean),
  location: (j.latitude||j.longitude)?{latitude:j.latitude, longitude:j.longitude}:undefined,
  timezone: j.timezone||undefined,
  source: {platform:'netlify', provider:'ipapi', enriched:true}
}; return out;};
const tryGoogleResolve = (host:string, name:string, type:string)=>{const u=new URL(`https://${host}/resolve`); u.searchParams.set('name',name); u.searchParams.set('type',type); return u.toString();};
const tryCfResolve = (host:string, name:string, type:string)=>{const u=new URL(`https://${host}/dns-query`); u.searchParams.set('name',name); u.searchParams.set('type',type); u.searchParams.set('ct','application/dns-json'); return u.toString();};

export default async (request: Request, context: any) => {
  const env = {
    DOH: (Deno as any).env?.get('DOH') ?? '',
    DOH_PATH: (Deno as any).env?.get('DOH_PATH') ?? (Deno as any).env?.get('HSD_PATH') ?? (Deno as any).env?.get('TOKEN') ?? 'dns-query'
  };
  const url = new URL(request.url);
  const p = url.pathname;
  const dnsQueryEnabled = env.DOH_PATH === 'dns-query';
  const dohPath = '/' + env.DOH_PATH;

  if (p==='/') return context.next();

  if (p==='/meta') {
    return new Response(JSON.stringify({dohPath: env.DOH_PATH, dnsQueryEnabled}, null, 2), {headers: cors(new Headers({'content-type':'application/json'}))});
  }

  if (p==='/ip') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || request.headers.get('cf-connecting-ip')
      || '0.0.0.0';
    let base:any = { ip, source: { platform:'netlify', provider:null, enriched:false } };
    try {
      const ext = await enrichFromIpApi(ip);
      if (ext) base = ext;
    } catch {}
    return new Response(JSON.stringify(base, null, 2), {headers: cors(new Headers({'content-type':'application/json'}))});
  }

  if (p==='/host') {
    const id = request.headers.get('x-nf-request-id')||undefined;
    return new Response(JSON.stringify({platform:'netlify', request_id:id}, null, 2), {headers: cors(new Headers({'content-type':'application/json'}))});
  }

  if (p==='/resolve') {
    const name = url.searchParams.get('name'); const type = url.searchParams.get('type') || 'A'; const doh = url.searchParams.get('doh') || '';
    if (!name) return new Response(JSON.stringify({error:'name required'}), {status:400, headers: cors(new Headers({'content-type':'application/json'}))});
    const origin = `${url.protocol}//${url.host}`;
    try {
      if (!doh || doh.startsWith(origin)) {
        const host = dohHost(env); const g = await fetch(tryGoogleResolve(host, name, type)); if (g.ok) return new Response(await g.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
        const c = await fetch(tryCfResolve(host, name, type)); if (c.ok) return new Response(await c.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
        return new Response(JSON.stringify({error:'upstream failed'}), {status:502, headers: cors(new Headers({'content-type':'application/json'}))});
      }
      const h = (new URL(doh)).hostname.toLowerCase();
      const pri = h.includes('dns.google') ? await fetch(tryGoogleResolve(h, name, type)) : await fetch(tryCfResolve(h, name, type));
      if (pri.ok) return new Response(await pri.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
      const fb = h.includes('dns.google') ? await fetch(tryCfResolve(h, name, type)) : await fetch(tryGoogleResolve(h, name, type));
      if (fb.ok) return new Response(await fb.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
      return new Response(JSON.stringify({error:'upstream error'}), {status:502, headers: cors(new Headers({'content-type':'application/json'}))});
    } catch (e:any) {
      return new Response(JSON.stringify({error: String(e)}), {status:502, headers: cors(new Headers({'content-type':'application/json'}))});
    }
  }

  if (p===dohPath) {
    const u = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {status:204, headers: cors()});
    if (u.searchParams.has('name')) {
      const host = dohHost(env);
      const gUrl = tryGoogleResolve(host, u.searchParams.get('name')!, u.searchParams.get('type')||'A');
      const g = await fetch(gUrl, {headers:{'accept':'application/dns-json'}});
      if (g.ok) return new Response(await g.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
      const cUrl = tryCfResolve(host, u.searchParams.get('name')!, u.searchParams.get('type')||'A');
      const c = await fetch(cUrl, {headers:{'accept':'application/dns-json'}});
      if (c.ok) return new Response(await c.text(), {headers: cors(new Headers({'content-type':'application/json'}))});
      return new Response(JSON.stringify({error:'upstream'}), {status:502, headers: cors(new Headers({'content-type':'application/json'}))});
    }
    const host = dohHost(env); const dnsDoH = `https://${host}/dns-query`;
    const isGet = u.searchParams.has('dns');
    const isPost = request.method==='POST' && (request.headers.get('content-type')||'').startsWith('application/dns-message');
    if (!isGet && !isPost) return new Response('Bad Request', {status:400, headers: cors()});
    const upstream = isGet ? dnsDoH + u.search : dnsDoH;
    const init:any = isGet ? {headers:{'accept':'application/dns-message'}} : {method:'POST', headers:{'accept':'application/dns-message','content-type':'application/dns-message'}, body: await request.arrayBuffer()};
    const r = await fetch(upstream, init); return new Response(r.body, {status: r.status, headers: cors(new Headers({'content-type':'application/dns-message'}))});
  }

  if (!dnsQueryEnabled && p==='/dns-query') return new Response('Not Found', {status:404, headers: cors(new Headers({'content-type':'text/plain; charset=utf-8'}))});

  return context.next();
};