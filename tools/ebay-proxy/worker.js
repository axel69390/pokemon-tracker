/* CardVault / Pokédex Invest — eBay listings proxy (Cloudflare Worker, free plan is enough)

   Why: the eBay Browse API needs a secret key, which must never ship inside the app, and browsers cannot call
   it directly. This tiny worker holds the key and returns compact, cache-friendly JSON to the app.
   It only reads ACTIVE listings (official Browse API). Sold listings are not available in any public eBay API.

   Setup (once):
   1. developer.ebay.com → create a developer account → "Application keys" → create a Production keyset.
   2. dash.cloudflare.com → Workers & Pages → Create → paste this file → Deploy.
   3. Worker → Settings → Variables and Secrets: add EBAY_CLIENT_ID (Client ID / App ID) and
      EBAY_CLIENT_SECRET (Cert ID) as secrets; optionally ALLOWED_ORIGIN (e.g. https://axel69390.github.io).
   4. Put the worker URL in assets/js/edition.js → EBAY_API.

   Endpoint: GET /?q=<search text>&lang=fr   →  { items: [{ title, price, currency, url, image, condition, buying, endsAt }] }
*/
let token = null;
let tokenExp = 0;

async function getToken(env) {
  if (token && Date.now() < tokenExp - 60000) return token;
  const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`) },
    body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
  });
  if (!res.ok) throw new Error('eBay auth ' + res.status);
  const j = await res.json();
  token = j.access_token;
  tokenExp = Date.now() + (j.expires_in || 7200) * 1000;
  return token;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allow = env.ALLOWED_ORIGIN ? (origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN) : '*';
    const cors = { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
    if (q.length < 3) return Response.json({ error: 'q required' }, { status: 400, headers: cors });
    try {
      const api = new URL('https://api.ebay.com/buy/browse/v1/item_summary/search');
      api.searchParams.set('q', q);
      api.searchParams.set('limit', '50');
      api.searchParams.set('sort', 'price');
      const res = await fetch(api, {
        headers: { Authorization: 'Bearer ' + (await getToken(env)), 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_FR', 'Accept-Language': 'fr-FR' },
        cf: { cacheTtl: 900, cacheEverything: true },
      });
      if (!res.ok) return Response.json({ error: 'eBay ' + res.status }, { status: 502, headers: cors });
      const j = await res.json();
      const items = (j.itemSummaries || []).map((x) => ({
        title: x.title,
        price: x.price ? +x.price.value : null,
        currency: x.price ? x.price.currency : null,
        url: x.itemWebUrl,
        image: x.image ? x.image.imageUrl : null,
        condition: x.condition || null,
        buying: (x.buyingOptions || []).includes('AUCTION') ? 'auction' : 'fixed',
        endsAt: x.itemEndDate || null,
      }));
      return Response.json({ items }, { headers: { ...cors, 'Cache-Control': 'public, max-age=900' } });
    } catch (e) {
      return Response.json({ error: String(e.message || e) }, { status: 502, headers: cors });
    }
  },
};
