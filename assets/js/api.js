// External data: personal server (Node-RED API v2) and public catalogues (TCGdex).
import { settings } from './settings.js?v=2.2.1';

/* ---------- Personal server ---------- */
export class ServerError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

function serverUrl(action, params = {}) {
  const { server, key } = settings.get();
  const u = new URL(server.replace(/\/+$/, '') + '/v2/' + action);
  Object.entries({ ...params, k: key }).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
}

async function call(action, { method = 'GET', body, params, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    // text/plain keeps the request "simple" (no CORS preflight on the Node-RED side).
    const res = await fetch(serverUrl(action, params), {
      method, signal: ctrl.signal, cache: 'no-store',
      headers: body ? { 'Content-Type': 'text/plain;charset=UTF-8' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ServerError(data.error || `Erreur serveur (${res.status})`, res.status, data);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new ServerError('Le serveur ne répond pas', 0);
    if (e instanceof ServerError) throw e;
    throw new ServerError('Serveur injoignable', 0);
  } finally {
    clearTimeout(t);
  }
}

export const server = {
  ping: () => call('ping', { timeout: 8000 }),
  load: () => call('data'),
  save: (payload) => call('save', { method: 'POST', body: payload }),
  uploadPhoto: (id, data) => call('photo', { method: 'POST', body: { id, data }, timeout: 45000 }),
  deletePhoto: (id) => call('photo-delete', { method: 'POST', body: { id } }).catch(() => {}),
  scan: (image) => call('scan', { method: 'POST', body: { image }, timeout: 60000 }),
  refreshPrices: () => call('prices', { method: 'POST', body: {} }),
  gccSales: (q) => call('gcc', { params: { q }, timeout: 30000 }).then((r) => r.sales || []),
  photoUrl: (id) => serverUrl('img', { id }),
};

/* ---------- TCGdex (free, CORS-enabled catalogue with Cardmarket prices) ---------- */
const TCGDEX = 'https://api.tcgdex.net/v2';
const memo = new Map();

async function tcg(path, ttlHours = 0) {
  const cacheKey = 'pdx.tcg.' + path;
  if (memo.has(path)) return memo.get(path);
  if (ttlHours) {
    try {
      const hit = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (hit && Date.now() - hit.t < ttlHours * 3600e3) { memo.set(path, hit.v); return hit.v; }
    } catch { /* storage unavailable */ }
  }
  const res = await fetch(TCGDEX + path);
  if (!res.ok) throw new Error('Catalogue indisponible (' + res.status + ')');
  const v = await res.json();
  memo.set(path, v);
  if (ttlHours) { try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), v })); } catch { /* quota */ } }
  return v;
}

// The app stores "jp"; TCGdex uses "ja".
export const tcgLang = (l) => (l === 'jp' ? 'ja' : ['fr', 'en', 'de', 'it', 'es', 'ja'].includes(l) ? l : 'en');

export const cardImage = (base, size = 'low') => (base ? `${base}/${size}.webp` : null);
export const setLogo = (base) => (base ? `${base}.webp` : null);

export async function getSets(lang = 'fr') {
  const [sets, series] = await Promise.all([tcg(`/${lang}/sets`, 24), tcg(`/${lang}/series`, 24)]);
  // Set → serie mapping from each serie's detail (logos are missing on some sets, e.g. Set de Base).
  const details = await Promise.all(series.map((s) => tcg(`/${lang}/series/${encodeURIComponent(s.id)}`, 168).catch(() => null)));
  const serieOf = new Map();
  details.forEach((d, i) => (d?.sets || []).forEach((st) => serieOf.set(st.id, { id: series[i].id, name: series[i].name, order: i, logo: series[i].logo })));
  return sets
    .map((s, idx) => {
      const se = serieOf.get(s.id) || { id: 'misc', name: 'Autres', order: -1 };
      // TCGdex uses the Jungle logo for the Base serie; the Base Set logo only exists in English.
      const serieLogo = se.id === 'base' ? 'https://assets.tcgdex.net/en/base/base1/logo' : se.logo || null;
      return { ...s, idx, serie: se.id, serieName: se.name, serieOrder: se.order, serieLogo };
    })
    .filter((s) => s.serie !== 'tcgp'); // Pokémon TCG Pocket is digital-only
}

const normNum = (n) => String(n || '').split('/')[0].replace(/^0+(?=\d)/, '').trim().toLowerCase();

export async function searchCards(query, { lang = 'fr', number = '' } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const [list, sets] = await Promise.all([
    tcg(`/${lang}/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=120`),
    getSets(lang).catch(() => []),
  ]);
  const setIdx = new Map(sets.map((s) => [s.id, s]));
  let out = list.map((c) => {
    const setId = c.id.slice(0, c.id.length - String(c.localId).length - 1);
    const set = setIdx.get(setId);
    return { ...c, setId, setName: set?.name || setId, setTotal: set?.cardCount?.official, order: set ? set.idx : -1 };
  });
  const n = normNum(number);
  if (n) {
    const exact = out.filter((c) => normNum(c.localId) === n);
    if (exact.length) out = exact;
  }
  // Newest sets first, cards with artwork first.
  return out.sort((a, b) => (!!b.image - !!a.image) || (b.order - a.order));
}

export const getSetCards = (lang, setId) => tcg(`/${lang}/sets/${encodeURIComponent(setId)}`, 24);
export const getCard = (lang, id) => tcg(`/${lang}/cards/${encodeURIComponent(id)}`);

// Normalises TCGdex pricing into [{ id, label, cm:{avg,low,trend,avg7,avg30}, tp:{market,low} }]
export function priceVariants(card) {
  const pick = (cm) => cm && { avg: cm.avg, low: cm.low, trend: cm.trend, avg7: cm.avg7, avg30: cm.avg30, updated: cm.updated, idProduct: cm.idProduct };
  const tpPick = (tp) => {
    if (!tp) return null;
    const k = Object.keys(tp).find((x) => typeof tp[x] === 'object' && tp[x] && tp[x].marketPrice != null);
    return k ? { market: tp[k].marketPrice, low: tp[k].lowPrice, kind: k } : null;
  };
  const seen = new Set();
  const out = [];
  (card.variants_detailed || []).forEach((v) => {
    if (!v.pricing || !v.pricing.cardmarket) return;
    const label = [v.type, v.subtype, (v.stamp || []).join(' ')].filter(Boolean).join(' · ');
    const sig = label + v.pricing.cardmarket.idProduct;
    if (seen.has(sig)) return;
    seen.add(sig);
    out.push({ id: v.variantId, label, cm: pick(v.pricing.cardmarket), tp: tpPick(v.pricing.tcgplayer) });
  });
  if (!out.length && card.pricing && card.pricing.cardmarket) {
    out.push({ id: 'default', label: 'Standard', cm: pick(card.pricing.cardmarket), tp: tpPick(card.pricing.tcgplayer) });
  }
  return out;
}

/* ---------- Marketplace deep links ---------- */
function searchTerms(a) {
  const num = a.num ? String(a.num).split('/')[0].replace(/^0+(?=\d)/, '') + (String(a.num).includes('/') ? '/' + String(a.num).split('/')[1] : '') : '';
  const parts = [a.name, num, a.kind === 'item' ? a.category : '', a.set, a.grader && a.grader !== 'raw' ? `${a.grader.toUpperCase()} ${a.grade || ''}` : ''];
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
export const links = {
  ebaySold: (a) => `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(searchTerms(a))}&LH_Sold=1&LH_Complete=1&_sop=13`,
  ebayLive: (a) => `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(searchTerms(a))}&_sop=15`,
  cardmarket: (a) => `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(a.name)}`,
  gcc: (a) => `https://gradedcardcenter.com/filtres?searchText=${encodeURIComponent(a.name)}`,
  vinted: (a) => `https://www.vinted.fr/catalog?search_text=${encodeURIComponent(searchTerms(a))}`,
};
