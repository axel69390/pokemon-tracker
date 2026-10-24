// Collection state, persistence (device or personal server) and portfolio maths.
import { settings } from './settings.js?v=2.4.10-202610241804';
import { IS_STORE, asset } from './edition.js?v=2.4.10-202610241804';
import { server, ServerError, getCard } from './api.js?v=2.4.10-202610241804';
import { today, uid, toast, debounce } from './ui.js?v=2.4.10-202610241804';
import { hasAccess } from './billing.js?v=2.4.10-202610241804';
import { ebayListings, EST_MIN_VALUE } from './ebay.js?v=2.4.10-202610241804';

// Each edition keeps its own data, even in the same browser.
const NS = IS_STORE ? 'cv' : 'pdx';
const CACHE_KEY = NS + '.cache';
const LOCAL_KEY = NS + '.local';
const EMPTY = () => ({ rev: 0, cards: [], items: [], sales: [], sets: [], history: [] });

let state = EMPTY();
let status = { loading: true, online: false, saving: false, error: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state, status));

export const store = {
  get: () => state,
  status: () => status,
  on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};

/* ---------- Maths ---------- */
const n = (v) => (v == null || v === '' || !isFinite(+v) ? 0 : +v);
export const qtyOf = (a) => Math.max(1, n(a.qty) || 1);
export const costOf = (a) => n(a.buyPrice) * qtyOf(a) + n(a.gradingCost);
export const unitCost = (a) => costOf(a) / qtyOf(a);
export const hasValue = (a) => a.value != null && a.value !== '' && isFinite(+a.value);
export const unitValue = (a) => (hasValue(a) ? +a.value : unitCost(a));
export const worthOf = (a) => unitValue(a) * qtyOf(a);
export const gainOf = (a) => worthOf(a) - costOf(a);
export const gainPct = (a) => (costOf(a) > 0 ? (gainOf(a) / costOf(a)) * 100 : null);

export function totals(list) {
  const t = { value: 0, cost: 0, count: 0, lines: list.length };
  list.forEach((a) => { t.value += worthOf(a); t.cost += costOf(a); t.count += qtyOf(a); });
  t.gain = t.value - t.cost;
  t.pct = t.cost > 0 ? (t.gain / t.cost) * 100 : null;
  return t;
}

export function portfolio() {
  const cards = totals(state.cards);
  const items = totals(state.items);
  const value = cards.value + items.value;
  const cost = cards.cost + items.cost;
  return { cards, items, value, cost, gain: value - cost, pct: cost > 0 ? ((value - cost) / cost) * 100 : null };
}

export function salesSummary(kind) {
  const list = state.sales.filter((s) => s.kind === kind);
  const revenue = list.reduce((s, x) => s + saleRevenue(x), 0);
  const pnl = list.reduce((s, x) => s + salePnl(x), 0);
  return { list, count: list.length, revenue, pnl };
}
export const saleRevenue = (s) => n(s.sellPrice) * n(s.qty) - n(s.fees);
export const salePnl = (s) => saleRevenue(s) - n(s.cost);

// Value of an asset at a given date, from its price log (falls back to purchase cost).
function unitValueAt(a, date) {
  const log = (a.priceLog || []).filter((p) => p.d <= date && p.v != null);
  return log.length ? +log[log.length - 1].v : null;
}

export function monthPerformers() {
  const d = new Date();
  const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const out = [];
  [...state.cards.map((a) => ['card', a]), ...state.items.map((a) => ['item', a])].forEach(([kind, a]) => {
    if (!hasValue(a)) return;
    const acquired = a.buyDate || a.addedAt || '0000';
    // Reference = value just before the 1st of the month; purchase cost if bought this month.
    const ref = acquired >= monthStart ? unitCost(a) : (unitValueAt(a, monthStart.slice(0, 8) + '00') ?? firstLogged(a));
    if (ref == null) return;
    const delta = (unitValue(a) - ref) * qtyOf(a);
    const pctv = ref > 0 ? ((unitValue(a) - ref) / ref) * 100 : null;
    if (Math.abs(delta) < 0.005) return;
    out.push({ kind, a, delta, pct: pctv });
  });
  return out;
}
function firstLogged(a) {
  const log = (a.priceLog || []).filter((p) => p.v != null);
  return log.length ? +log[0].v : unitCost(a);
}

// Chart series: recorded portfolio value by day + invested amount rebuilt from purchase dates.
export function series() {
  const hist = (state.history || []).map((h) => ({ d: h.d, value: h.value, invested: h.invested }));
  const buys = [...state.cards, ...state.items]
    .map((a) => ({ d: (a.buyDate || a.addedAt || today()).slice(0, 10), c: costOf(a) }))
    .sort((x, y) => (x.d < y.d ? -1 : 1));
  const investedAt = (date) => buys.reduce((s, b) => (b.d <= date ? s + b.c : s), 0);
  const days = new Set([...hist.map((h) => h.d), ...buys.map((b) => b.d), today()]);
  const byDay = new Map(hist.map((h) => [h.d, h]));
  const p = portfolio();
  return [...days].sort().map((d) => ({
    d,
    invested: d === today() ? p.cost : investedAt(d),
    value: d === today() ? p.value : byDay.has(d) ? byDay.get(d).value : null,
  }));
}

/* ---------- Persistence ---------- */
function writeCache() {
  try {
    localStorage.setItem(settings.isServer() ? CACHE_KEY : LOCAL_KEY, JSON.stringify(state));
  } catch {
    if (!settings.isServer()) toast('Stockage de l’appareil plein : passez en mode serveur ou exportez vos données', { error: true, ms: 5000 });
  }
}
function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

// Local mode keeps its own daily history (the server does this itself).
function localSnapshot() {
  const p = portfolio();
  const point = { d: today(), value: +p.value.toFixed(2), invested: +p.cost.toFixed(2),
    cardsValue: +p.cards.value.toFixed(2), itemsValue: +p.items.value.toFixed(2) };
  const h = state.history || (state.history = []);
  if (h.length && h[h.length - 1].d === point.d) h[h.length - 1] = point; else h.push(point);
}

export async function load() {
  status = { ...status, loading: true, error: null };
  if (!settings.isServer()) {
    state = { ...EMPTY(), ...(readLocal(LOCAL_KEY) || {}) };
    status = { loading: false, online: false, saving: false, error: null, local: true };
    emit();
    return;
  }
  const cached = readLocal(CACHE_KEY);
  if (cached) { state = { ...EMPTY(), ...cached }; emit(); }
  try {
    state = { ...EMPTY(), ...(await server.load()) };
    status = { loading: false, online: true, saving: false, error: null };
    writeCache();
  } catch (e) {
    status = { loading: false, online: false, saving: false, error: e.message };
    if (!cached) toast(e.message, { error: true });
  }
  emit();
}

let saving = null;
let dirty = false;
async function pushToServer() {
  if (saving) { dirty = true; return saving; }
  saving = (async () => {
    status = { ...status, saving: true }; emit();
    try {
      const res = await server.save({ rev: state.rev, cards: state.cards, items: state.items, sales: state.sales, sets: state.sets });
      state.rev = res.rev;
      state.history = res.history || state.history;
      status = { ...status, online: true, error: null };
      writeCache();
    } catch (e) {
      if (e instanceof ServerError && e.status === 409 && e.data && e.data.data) {
        state = { ...EMPTY(), ...e.data.data };
        writeCache();
        toast('Collection modifiée depuis un autre appareil : données rechargées', { error: true, ms: 4500 });
      } else {
        status = { ...status, online: false, error: e.message };
        toast('Enregistrement impossible : ' + e.message, { error: true, ms: 4500 });
      }
    } finally {
      status = { ...status, saving: false };
      saving = null;
      emit();
      if (dirty) { dirty = false; pushToServer(); }
    }
  })();
  return saving;
}
const pushSoon = debounce(pushToServer, 350);

function commit() {
  if (settings.isServer()) { writeCache(); pushSoon(); } else { localSnapshot(); writeCache(); }
  emit();
}

/* ---------- Photos ---------- */
export async function savePhoto(dataUrl) {
  if (!settings.isServer()) return dataUrl;           // stored inline on this device
  const id = uid('p');
  await server.uploadPhoto(id, dataUrl);
  return id;
}
export const photoUrl = (p) => (!p ? null : p.startsWith('data:') || p.startsWith('http') ? p : server.photoUrl(p));
// Items added before hand-made products had their own picture point at a TCGplayer image that does not exist.
const handMade = (u) => {
  const m = /tcgplayer-cdn\.tcgplayer\.com\/product\/(9\d{6})_\d+w\.jpg$/.exec(u || '');
  return m ? asset(`assets/img/sealed/${m[1]}.jpg`) : u;
};
const thumbUrl = (u) => (u && u.includes('assets.tcgdex.net') ? u.replace(/\/high\.webp$/, '/low.webp') : u);
export const imageOf = (a, { thumb = false } = {}) => photoUrl(a.photo) || handMade(thumb ? thumbUrl(a.image) : a.image) || null;
export const officialImage = (a, { thumb = false } = {}) => handMade(thumb ? thumbUrl(a.image) : a.image) || null;

/* ---------- Mutations ---------- */
const listOf = (kind) => (kind === 'card' ? state.cards : state.items);
export const find = (kind, id) => listOf(kind).find((a) => a.id === id);

function logValue(a, v) {
  if (v == null || v === '' || !isFinite(+v)) return;
  a.priceLog = (a.priceLog || []).filter((p) => p.d !== today());
  a.priceLog.push({ d: today(), v: +v });
  a.valueUpdatedAt = today();
}

export function addAsset(kind, data) {
  const a = { ...data, id: uid(kind === 'card' ? 'c' : 'i'), addedAt: today(), priceLog: [] };
  if (hasValue(a)) logValue(a, a.value);
  listOf(kind).unshift(a);
  commit();
  return a;
}

export function updateAsset(kind, id, patch) {
  const a = find(kind, id);
  if (!a) return null;
  const valueChanged = 'value' in patch && String(patch.value ?? '') !== String(a.value ?? '');
  const oldPhoto = a.photo;
  Object.assign(a, patch);
  if (valueChanged) logValue(a, a.value);
  if (oldPhoto && oldPhoto !== a.photo && settings.isServer() && !oldPhoto.startsWith('data:')) server.deletePhoto(oldPhoto);
  commit();
  return a;
}

export function removeAsset(kind, id) {
  const list = listOf(kind);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return;
  const [a] = list.splice(i, 1);
  if (a.photo && settings.isServer() && !a.photo.startsWith('data:') && !state.sales.some((s) => s.photo === a.photo)) server.deletePhoto(a.photo);
  commit();
}

export function sellAsset(kind, id, { qty, sellPrice, fees, date, platform }) {
  const a = find(kind, id);
  if (!a) return;
  const q = Math.min(qtyOf(a), Math.max(1, n(qty)));
  const cost = unitCost(a) * q;
  state.sales.unshift({
    id: uid('s'), kind, assetId: a.id, qty: q, sellPrice: n(sellPrice), fees: n(fees), cost: +cost.toFixed(2),
    date: date || today(), platform: platform || '',
    name: a.name, set: a.set || '', num: a.num || '', lang: a.lang, category: a.category || '',
    grader: a.grader || '', grade: a.grade || '', image: a.image || null, photo: a.photo || null,
  });
  if (q >= qtyOf(a)) {
    listOf(kind).splice(listOf(kind).indexOf(a), 1);
  } else {
    // Grading cost follows the remaining copies proportionally.
    a.gradingCost = +(n(a.gradingCost) * (1 - q / qtyOf(a))).toFixed(2);
    a.qty = qtyOf(a) - q;
  }
  commit();
}

export function deleteSale(id) {
  state.sales = state.sales.filter((s) => s.id !== id);
  commit();
}

/* ---------- Automatic prices ----------
   Modes: 'fr' Cote France (eBay France, French raw cards), 'auto' (Cardmarket trend, or GCC for a graded card),
   'manual'. Without a chosen mode: graded → GCC; French raw card linked to the catalogue → Cote France, unless its
   value was typed by hand (no valueSource), which stays manual; recent French cards otherwise → Cardmarket. */
const MODERN = /^(me\d|me0|mep|30th|sv|swsh|sm\d|sm1|smp|xy|bw|svp)/i;
const isFrRaw = (a) => (!a.grader || a.grader === 'raw') && a.lang === 'fr' && !!a.tcgdexId;
export function priceModeOf(kind, a) {
  if (kind !== 'card') return a.priceMode || 'manual';
  if (a.priceMode) return a.priceMode === 'fr' && !isFrRaw(a) ? 'auto' : a.priceMode;
  if (a.grader && a.grader !== 'raw') return 'auto';
  if (isFrRaw(a) && (!hasValue(a) || a.valueSource)) return 'fr';
  return a.tcgdexId && (!a.tcgLang || a.tcgLang === 'fr') && MODERN.test(a.tcgdexId) ? 'auto' : 'manual';
}
export const pendingPrices = () => state.cards.filter((c) => c.pendingValue);

// Cote France: the French market estimate (ebay.js) becomes the value of a card in that mode, from EST_MIN_VALUE
// fixed-price listings. The mode is written on the card so that the nightly server job (Cardmarket) leaves it alone.
function applyFr(c, est, count) {
  if (!c || priceModeOf('card', c) !== 'fr' || est == null || count < EST_MIN_VALUE) return false;
  if (c.priceMode === 'fr' && +c.value === est && c.valueSource === `eBay France · ${count} annonces`) return false;
  c.priceMode = 'fr';
  delete c.pendingValue;
  if (+c.value !== est) logValue(c, est);
  c.value = est;
  c.valueSource = `eBay France · ${count} annonces`;
  return true;
}
export function setFrValue(id, est, count) {
  if (applyFr(find('card', id), est, count)) commit();
}

// Every card in Cote France mode, twice a week: on Mondays and Thursdays (at the first opening of the app from that
// day on, so a missed day is caught up). Same for every user; the eBay quota is shared by all of them.
const FR_RUN_KEY = NS + '.frPriceRun';
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function lastFrSlot(now = new Date()) {
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    if (d.getDay() === 1 || d.getDay() === 4) return ymd(d);
  }
  return ymd(now);
}
let frRunning = null;
export async function refreshFrPrices({ force = false } = {}) {
  if (frRunning || !hasAccess()) return frRunning;
  let last = null;
  try { last = localStorage.getItem(FR_RUN_KEY); } catch { /* private mode */ }
  if (!force && last && last >= lastFrSlot()) return null;
  frRunning = (async () => {
    const cards = state.cards.filter((c) => priceModeOf('card', c) === 'fr');
    let updated = 0, errors = 0;
    for (let i = 0; i < cards.length; i += 3) {
      await Promise.all(cards.slice(i, i + 3).map(async (c) => {
        try {
          const r = await ebayListings(c, 'card');
          if (applyFr(find('card', c.id), r.est, r.estCount)) updated++;
        } catch { errors++; }
      }));
    }
    // A run that mostly failed (proxy down, quota reached) is tried again at the next opening.
    if (!cards.length || errors < cards.length / 2) { try { localStorage.setItem(FR_RUN_KEY, ymd(new Date())); } catch { /* private mode */ } }
    if (updated) commit();
    return { updated, errors };
  })();
  try { return await frRunning; } finally { frRunning = null; }
}

export async function refreshPrices() {
  const before = state.priceRun && state.priceRun.at;
  await server.refreshPrices();
  // The server needs about a minute; poll until its run is recorded.
  for (let i = 0; i < 24; i++) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const fresh = await server.load();
      if (fresh.priceRun && fresh.priceRun.at !== before) { state = { ...EMPTY(), ...fresh }; writeCache(); emit(); return fresh.priceRun; }
    } catch { /* retry */ }
  }
  throw new Error('La mise à jour prend plus de temps que prévu');
}

/* ---------- Invest watchlist ---------- */
export const watched = () => [...state.cards.map((a) => ['card', a]), ...state.items.map((a) => ['item', a])].filter(([, a]) => a.watch && a.watch.on);
export function setWatch(kind, id, patch) {
  const a = find(kind, id);
  if (!a) return;
  a.watch = { on: true, since: today(), target: null, ...(a.watch || {}), ...patch };
  commit();
}

/* ---------- Tracked sets (master sets, collections) ---------- */
export function setProgress(set) {
  const owned = new Map();
  state.cards.forEach((c) => { if (c.tcgdexId && set.cards.includes(c.tcgdexId)) owned.set(c.tcgdexId, [...(owned.get(c.tcgdexId) || []), c]); });
  const list = [...owned.values()].flat();
  return { owned, count: owned.size, total: set.cards.length, cost: list.reduce((s, c) => s + costOf(c), 0), value: list.reduce((s, c) => s + worthOf(c), 0) };
}
export function addSet(data) {
  const s = { ...data, id: uid('m'), addedAt: today() };
  state.sets.push(s);
  commit();
  return s;
}
export function removeSet(id) {
  state.sets = state.sets.filter((s) => s.id !== id);
  commit();
}

/* ---------- On-device price updates (no personal server) ----------
   Same rules as the server's nightly job, Cardmarket only (GCC and TCGplayer are not reachable from a
   browser): once a day, every card linked to the catalogue gets its day / 30-day average and trend; cards in
   automatic mode take the trend as their value (swings > 40 % are proposed for review instead). */
const LOCAL_RUN_KEY = NS + '.localPriceRun';
export async function refreshLocalPrices({ force = false, only = null } = {}) {
  if (settings.isServer() || !hasAccess()) return null;
  const day = today();
  let last = null;
  try { last = localStorage.getItem(LOCAL_RUN_KEY); } catch { /* private mode */ }
  if (!only && !force && last === day) return null;
  const cards = state.cards.filter((c) => c.tcgdexId && (!only || only.includes(c.id)));
  if (!cards.length) return null;
  const res = {};
  let errors = 0;
  for (let i = 0; i < cards.length; i += 4) {
    await Promise.all(cards.slice(i, i + 4).map(async (c) => {
      try {
        const card = await getCard(c.tcgLang || 'fr', c.tcgdexId);
        const vars = card.variants_detailed || [];
        let v = c.tcgdexVariant ? vars.find((x) => x.variantId === c.tcgdexVariant) : null;
        if (!v && /1(re|ère|st)?\s*[ée]d/i.test(c.variant || '')) v = vars.find((x) => (x.stamp || []).some((st) => /1re|1st|1ère/i.test(st)));
        const cm = (v && v.pricing && v.pricing.cardmarket) || (card.pricing && card.pricing.cardmarket);
        if (cm) res[c.id] = cm;
      } catch { errors++; }
    }));
  }
  const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
  const minus = (n) => { const d = new Date(Date.now() - n * 864e5); return d.toISOString().slice(0, 10); };
  let updated = 0, pending = 0;
  state.cards.forEach((c) => {
    const cm = res[c.id];
    if (!cm || (only && !only.includes(c.id))) return;
    const trend = r2(cm.trend || cm.avg), d30 = r2(cm.avg30);
    c.market = { src: 'Cardmarket', d1: r2(cm.avg1 != null ? cm.avg1 : cm.avg), d1At: day, d30, at: day };
    if (trend != null) {
      let h = (c.hist || []).filter((x) => x.d !== day);
      if (!h.length) h = [d30 != null && { d: minus(15), p: d30, est: true }, cm.avg7 != null && { d: minus(4), p: r2(cm.avg7), est: true }].filter(Boolean);
      h.push({ d: day, p: trend, a30: d30 });
      c.hist = h.slice(-400);
    }
    // Manual cards are never touched, except when no value was ever entered (nothing of the user's to overwrite).
    if (trend == null || (priceModeOf('card', c) !== 'auto' && hasValue(c))) return;
    const old = hasValue(c) ? +c.value : null;
    if (old && c.valueSource && Math.abs(trend - old) / old > 0.4) { c.pendingValue = { v: trend, src: 'Cardmarket · tendance', d: day }; pending++; return; }
    delete c.pendingValue;
    c.value = trend; c.valueSource = 'Cardmarket · tendance'; logValue(c, trend);
    updated++;
  });
  if (only) { commit(); return { updated, pending, errors }; }   // single-card refresh: keep the daily run untouched
  state.priceRun = { at: new Date().toISOString(), updated, pending, skipped: 0, errors, local: true };
  try { localStorage.setItem(LOCAL_RUN_KEY, day); } catch { /* private mode */ }
  commit();
  return state.priceRun;
}

/* ---------- Sealed products: TCGplayer market price (no server needed) ----------
   assets/data/sealed-prices.json is rebuilt daily by a GitHub Action (TCGplayer, USD). A sealed item linked to
   the catalogue gets its value from it the moment it is added, then once a day. Items whose value was typed by
   hand are never overwritten; items left in automatic mode follow the market. */
const SEALED_RUN_KEY = NS + '.sealedPriceRun';
let sealedPrices = null;
async function loadSealedPrices() {
  if (!sealedPrices) {
    sealedPrices = fetch(asset('assets/data/sealed-prices.json?t=' + today()))
      .then((r) => { if (!r.ok) throw new Error('prix indisponibles'); return r.json(); })
      .catch((e) => { sealedPrices = null; throw e; });
  }
  return sealedPrices;
}
// Price index (GCC French sales + Cardmarket + TCGplayer, see tools/build_market.py), rebuilt every night.
let sealedMarket = null;
async function loadSealedMarket() {
  if (!sealedMarket) {
    sealedMarket = fetch(asset('assets/data/sealed-market.json?t=' + today()))
      .then((r) => { if (!r.ok) throw new Error('cotes indisponibles'); return r.json(); })
      .catch((e) => { sealedMarket = null; throw e; });
  }
  return sealedMarket;
}
// Index row of one sealed product ({v, c, ...}) or null; used by the add form to suggest the market price.
export async function sealedMarketRow(id) {
  const mk = await loadSealedMarket();
  return (mk && mk.p && mk.p[id]) || null;
}
// Every index row, keyed by TCGplayer id ({} when the index is not built yet); used by the sealed catalogue.
export async function sealedMarketMap() {
  try { const mk = await loadSealedMarket(); return (mk && mk.p) || {}; } catch { return {}; }
}
async function usdToEur() {
  try { const c = JSON.parse(localStorage.getItem(NS + '.fx') || 'null'); if (c && c.d === today()) return c.r; } catch { /* ignore */ }
  let r = null;
  try { r = (await (await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR')).json()).rates.EUR; } catch { /* ignore */ }
  if (!r) { try { r = (await (await fetch('https://open.er-api.com/v6/latest/USD')).json()).rates.EUR; } catch { /* ignore */ } }
  if (r) { try { localStorage.setItem(NS + '.fx', JSON.stringify({ d: today(), r })); } catch { /* ignore */ } return r; }
  try { const c = JSON.parse(localStorage.getItem(NS + '.fx') || 'null'); if (c) return c.r; } catch { /* ignore */ }
  return 0.88;
}
export async function refreshSealedPrices({ only = null, force = false } = {}) {
  if (!hasAccess()) return null;
  const day = today();
  if (!only && !force) { try { if (localStorage.getItem(SEALED_RUN_KEY) === day) return null; } catch { /* ignore */ } }
  const items = state.items.filter((i) => i.tcgplayerId && (!only || only.includes(i.id)));
  if (!items.length) return null;
  let mk = null;
  try { mk = await loadSealedMarket(); } catch { /* index not built yet: TCGplayer only */ }
  if (!mk) return { updated: 0, error: true };
  let updated = 0;
  items.forEach((i) => {
    const r = mk && mk.p && mk.p[i.tcgplayerId];
    let eur, src;
    if (r) {
      // Price index: French sales (GCC) + Cardmarket + TCGplayer, outliers dropped, smoothed, with a confidence level.
      eur = r.v; src = 'Index';
      i.market = { src: 'Index', conf: r.c, srcs: r.s || {}, drop: r.x || [], n30: r.n || 0, d1: r.v, d1At: day, last: r.l || null,
        t30: r.t != null ? r.t : null, h: r.h || [], at: day };
      if ((r.h || []).length > 1) i.hist = r.h.map(([d, p]) => ({ d, p }));
    } else {
      // No reliable French/European source: no cote rather than a US TCGplayer price (it overstated French products).
      if (i.valueSource === 'TCGplayer' && (i.priceMode || 'manual') === 'auto') { i.value = null; i.valueSource = null; i.market = null; updated++; }
      return;
    }
    if (hasValue(i) && (i.priceMode || 'manual') !== 'auto' && !['TCGplayer', 'GCC', 'Index'].includes(i.valueSource)) return;   // typed by hand: keep
    i.value = eur; i.valueSource = src; i.priceMode = 'auto'; logValue(i, eur);
    updated++;
  });
  if (!only) { try { localStorage.setItem(SEALED_RUN_KEY, day); } catch { /* ignore */ } }
  commit();
  return { updated };
}

export function replaceAll(data) {
  state = { ...EMPTY(), ...data, rev: state.rev };
  commit();
}

let sig = '';
const connSig = (c) => [c.mode, c.server, c.key].join('|');
sig = connSig(settings.get());
settings.on((c) => { if (connSig(c) !== sig) { sig = connSig(c); load(); } });
