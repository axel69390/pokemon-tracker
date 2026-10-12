// External data: personal server (Node-RED API v2) and public catalogues (TCGdex).
import { settings } from './settings.js?v=2.4.8-202610121947';
import { asset } from './edition.js?v=2.4.8-202610121947';

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
      return { ...s, name: cleanSetName(s.id, s.name), idx, serie: se.id, serieName: se.name, serieOrder: se.order, serieLogo };
    })
    .filter((s) => s.serie !== 'tcgp'); // Pokémon TCG Pocket is digital-only
}

const REPRINT_SETS = /^(30th|cel25)/;
const normNum = (n) => String(n || '').split('/')[0].replace(/^0+(?=\d)/, '').trim().toLowerCase();

// All pages of a name search (120 per page, up to 600 cards): a popular name such as Dracaufeu has far more than
// one page, and the old Set de Base cards used to be cut off.
async function searchPages(lang, q) {
  const PAGE = 120, MAX = 5;
  const url = (p) => `/${lang}/cards?name=${encodeURIComponent(q)}&pagination:page=${p}&pagination:itemsPerPage=${PAGE}`;
  const first = await tcg(url(1));
  if (!Array.isArray(first) || first.length < PAGE) return first || [];
  const more = await Promise.all(Array.from({ length: MAX - 1 }, (_, i) => tcg(url(i + 2)).catch(() => [])));
  const seen = new Set();
  return [first, ...more].flat().filter((c) => c && !seen.has(c.id) && seen.add(c.id));
}

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let monNames = null;   // [[num, fr, en]], loaded once
const loadMonNames = () => (monNames ||= fetch(asset('assets/data/pokemon-names.json')).then((r) => r.json()).catch(() => { monNames = null; return []; }));

// TCGdex name search ignores case but not accents, and its data is not consistent: the 30th anniversary
// "Metalosse" has no accent while every other card is "Métalosse". Search the typed name, its accent-free
// spelling and, in French, the accented Pokémon name meant by an accent-free query ("metalosse", "metalosse v").
async function nameVariants(lang, q) {
  const f = fold(q);
  const out = new Map([[q.toLowerCase(), q], [f, f]]);
  if (lang === 'fr' && f.length >= 4) {
    (await loadMonNames())
      .map(([, fr]) => [fr, fold(fr)])
      .filter(([fr, ff]) => ff !== fr.toLowerCase())   // only names that carry an accent
      .flatMap(([fr, ff]) => (ff.startsWith(f) ? [fr] : f.startsWith(ff) && /^[\s-]/.test(f.slice(ff.length)) ? [fr + f.slice(ff.length)] : []))
      .slice(0, 3)
      .forEach((v) => out.set(v.toLowerCase(), v));
  }
  return [...out.values()];
}

async function searchNames(lang, q) {
  const lists = await Promise.all((await nameVariants(lang, q)).map((v) => searchPages(lang, v).catch(() => [])));
  const seen = new Set();
  return lists.flat().filter((c) => c && !seen.has(c.id) && seen.add(c.id));
}

// Words that say nothing about the set in "Métalosse 30 ans", "Pikachu édition Célébrations"…
const SET_NOISE = new Set(['ans', 'an', 'de', 'du', 'des', 'la', 'le', 'les', 'edition', 'set', 'serie', 'carte']);

export async function searchCards(query, { lang = 'fr', number = '' } = {}) {
  let q = query.trim();
  if (q.length < 2) return [];
  // "Dracaufeu 4/102", "dracaufeu 4" or "dracaufeu #4": the trailing number narrows the search.
  const m = q.match(/^(.*\S)\s+#?(\d{1,3})(?:\s*\/\s*\d{1,3})?$/);
  if (m && m[1].length >= 2 && !number) { q = m[1]; number = m[2]; }
  const setsP = getSets(lang).catch(() => []);
  let list = await searchNames(lang, q);
  // No card with that whole name: the last words may name the set ("Métalosse 30 ans", "Dracaufeu 151").
  let setWords = [];
  const words = q.split(/\s+/);
  for (let k = words.length - 1; !list.length && k >= 1; k--) {
    const name = words.slice(0, k).join(' ');
    if (name.length < 2) break;
    list = await searchNames(lang, name);
    setWords = words.slice(k).map(fold).filter((w) => w && !SET_NOISE.has(w));
  }
  const sets = await setsP;
  const setIdx = new Map(sets.map((s) => [s.id, s]));
  let out = list.map((c) => {
    const setId = c.id.slice(0, c.id.length - String(c.localId).length - 1);
    const set = setIdx.get(setId);
    const printed = printedNumber({ set: { id: setId }, localId: c.localId })?.num || '';
    return { ...c, setId, printed, setName: cleanSetName(setId, set?.name || setId), setTotal: set?.cardCount?.official, order: set ? set.idx : -1 };
  });
  if (setWords.length) {
    const inSet = out.filter((c) => setWords.every((w) => fold(c.setName + ' ' + c.setId).includes(w)));
    if (inSet.length) out = inSet;
  }
  const n = normNum(number);
  if (n) {
    const exact = out.filter((c) => normNum(c.printed || c.localId) === n);
    // Reprint sets (30th anniversary, Celebrations) keep the ORIGINAL printed number (11/113), never the TCGdex one (3/30):
    // always keep them next to the exact matches so the stamped reprint can be picked.
    if (exact.length) out = [...exact, ...out.filter((c) => REPRINT_SETS.test(c.setId) && !exact.includes(c))];
  }
  // Newest sets first, cards with artwork first. A card of a brand-new set whose artwork is not published yet
  // (TCGdex lags a few weeks) is not pushed to the bottom.
  const recentFrom = Math.max(0, sets.length - 14);
  const rank = (c) => (c.image || c.order >= recentFrom ? 1 : 0);
  return out.sort((a, b) => (rank(b) - rank(a)) || (b.order - a.order));
}

export const getSetCards = (lang, setId) => tcg(`/${lang}/sets/${encodeURIComponent(setId)}`, 24);
export const getCard = (lang, id) => tcg(`/${lang}/cards/${encodeURIComponent(id)}`);

// Classic collections (30th anniversary, Celebrations) reprint old cards with their ORIGINAL printed number
// (the 30th Metalosse reads 11/113, from EX Espèces Delta) while TCGdex numbers them in the small set (003/30).
// Both sets are closed: number printed on each card, in TCGdex order.
const CLASSIC_NUMBERS = {
  '30th-c': [
    ['4/102', 'Set de Base'], ['5/109', 'EX Rubis & Saphir'], ['11/113', 'EX Espèces Delta'], ['11/101', 'Explosion Plasma'],
    ['18/132', 'Gym Heroes'], ['19/109', 'EX Team Rocket Returns'], ['25/111', 'Neo Genesis'], ['33/181', 'Duo de Choc'],
    ['41/122', 'Rupture TURBO'], ['43/146', 'Éveil des Légendes'], ['47/127', 'Platine'], ['50/185', 'Voltage Éclatant'],
    ['57/111', 'Invasion Carmin'], ['58/102', 'Set de Base'], ['69/132', 'Gym Challenge'], ['85/124', 'Dragons Exaltés'],
    ['89/149', 'Soleil et Lune'], ['94/102', 'Triomphe'], ['99/102', 'Triomphe'], ['100/102', 'Triomphe'],
    ['101/101', 'Nobles Victoires'], ['106/160', 'Primo-Choc'], ['106/106', 'Duels au Sommet'], ['106/105', 'Neo Destiny'],
    ['108/115', 'EX Forces Cachées'], ['114/264', 'Poing de Fusion'], ['123/172', 'Stars Étincelantes'], ['138/202', 'Épée et Bouclier'],
    ['149/147', 'Aquapolis'], ['203/193', 'Évolutions à Paldea'],
  ],
  'cel25cc': [
    ['2/102', 'Set de Base'], ['4/102', 'Set de Base'], ['15/102', 'Set de Base'], ['73/102', 'Set de Base'],
    ['8/82', 'Team Rocket'], ['15/82', 'Team Rocket'], ['15/132', 'Gym Challenge'], ['24', 'Promo Wizards'],
    ['20/111', 'Neo Genesis'], ['66/64', 'Neo Revelation'], ['9/95', 'EX Team Magma vs Team Aqua'], ['86/109', 'EX Team Rocket Returns'],
    ['88/92', 'EX Créateurs de Légendes'], ['93/101', 'EX Île des Dragons'], ['17/17', 'POP Série 5'], ['15/106', 'Duels au Sommet'],
    ['109/111', 'Rivaux Émergeants'], ['145/147', 'Vainqueurs Suprêmes'], ['107/123', 'HeartGold SoulSilver'], ['113/114', 'Noir & Blanc'],
    ['114/114', 'Noir & Blanc'], ['54/99', 'Destinées Futures'], ['97/146', 'XY'], ['76/108', 'Ciel Rugissant'],
    ['60/145', 'Gardiens Ascendants'],
  ],
};

// The classic collections are sold inside their anniversary set: they belong with it in the collection, and
// TCGdex names one of them without a space ("Collection Classique30ᵉ Anniversaire").
const CLASSIC_PARENT = { '30th-c': '30th', cel25cc: 'cel25' };
const CLASSIC_SET_NAMES = { '30th-c': '30ᵉ Anniversaire · Collection Classique', cel25cc: 'Célébrations · Collection Classique' };
export const parentSetId = (setId) => CLASSIC_PARENT[setId] || setId;
export const cleanSetName = (setId, name) => CLASSIC_SET_NAMES[setId] || name || '';

// { num: '11/113', set: 'EX Espèces Delta' } for a classic-collection reprint, null otherwise.
export function printedNumber(card) {
  const row = CLASSIC_NUMBERS[card?.set?.id]?.[parseInt(String(card.localId).replace(/\D/g, ''), 10) - 1];
  return row ? { num: row[0], set: row[1] } : null;
}

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
