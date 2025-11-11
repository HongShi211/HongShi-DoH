const DEFAULT_DOH = 'cloudflare-dns.com';

function getEnv() {
  return {
    DOH: Deno.env.get('DOH') ?? '',
    PATH: Deno.env.get('PATH') ?? Deno.env.get('TOKEN') ?? 'dns-query',
    URL: Deno.env.get('URL') ?? '',
  };
}

function getDoHHost(env) {
  const base = (env.DOH || DEFAULT_DOH).replace(/^https?:\/\//, '');
  return base.split('/')[0];
}

function pickClientIP(headers) {
  const fwd = headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0]?.trim() ||
             headers.get('x-real-ip') ||
             headers.get('cf-connecting-ip') || '';
  return ip || '0.0.0.0';
}

function addCORS(h) {
  h.set('access-control-allow-origin', '*');
  h.set('access-control-allow-headers', 'content-type');
  h.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  return h;
}

async function handleDoH(request, env) {
  const host = getDoHHost(env);
  const upstream = new URL(`https://${host}/dns-query`);
  const url = new URL(request.url);

  const isGetWithDns = url.searchParams.has('dns');
  const isPost = request.method === 'POST';
  const isOptions = request.method === 'OPTIONS';

  if (isOptions) {
    return new Response(null, { status: 204, headers: addCORS(new Headers()) });
  }

  if (!isGetWithDns && !isPost) {
    return new Response('Bad Request', { status: 400, headers: addCORS(new Headers({'content-type':'text/plain'})) });
  }

  upstream.search = url.search;
  const headers = new Headers();
  headers.set('accept', 'application/dns-message');
  headers.set('host', host);

  let body = null;
  if (isPost) {
    const ct = request.headers.get('content-type') || '';
    if (!ct.startsWith('application/dns-message')) {
      return new Response('Unsupported Media Type', { status: 415, headers: addCORS(new Headers({'content-type':'text/plain'})) });
    }
    headers.set('content-type', 'application/dns-message');
    body = await request.arrayBuffer();
  }

  const res = await fetch(upstream.toString(), {
    method: isPost ? 'POST' : 'GET',
    headers,
    body,
  });

  const h = addCORS(new Headers({
    'content-type': 'application/dns-message',
    'cache-control': 'no-store',
  }));
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: h,
  });
}

async function handleResolve(request, env) {
  const host = getDoHHost(env);
  const url = new URL(request.url);
  if (!url.searchParams.get('name')) {
    return new Response(JSON.stringify({ error: 'name required' }), {
      status: 400,
      headers: addCORS(new Headers({ 'content-type': 'application/json' }))
    });
  }
  const upstream = new URL(`https://${host}/resolve`);
  url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  const res = await fetch(upstream.toString(), {
    headers: { 'accept': 'application/dns-json', 'host': host },
  });
  const text = await res.text();
  const h = addCORS(new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' }));
  return new Response(text, { status: res.status, headers: h });
}

function parseTrace(text) {
  const obj = {};
  for (const line of text.split('\n')) {
    const [k, v] = line.split('=');
    if (k && v) obj[k.trim()] = v.trim();
  }
  return obj;
}

async function handleIpInfo() {
  const r = await fetch('https://1.1.1.1/cdn-cgi/trace');
  const txt = await r.text();
  const data = parseTrace(txt);
  return new Response(JSON.stringify(data, null, 2), {
    headers: addCORS(new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' })),
  });
}

export default async (request) => {
  const env = getEnv();
  const url = new URL(request.url);
  const pathname = url.pathname;
  const dohPath = `/${env.PATH}`;

  // Root (/) doubles as DoH endpoint when proper DoH request; otherwise show info/redirect
  if (pathname === '/') {
    const hasDns = url.searchParams.has('dns');
    const isDoHPost = request.method === 'POST' && (request.headers.get('content-type')||'').startsWith('application/dns-message');
    if (hasDns || isDoHPost || request.method === 'OPTIONS') {
      return handleDoH(request, env);
    }
    // Non-DoH browser visit -> redirect to /ui
    return new Response(null, { status: 302, headers: { 'Location': '/ui' } });
  }

  if (pathname === dohPath) {
    return handleDoH(request, env);
  }
  if (pathname === '/resolve') {
    return handleResolve(request, env);
  }
  if (pathname === '/ip') {
    const ip = pickClientIP(request.headers);
    return new Response(ip + '\n', { headers: addCORS(new Headers({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })) });
  }
  if (pathname === '/ip-info') {
    return handleIpInfo();
  }

  // Not handled: let static files serve; otherwise 404
  return new Response('Not Found', { status: 404 });
};
