import { store, portfolio, monthPerformers, salesSummary, series, imageOf, refreshPrices, pendingPrices } from '../store.js?v=2.3.0';
import { settings } from '../settings.js?v=2.3.0';
import { money, signed, pct, pill, icon, esc, trend, toast, dateFr } from '../ui.js?v=2.3.0';
import { renderChart, filterPeriod, PERIODS } from '../chart.js?v=2.3.0';
import { openDetail, openSales } from '../sheets.js?v=2.3.0';

let period = 'max';
let perfMode = 'eur';
let refreshing = false;

export function render(main) {
  const p = portfolio();
  const s = store.status();
  const empty = !store.get().cards.length && !store.get().items.length;

  main.innerHTML = `
  <div class="home-grid">
    <div>
      <section class="section panel hero">
        <div class="label">Valeur globale</div>
        <div class="big num">${money(p.value)}</div>
        <div class="kpis">
          <span class="kpi"><span class="k">Gain</span><b class="num ${trend(p.gain)}">${signed(p.gain)}</b>${p.pct != null ? pill(p.gain, pct(p.pct)) : ''}</span>
          <span class="kpi"><span class="k">Achat</span><b class="num">${money(p.cost)}</b></span>
        </div>
        <div class="chart" id="pf-chart"></div>
        <div class="chart-legend"><span>Valeur</span><span class="inv">Investi</span></div>
        <div class="periods">${PERIODS.map((x) => `<button data-period="${x.id}" class="${x.id === period ? 'on' : ''}">${x.label}</button>`).join('')}</div>
      </section>
      ${settings.isServer() ? priceRunHtml() : ''}
      ${s.error && !s.local ? `<div class="banner">${icon('info')}<div class="main">Hors ligne — affichage des dernières données connues.<br><small class="muted">${esc(s.error)}</small></div></div>` : ''}
      ${empty && !settings.isServer() ? `<div class="banner">${icon('server')}<div class="main"><b>Votre collection est sur votre serveur ?</b><br><small class="muted">Collez votre lien de connexion dans les réglages.</small></div><a class="btn sm primary" href="#/settings">Connecter</a></div>` : ''}
      ${empty ? `<div class="section empty"><div class="ico">${icon('sparkle', 'lg')}</div><h3>Bienvenue dans Pokédex Invest</h3>
        <p>Ajoutez votre première carte ou votre premier produit scellé pour suivre la valeur de votre collection.</p>
        <div class="btn-row" style="max-width:360px;margin:0 auto"><a class="btn" href="#/scan">${icon('scan')}Scanner</a><a class="btn primary" href="#/collection/cards?add=1">${icon('plus')}Ajouter</a></div></div>` : ''}

      <section class="section">
        <div class="section-head"><h2>Mes investissements</h2></div>
        <div class="duo">
          ${statTile('items', 'Items', icon('box'), p.items, 'item')}
          ${statTile('cards', 'Cartes', icon('cards'), p.cards, 'carte')}
        </div>
      </section>
    </div>

    <div>
      <section class="section">
        <div class="section-head"><h2>Top performances du mois</h2>
          <div class="seg small gold" style="width:94px">
            <button data-perf="eur" class="${perfMode === 'eur' ? 'on' : ''}">€</button>
            <button data-perf="pct" class="${perfMode === 'pct' ? 'on' : ''}">%</button>
          </div>
        </div>
        <div id="perf">${perfList()}</div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Historique des ventes</h2><button class="link" data-sales="all">Tout voir ${icon('chev', 'sm')}</button></div>
        <div class="duo">
          ${saleTile('item', 'Items vendus', icon('box'))}
          ${saleTile('card', 'Cartes vendues', icon('cards'))}
        </div>
      </section>
    </div>
  </div>`;

  drawChart(main);

  main.onclick = (e) => {
    const t = e.target.closest('[data-period],[data-perf],[data-open],[data-sales],[data-go],[data-refresh]');
    if (!t) return;
    if (t.dataset.period) { period = t.dataset.period; main.querySelectorAll('[data-period]').forEach((b) => b.classList.toggle('on', b === t)); drawChart(main); }
    if (t.dataset.perf) { perfMode = t.dataset.perf; main.querySelectorAll('[data-perf]').forEach((b) => b.classList.toggle('on', b === t)); main.querySelector('#perf').innerHTML = perfList(); }
    if (t.dataset.open) { const [kind, id] = t.dataset.open.split(':'); openDetail(kind, id); }
    if (t.dataset.sales) openSales(t.dataset.sales);
    if (t.dataset.go) location.hash = t.dataset.go;
    if ('refresh' in t.dataset && !refreshing) {
      refreshing = true;
      render(main);
      toast('Mise à jour des cotes lancée (environ 1 minute)');
      refreshPrices()
        .then((r) => toast(`Cotes à jour : ${r.updated} carte${r.updated > 1 ? 's' : ''}${r.pending ? `, ${r.pending} à valider` : ''}`))
        .catch((err) => toast(err.message, { error: true }))
        .finally(() => { refreshing = false; const m = document.querySelector('main.view'); if (m && location.hash.replace('#', '').replace('/', '') === '') render(m); });
    }
  };
}

function drawChart(main) {
  const el = main.querySelector('#pf-chart');
  if (!el) return;
  renderChart(el, filterPeriod(series(), period), [
    { key: 'invested', label: 'Investi', color: '#6e6d7a', dashed: true, step: true, width: 1.6, tipColor: '#a9a8b3' },
    { key: 'value', label: 'Valeur', color: '#e9b949', area: true, dot: true },
  ], { height: el.clientHeight || 190 });
}

function statTile(route, title, ico, t, unit) {
  const count = t.count;
  return `<button class="stat" data-go="#/collection/${route}">
    <div class="top"><span class="ico">${ico}</span>${icon('chev', 'sm faint')}</div>
    <div><div class="t">${title}</div><div class="v num">${money(t.value)}</div></div>
    <div class="s"><span>${count} ${unit}${count > 1 ? 's' : ''}</span><span class="num ${trend(t.gain)}" style="font-weight:700">${signed(t.gain)}</span></div>
  </button>`;
}

function saleTile(kind, title, ico) {
  const s = salesSummary(kind);
  return `<button class="stat" data-sales="${kind}">
    <div class="top"><span class="ico">${ico}</span>${icon('chev', 'sm faint')}</div>
    <div><div class="t">${title}</div><div class="v num">${s.count} vente${s.count > 1 ? 's' : ''}</div></div>
    <div class="s"><span>Résultat</span><span class="num ${trend(s.pnl)}" style="font-weight:700">${signed(s.pnl)}</span></div>
  </button>`;
}

function perfList() {
  const list = monthPerformers();
  if (!list.length) {
    return `<div class="empty" style="padding:22px">${icon('up', 'lg faint')}<p style="margin:8px 0 0">Aucune variation de valeur ce mois-ci.<br>Mettez à jour la valeur de vos cartes pour voir leurs performances.</p></div>`;
  }
  const key = perfMode === 'pct' ? (x) => x.pct ?? -Infinity : (x) => x.delta;
  const sorted = [...list].sort((a, b) => key(b) - key(a)).slice(0, 6);
  return `<div class="list">${sorted.map((x, i) => {
    const img = imageOf(x.a, { thumb: true });
    return `<button class="row" data-open="${x.kind}:${x.a.id}">
      <span class="rank">${i + 1}</span>
      ${img ? `<img class="thumb ${x.kind === 'item' ? 'sq' : ''}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb ${x.kind === 'item' ? 'sq' : ''}"></span>`}
      <span class="main"><b>${esc(x.a.name)}</b><small>${esc(x.a.set || x.a.category || '')}</small></span>
      <span class="end"><b class="num">${money(x.a.value * (x.a.qty || 1))}</b>
        ${pill(x.delta, perfMode === 'pct' ? pct(x.pct) : signed(x.delta))}</span>
    </button>`;
  }).join('')}</div>`;
}

function priceRunHtml() {
  const run = store.get().priceRun;
  const pend = pendingPrices();
  const when = run ? `${dateFr(run.at.slice(0, 10), false)} à ${new Date(run.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'jamais';
  return `<div class="price-run">
      <span class="muted">${icon('refresh', 'sm')} Cotes mises à jour : <b style="color:var(--text)">${when}</b>${run ? ` · ${run.updated} carte${run.updated > 1 ? 's' : ''}` : ''}</span>
      <button class="btn sm" data-refresh ${refreshing ? 'disabled' : ''}>${refreshing ? '<span class="spinner" style="width:14px;height:14px"></span>En cours…' : 'Mettre à jour'}</button>
    </div>
    ${pend.length ? `<div class="section" style="margin-top:14px"><div class="section-head"><h2>Cotes à valider</h2><span class="pill gold">${pend.length}</span></div>
      <div class="list">${pend.slice(0, 8).map((c) => `<button class="row" data-open="card:${c.id}">
        ${imageOf(c, { thumb: true }) ? `<img class="thumb" src="${esc(imageOf(c, { thumb: true }))}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
        <span class="main"><b>${esc(c.name)}</b><small>${money(c.value)} → ${money(c.pendingValue.v)} · ${esc(c.pendingValue.src)}</small></span>
        <span class="end">${pill(c.pendingValue.v - c.value, pct(((c.pendingValue.v - c.value) / c.value) * 100))}</span></button>`).join('')}</div></div>` : ''}`;
}
