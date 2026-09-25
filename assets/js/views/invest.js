// Invest: watchlist of cards/items to resell, trend curves and sell signals.
import { store, watched, setWatch, unitValue, unitCost, qtyOf, imageOf, priceModeOf } from '../store.js?v=2.3.2';
import { money, signed, pct, pill, icon, esc, dateFr, openSheet, toast, trend } from '../ui.js?v=2.3.2';
import { renderChart, sparkline, filterPeriod, PERIODS } from '../chart.js?v=2.3.2';
import { openDetail, openSell } from '../sheets.js?v=2.3.2';

const DAY = 864e5;
const STATUS = {
  sell: { label: 'Vendre', cls: 'up', hint: 'Bon moment pour vendre' },
  watch: { label: 'Surveiller', cls: 'gold', hint: 'Signes favorables, à suivre' },
  wait: { label: 'Attendre', cls: 'flat', hint: 'Pas le bon moment' },
};

/* ---------- Analysis ---------- */
// Price points for the curve: GCC real sales for graded cards, nightly history otherwise.
function pointsOf(a) {
  const m = a.market || {};
  if (m.src === 'GCC' && (m.sales || []).length) {
    return [...m.sales].reverse().map((s) => ({ d: s.d, p: s.v }));
  }
  return (a.hist || []).map((h) => ({ d: h.d, p: h.p, a30: h.a30, est: h.est }));
}
// Price about `days` ago: last point on/before that day, else the earliest point available.
const valueAgo = (pts, days) => {
  if (!pts.length) return null;
  const limit = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const before = pts.filter((x) => x.d <= limit);
  return before.length ? before[before.length - 1].p : pts[0].p;
};
// Market signals only make sense where the market price is reliable (auto-priced cards, sealed items).
const tracked = (kind, a) => kind === 'item' || priceModeOf(kind, a) === 'auto';

export function analyse(kind, a) {
  const pts = pointsOf(a);
  const m = a.market || {};
  const price = pts.length ? pts[pts.length - 1].p : unitValue(a);
  const a30 = m.d30 != null ? m.d30 : null;
  const buy = unitCost(a);
  const target = a.watch && a.watch.target ? +a.watch.target : null;
  const since30 = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const last30 = pts.filter((x) => x.d >= since30).map((x) => x.p);
  const hi30 = last30.length ? Math.max(...last30) : null;
  const lo30 = last30.length ? Math.min(...last30) : null;
  const prev = pts.slice(0, -1);
  const p7 = valueAgo(prev, 7), p30 = valueAgo(prev, 30);
  const ch7 = p7 ? (price - p7) / p7 : null;
  const ch30 = p30 ? (price - p30) / p30 : null;
  const reasons = [];
  let score = 0;
  if (target && price >= target) { score += 3; reasons.push(['up', `Objectif atteint (${money(target)})`]); }
  if (a30 && price >= a30 * 1.15) { score += 2; reasons.push(['up', `Au-dessus de sa moyenne 30 j (${pct(((price - a30) / a30) * 100)})`]); }
  if (a30 && price <= a30 * 0.9) { score -= 1; reasons.push(['down', `Sous sa moyenne 30 j (${pct(((price - a30) / a30) * 100)})`]); }
  if (last30.length >= 4 && hi30 != null && price >= hi30) { score += 1; reasons.push(['up', 'Plus haut des 30 derniers jours']); }
  if (buy > 0 && price >= buy * 1.5) { score += 1; reasons.push(['up', `Plus-value de ${pct(((price - buy) / buy) * 100)} sur l’achat`]); }
  if (ch7 != null && ch7 <= -0.1) { score -= 1; reasons.push(['down', `En baisse sur 7 jours (${pct(ch7 * 100)})`]); }
  if (ch7 != null && ch7 >= 0.1) { score += 1; reasons.push(['up', `En hausse sur 7 jours (${pct(ch7 * 100)})`]); }
  const status = score >= 3 ? 'sell' : score >= 1 ? 'watch' : 'wait';
  return { kind, a, pts, price, a30, buy, target, hi30, lo30, ch7, ch30, score, status, reasons,
    gain: (price - buy) * qtyOf(a), gainPct: buy > 0 ? ((price - buy) / buy) * 100 : null };
}

/* ---------- Rise alerts (badge on the Invest tab) ---------- */
const RISE = 0.10;
const SEEN_KEY = 'pdx.seenRises';
const allAssets = () => [...store.get().cards.map((a) => ['card', a]), ...store.get().items.map((a) => ['item', a])];
// Real readings only (estimated seed points never trigger an alert): latest vs ~7 days earlier.
export function riseAlerts() {
  const out = [];
  allAssets().forEach(([kind, a]) => {
    if (!tracked(kind, a)) return;
    const pts = pointsOf(a).filter((p) => !p.est && p.p > 0);
    if (pts.length < 2) return;
    const last = pts[pts.length - 1];
    const ref = valueAgo(pts.slice(0, -1), 7);
    if (!ref) return;
    const ch = (last.p - ref) / ref;
    if (ch >= RISE) out.push({ kind, a, ch, from: ref, to: last.p, key: `${a.id}:${last.d}` });
  });
  return out.sort((x, y) => y.ch - x.ch);
}
const seenKeys = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch { return new Set(); } };
export const unseenRises = () => { const seen = seenKeys(); return riseAlerts().filter((x) => !seen.has(x.key)); };
function markRisesSeen(alerts) {
  const seen = seenKeys();
  alerts.forEach((x) => seen.add(x.key));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500))); } catch { /* private mode */ }
}

/* ---------- View ---------- */
export function render(main) {
  const list = watched().map(([k, a]) => analyse(k, a)).sort((x, y) => y.score - x.score || y.gain - x.gain);
  const total = list.reduce((s, x) => s + x.price * qtyOf(x.a), 0);
  const gain = list.reduce((s, x) => s + x.gain, 0);
  const counts = { sell: 0, watch: 0, wait: 0 };
  list.forEach((x) => { counts[x.status]++; });
  const ideas = suggestions(list);
  const rises = riseAlerts();
  const fresh = new Set(unseenRises().map((x) => x.key));

  main.innerHTML = `
    <section class="section panel hero" style="margin-top:6px">
      <div class="label">Valeur en veille</div>
      <div class="big num">${money(total)}</div>
      <div class="kpis">
        <span class="kpi"><span class="k">Plus-value potentielle</span><b class="num ${trend(gain)}">${signed(gain)}</b></span>
        <span class="kpi"><span class="k">En veille</span><b class="num">${list.length}</b></span>
      </div>
      <div class="status-row">
        ${Object.entries(STATUS).map(([k, s]) => `<div class="status-tile ${s.cls}"><b class="num">${counts[k]}</b><span>${s.label}</span></div>`).join('')}
      </div>
    </section>

    ${rises.length ? `<section class="section">
      <div class="section-head"><h2>Hausses ≥ 10 %</h2><span class="pill up">${rises.length}</span></div>
      <div class="list">${rises.slice(0, 10).map((r) => {
        const img = imageOf(r.a, { thumb: true });
        return `<button class="row" data-inv="${r.kind}:${r.a.id}">
          ${img ? `<img class="thumb ${r.kind === 'item' ? 'sq' : ''}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb"></span>`}
          <span class="main"><b>${esc(r.a.name)}${fresh.has(r.key) ? ' <span class="pill gold" style="margin-left:4px">Nouveau</span>' : ''}</b><small>${money(r.from)} → ${money(r.to)} en 7 jours${r.a.watch && r.a.watch.on ? ' · en veille' : ''}</small></span>
          <span class="end">${pill(r.ch, pct(r.ch * 100))}</span></button>`;
      }).join('')}</div>
    </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>Meilleurs moments pour vendre</h2><button class="btn sm primary" data-add>${icon('plus', 'sm')}Ajouter</button></div>
      ${list.length ? `<div class="list">${list.map(rowHtml).join('')}</div>`
        : `<div class="empty"><div class="ico">${icon('up', 'lg')}</div><h3>Aucune carte en veille</h3>
          <p>Mettez en veille les cartes et items que vous envisagez de revendre : l’appli suit leur prix chaque nuit et vous signale le bon moment.</p>
          <button class="btn primary" data-add>${icon('plus')}Choisir dans ma collection</button></div>`}
    </section>

    ${ideas.length ? `<section class="section">
      <div class="section-head"><h2>Tendances dans ma collection</h2><span class="faint" style="font-size:12px">hors veille</span></div>
      <div class="list">${ideas.map((x) => rowHtml(x, true)).join('')}</div>
    </section>` : ''}

    <p class="note" style="text-align:center;margin-top:18px">Une pastille apparaît sur l’onglet Invest dès qu’une carte ou un item prend au moins 10 % en 7 jours.<br>Signaux calculés chaque nuit à partir du prix du marché (Cardmarket, GCC, TCGplayer) et de votre prix d’achat. Ce ne sont pas des conseils financiers.</p>`;

  // Opening the tab acknowledges the current rises (the badge clears).
  markRisesSeen(rises);
  window.dispatchEvent(new Event('pdx:badge'));

  main.onclick = (e) => {
    const t = e.target.closest('[data-add],[data-inv],[data-quickwatch]');
    if (!t) return;
    if ('add' in t.dataset) openPicker();
    if (t.dataset.quickwatch) { const [k, id] = t.dataset.quickwatch.split(':'); setWatch(k, id, { on: true }); toast('Mis en veille'); }
    else if (t.dataset.inv) { const [k, id] = t.dataset.inv.split(':'); openInvest(k, id); }
  };
}

// Owned assets not yet watched whose signal looks good.
function suggestions(list) {
  const watchedIds = new Set(list.map((x) => x.a.id));
  const all = [...store.get().cards.map((a) => ['card', a]), ...store.get().items.map((a) => ['item', a])];
  return all.filter(([k, a]) => !watchedIds.has(a.id) && (a.hist || a.market) && tracked(k, a))
    .map(([k, a]) => analyse(k, a)).filter((x) => x.score >= 2 && x.price >= 2)
    .sort((x, y) => y.score - x.score || y.gain - x.gain).slice(0, 5);
}

function rowHtml(x, suggestion = false) {
  const img = imageOf(x.a, { thumb: true });
  const st = STATUS[x.status];
  const color = x.ch30 == null ? '#e9b949' : x.ch30 >= 0 ? '#34d399' : '#f87171';
  return `<button class="row inv-row" data-inv="${x.kind}:${x.a.id}">
    ${img ? `<img class="thumb ${x.kind === 'item' ? 'sq' : ''}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb ${x.kind === 'item' ? 'sq' : ''}"></span>`}
    <span class="main"><b>${esc(x.a.name)}</b><small>${esc(x.reasons[0] ? x.reasons[0][1] : x.a.set || x.a.category || '')}</small></span>
    <span class="spark-wrap">${sparkline(x.pts.map((p) => p.p), { color })}</span>
    <span class="end"><b class="num">${money(x.price)}</b>${suggestion
      ? `<span class="pill gold" data-quickwatch="${x.kind}:${x.a.id}">+ Veille</span>`
      : `<span class="pill ${st.cls}">${st.label}</span>`}</span>
  </button>`;
}

/* ---------- Watch detail ---------- */
let period = 'max';
export function openInvest(kind, id) {
  const sheet = openSheet({ title: 'Invest', full: true, onClose: () => off() });
  const off = store.on(() => draw());
  function draw() {
    const a = (kind === 'card' ? store.get().cards : store.get().items).find((x) => x.id === id);
    if (!a) { sheet.close(); return; }
    const x = analyse(kind, a);
    const st = STATUS[x.status];
    const on = a.watch && a.watch.on;
    const gcc = a.market && a.market.src === 'GCC';
    sheet.setTitle(a.name);
    sheet.render(`
      <div class="inv-head">
        <div><div class="faint" style="font-size:12px;font-weight:800">${gcc ? 'DERNIÈRE VENTE GCC' : 'PRIX DU MARCHÉ'}</div>
          <div class="v num">${money(x.price)}</div>
          <div class="kpis">${x.ch7 != null ? pill(x.ch7, '7 j ' + pct(x.ch7 * 100)) : ''}${x.ch30 != null ? pill(x.ch30, '30 j ' + pct(x.ch30 * 100)) : ''}</div></div>
        <div class="verdict ${st.cls}"><b>${st.label}</b><small>${st.hint}</small></div>
      </div>

      <div class="panel" style="padding:10px 12px;margin-top:14px">
        <div class="chart" id="inv-chart" style="height:220px"></div>
        <div class="chart-legend"><span>${gcc ? 'Ventes GCC' : 'Prix'}</span>${x.a30 ? '<span class="inv">Moyenne 30 j</span>' : ''}${x.target ? '<span class="tgt">Objectif</span>' : ''}<span class="buy">Achat</span></div>
        <div class="periods">${PERIODS.map((p) => `<button data-period="${p.id}" class="${p.id === period ? 'on' : ''}">${p.label}</button>`).join('')}</div>
      </div>
      ${x.pts.some((p) => p.est) ? '<p class="note">Les premiers points sont estimés à partir des moyennes Cardmarket ; la courbe se précise chaque nuit.</p>' : ''}

      <div class="section" style="margin-top:16px"><div class="kv">
        <div><small>Achat unitaire</small><b class="num">${money(x.buy)}</b></div>
        <div><small>Plus-value</small><b class="num ${trend(x.gain)}">${signed(x.gain)}${x.gainPct != null ? ` · ${pct(x.gainPct)}` : ''}</b></div>
        <div><small>Moyenne 30 j</small><b class="num">${money(x.a30)}</b></div>
        <div><small>Plus haut / bas 30 j</small><b class="num">${x.hi30 != null ? `${money(x.hi30)} / ${money(x.lo30)}` : '—'}</b></div>
      </div></div>

      ${x.reasons.length ? `<div class="section"><div class="section-head"><h2>Signaux</h2></div>
        <div class="list">${x.reasons.map(([t, r]) => `<div class="row"><span class="${t === 'up' ? 'up' : 'down'}">${icon(t === 'up' ? 'up' : 'down')}</span><span class="main"><b style="font-weight:600;white-space:normal">${esc(r)}</b></span></div>`).join('')}</div></div>` : ''}

      <div class="section">
        <div class="section-head"><h2>Objectif de revente</h2></div>
        <form class="quick-value" data-target>
          <label class="field"><div class="suffix" data-suffix="€"><input name="target" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Prix unitaire visé" value="${x.target != null ? x.target : ''}"></div></label>
          <button class="btn primary" type="submit">${icon('check')}${on ? 'Enregistrer' : 'Mettre en veille'}</button>
        </form>
        <p class="note">Quand le prix du marché atteint l’objectif, la carte passe en « Vendre ».</p>
      </div>

      <div class="sticky-actions"><div class="btn-row">
        <button class="btn" data-full>${icon('cards')}Fiche</button>
        <button class="btn primary" data-sell>${icon('tag')}Vendre</button>
        <button class="btn ${on ? 'danger' : ''}" data-toggle>${on ? 'Retirer' : '+ Veille'}</button>
      </div></div>`);

    const el = sheet.body.querySelector('#inv-chart');
    const pts = filterPeriod(x.pts.map((p) => ({ d: p.d, price: p.p, avg: p.a30 != null ? p.a30 : null, target: x.target, buy: x.buy || null })), period);
    renderChart(el, pts, [
      { key: 'buy', label: 'Achat', color: '#6e6d7a', dashed: true, width: 1.2 },
      ...(x.target ? [{ key: 'target', label: 'Objectif', color: '#34d399', dashed: true, width: 1.4 }] : []),
      ...(x.a30 ? [{ key: 'avg', label: 'Moy. 30 j', color: '#a9a8b3', dashed: true, width: 1.4 }] : []),
      { key: 'price', label: gcc ? 'Vente' : 'Prix', color: '#e9b949', area: true, dot: true },
    ], { height: 220 });
  }
  sheet.body.addEventListener('click', (e) => {
    const t = e.target.closest('[data-period],[data-full],[data-sell],[data-toggle]');
    if (!t) return;
    const a = (kind === 'card' ? store.get().cards : store.get().items).find((x) => x.id === id);
    if (t.dataset.period) { period = t.dataset.period; draw(); }
    if ('full' in t.dataset) openDetail(kind, id);
    if ('sell' in t.dataset) openSell(kind, a);
    if ('toggle' in t.dataset) {
      const on = a.watch && a.watch.on;
      setWatch(kind, id, { on: !on });
      toast(on ? 'Retiré de la veille' : 'Mis en veille');
    }
  });
  sheet.body.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.target.value;
    setWatch(kind, id, { on: true, target: v === '' ? null : +(+v).toFixed(2) });
    toast('Objectif enregistré');
  });
  draw();
}

/* ---------- Picker: choose assets to watch ---------- */
export function openPicker() {
  const sheet = openSheet({ title: 'Mettre en veille', full: true, onClose: () => off() });
  let q = '';
  const off = store.on(() => draw());
  sheet.render(`<label class="search" style="margin-bottom:12px">${icon('search', 'sm')}<input id="wq" type="search" placeholder="Rechercher dans ma collection" autocomplete="off"></label><div id="wl"></div>`);
  const out = sheet.body.querySelector('#wl');
  function draw() {
    const f = q.trim().toLowerCase();
    const all = [...store.get().cards.map((a) => ['card', a]), ...store.get().items.map((a) => ['item', a])]
      .filter(([, a]) => !f || [a.name, a.set, a.num, a.category].join(' ').toLowerCase().includes(f))
      .map(([k, a]) => analyse(k, a))
      .sort((x, y) => (y.price * qtyOf(y.a)) - (x.price * qtyOf(x.a)));
    out.innerHTML = `<div class="list">${all.slice(0, 120).map((x) => {
      const on = x.a.watch && x.a.watch.on;
      const img = imageOf(x.a, { thumb: true });
      return `<button class="row" data-w="${x.kind}:${x.a.id}">
        ${img ? `<img class="thumb ${x.kind === 'item' ? 'sq' : ''}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb"></span>`}
        <span class="main"><b>${esc(x.a.name)}</b><small>${esc([x.a.set || x.a.category, x.a.num].filter(Boolean).join(' · '))} · ${money(x.price)}</small></span>
        <span class="end"><span class="pill ${on ? 'up' : 'flat'}">${on ? '✓ En veille' : '+ Veille'}</span></span></button>`;
    }).join('')}</div>`;
  }
  sheet.body.querySelector('#wq').addEventListener('input', (e) => { q = e.target.value; draw(); });
  out.addEventListener('click', (e) => {
    const b = e.target.closest('[data-w]');
    if (!b) return;
    const [k, id] = b.dataset.w.split(':');
    const a = (k === 'card' ? store.get().cards : store.get().items).find((x) => x.id === id);
    setWatch(k, id, { on: !(a.watch && a.watch.on) });
  });
  draw();
}
