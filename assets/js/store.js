// Collection state, persistence (device or personal server) and portfolio maths.
import { settings } from './settings.js';
import { server, ServerError } from './api.js';
import { today, uid, toast, debounce } from './ui.js';

const CACHE_KEY = 'pdx.cache';
const LOCAL_KEY = 'pdx.local';
const EMPTY = () => ({ rev: 0, cards: [], items: [], sales: [], history: [] });

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
      const res = await server.save({ rev: state.rev, cards: state.cards, items: state.items, sales: state.sales });
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
const thumbUrl = (u) => (u && u.includes('assets.tcgdex.net') ? u.replace(/\/high\.webp$/, '/low.webp') : u);
export const imageOf = (a, { thumb = false } = {}) => photoUrl(a.photo) || (thumb ? thumbUrl(a.image) : a.image) || null;
export const officialImage = (a, { thumb = false } = {}) => (thumb ? thumbUrl(a.image) : a.image) || null;

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

export function replaceAll(data) {
  state = { ...EMPTY(), ...data, rev: state.rev };
  commit();
}

let sig = '';
const connSig = (c) => [c.mode, c.server, c.key].join('|');
sig = connSig(settings.get());
settings.on((c) => { if (connSig(c) !== sig) { sig = connSig(c); load(); } });
