import { store, totals, worthOf, gainOf, gainPct, costOf, imageOf, qtyOf } from '../store.js';
import { settings } from '../settings.js';
import { money, signed, pct, pill, icon, esc, flag, gradeLabel, LANGS, CATEGORIES, CATEGORY_ICON, openSheet, trend } from '../ui.js';
import { openDetail, openForm } from '../sheets.js';

const SORTS = {
  value: { label: 'Valeur', fn: (a, b) => worthOf(b) - worthOf(a) },
  gain: { label: 'Plus-value €', fn: (a, b) => gainOf(b) - gainOf(a) },
  gainPct: { label: 'Plus-value %', fn: (a, b) => (gainPct(b) ?? -1e9) - (gainPct(a) ?? -1e9) },
  recent: { label: 'Ajout récent', fn: (a, b) => String(b.buyDate || b.addedAt).localeCompare(String(a.buyDate || a.addedAt)) },
  name: { label: 'Nom', fn: (a, b) => a.name.localeCompare(b.name, 'fr') },
  set: { label: 'Extension', fn: (a, b) => String(a.set).localeCompare(String(b.set), 'fr') || String(a.num).localeCompare(String(b.num), 'fr', { numeric: true }) },
};

const filters = {
  card: { q: '', sort: 'value', langs: [], grade: 'all', set: '' },
  item: { q: '', sort: 'value', langs: [], status: 'all', set: '' },
};

const COLS = [2, 3, 4];

export function render(main, { tab = 'cards', query }) {
  const kind = tab === 'items' ? 'item' : 'card';
  const data = store.get();
  const f = filters[kind];
  const colsKey = kind === 'card' ? 'cardCols' : 'itemCols';
  const cols = settings.get()[colsKey];
  const activeFilters = f.langs.length + (f.set ? 1 : 0) + ((f.grade || f.status) !== 'all' ? 1 : 0);

  main.innerHTML = `
    <div class="seg" style="margin-top:4px">
      <button data-tab="cards" class="${kind === 'card' ? 'on' : ''}">Cartes · ${totals(data.cards).count}</button>
      <button data-tab="items" class="${kind === 'item' ? 'on' : ''}">Items · ${totals(data.items).count}</button>
    </div>
    <div class="toolbar">
      <label class="search">${icon('search', 'sm')}<input id="q" type="search" placeholder="${kind === 'card' ? 'Rechercher une carte…' : 'Rechercher un item…'}" value="${esc(f.q)}" autocomplete="off"></label>
      <button class="icon-btn" data-cols title="Taille de la grille">${icon('grid' + cols)}</button>
      <button class="icon-btn" data-filters title="Filtres">${icon('filter')}${activeFilters ? `<span class="badge">${activeFilters}</span>` : ''}</button>
    </div>
    <div id="results"></div>`;

  const draw = () => { main.querySelector('#results').innerHTML = kind === 'card' ? cardsHtml(cols) : itemsHtml(cols); };
  draw();

  const q = main.querySelector('#q');
  q.addEventListener('input', () => { f.q = q.value; draw(); });

  main.onclick = (e) => {
    const t = e.target.closest('[data-tab],[data-cols],[data-filters],[data-open],[data-add]');
    if (!t) return;
    if (t.dataset.tab) location.hash = '#/collection/' + t.dataset.tab;
    else if ('cols' in t.dataset) { settings.set({ [colsKey]: COLS[(COLS.indexOf(cols) + 1) % COLS.length] }); render(main, { tab }); }
    else if ('filters' in t.dataset) openFilters(kind, () => render(main, { tab }));
    else if (t.dataset.open) { const [k, id] = t.dataset.open.split(':'); openDetail(k, id); }
    else if (t.dataset.add) openForm(t.dataset.add);
  };

  if (query && query.get('add')) { history.replaceState(null, '', '#/collection/' + tab); openForm(kind); }
}

function applyFilters(kind, list) {
  const f = filters[kind];
  const q = f.q.trim().toLowerCase();
  return list.filter((a) => {
    if (q && ![a.name, a.set, a.num, a.category, a.note].join(' ').toLowerCase().includes(q)) return false;
    if (f.langs.length && !f.langs.includes(a.lang)) return false;
    if (f.set && a.set !== f.set) return false;
    if (kind === 'card' && f.grade === 'graded' && (!a.grader || a.grader === 'raw')) return false;
    if (kind === 'card' && f.grade === 'raw' && a.grader && a.grader !== 'raw') return false;
    if (kind === 'item' && f.status !== 'all' && (a.status || 'sealed') !== f.status) return false;
    return true;
  }).sort(SORTS[f.sort].fn);
}

function summary(list, unit) {
  const t = totals(list);
  return `<div class="summary-bar"><span><b class="num">${money(t.value)}</b> · ${t.count} ${unit}${t.count > 1 ? 's' : ''}</span>
    <span class="num ${trend(t.gain)}" style="font-weight:700">${signed(t.gain)}${t.pct != null ? ' · ' + pct(t.pct) : ''}</span></div>`;
}

function gainBadge(a) {
  const g = gainOf(a);
  if (!costOf(a)) return '';
  return pill(g, pct(gainPct(a)));
}

function emptyState(kind) {
  const filtered = filters[kind].q || filters[kind].langs.length || filters[kind].set;
  if (filtered) return `<div class="empty"><h3>Aucun résultat</h3><p>Modifiez la recherche ou les filtres.</p></div>`;
  return `<div class="empty"><div class="ico">${icon(kind === 'card' ? 'cards' : 'box', 'lg')}</div>
    <h3>${kind === 'card' ? 'Aucune carte' : 'Aucun item scellé'}</h3>
    <p>${kind === 'card' ? 'Scannez ou ajoutez vos cartes pour suivre leur valeur.' : 'Boosters, displays, ETB, coffrets… suivez vos produits scellés.'}</p>
    <div class="btn-row" style="max-width:340px;margin:0 auto">
      <a class="btn" href="#/scan">${icon('scan')}Scanner</a>
      <button class="btn primary" data-add="${kind}">${icon('plus')}Ajouter</button></div></div>`;
}

export function cardTile(a) {
  const img = imageOf(a, { thumb: true });
  const g = gradeLabel(a);
  return `<button class="tile" data-open="card:${a.id}">
    <div class="art">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="ph">${icon('image', 'lg')}</span>`}
      <span class="tl"><span class="chip">${flag(a.lang)}</span></span>
      ${g ? `<span class="tr"><span class="chip grade">${esc(g)}</span></span>` : ''}
      ${qtyOf(a) > 1 ? `<span class="br"><span class="chip qty">×${qtyOf(a)}</span></span>` : ''}
    </div>
    <div class="meta"><b>${esc(a.name)}</b><small>${esc([a.set, a.num].filter(Boolean).join(' · ') || '—')}</small>
      <div class="foot"><span class="val num">${money(worthOf(a))}</span>${gainBadge(a)}</div></div>
  </button>`;
}

function cardsHtml(cols) {
  const all = store.get().cards;
  const list = applyFilters('card', all);
  if (!list.length) return emptyState('card');
  return summary(list, 'carte') + `<div class="grid ${cols >= 4 ? 'dense' : ''}" style="--cols:${cols}">${list.map(cardTile).join('')}</div>`;
}

function itemTile(a) {
  const img = imageOf(a, { thumb: true });
  return `<button class="tile" data-open="item:${a.id}">
    <div class="art item-art">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="ph">${icon(CATEGORY_ICON[a.category] || 'box')}</span>`}
      <span class="tl"><span class="chip">${flag(a.lang)}</span></span>
      <span class="tr"><span class="chip qty">×${qtyOf(a)}</span></span>
      ${a.status === 'opened' ? '<span class="br"><span class="chip">Ouvert</span></span>' : ''}
    </div>
    <div class="meta"><b>${esc(a.name)}</b><small>${esc(a.set || a.category)}</small>
      <div class="foot"><span class="val num">${money(worthOf(a))}</span>${gainBadge(a)}</div></div>
  </button>`;
}

function itemsHtml(cols) {
  const list = applyFilters('item', store.get().items);
  if (!list.length) return emptyState('item');
  const groups = new Map();
  list.forEach((a) => {
    const c = CATEGORIES.includes(a.category) ? a.category : 'Autre';
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(a);
  });
  const ordered = [...groups.entries()].sort((a, b) => CATEGORIES.indexOf(a[0]) - CATEGORIES.indexOf(b[0]));
  return summary(list, 'item') + ordered.map(([cat, arr]) => {
    const t = totals(arr);
    return `<section class="group">
      <div class="group-head"><span class="gi">${icon(CATEGORY_ICON[cat] || 'box')}</span>
        <span class="gt"><b>${esc(cat)}</b><small>${t.count} item${t.count > 1 ? 's' : ''}</small></span>
        <span class="gv"><b class="num">${money(t.value)}</b><small class="num ${trend(t.gain)}" style="font-weight:700">${signed(t.gain)}</small></span></div>
      <div class="grid ${cols >= 4 ? 'dense' : ''}" style="--cols:${cols}">${arr.map(itemTile).join('')}</div>
    </section>`;
  }).join('');
}

function openFilters(kind, onApply) {
  const f = filters[kind];
  const list = kind === 'card' ? store.get().cards : store.get().items;
  const sets = [...new Set(list.map((a) => a.set).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const langs = [...new Set(list.map((a) => a.lang).filter(Boolean))];
  const draft = { ...f, langs: [...f.langs] };
  const s = openSheet({ title: 'Trier et filtrer' });
  const draw = () => s.render(`<div class="form">
    <div class="field"><span>Trier par</span><div class="chips">${Object.entries(SORTS).map(([k, v]) => `<button data-sort="${k}" class="${draft.sort === k ? 'on' : ''}">${v.label}</button>`).join('')}</div></div>
    ${langs.length > 1 ? `<div class="field"><span>Langue</span><div class="chips">${langs.map((l) => `<button data-lang="${l}" class="${draft.langs.includes(l) ? 'on' : ''}">${LANGS[l]?.flag || ''} ${esc(LANGS[l]?.label || l)}</button>`).join('')}</div></div>` : ''}
    ${kind === 'card'
      ? `<div class="field"><span>Gradation</span><div class="chips">${[['all', 'Toutes'], ['graded', 'Gradées'], ['raw', 'Non gradées']].map(([k, l]) => `<button data-grade="${k}" class="${draft.grade === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`
      : `<div class="field"><span>État</span><div class="chips">${[['all', 'Tous'], ['sealed', 'Scellés'], ['opened', 'Ouverts']].map(([k, l]) => `<button data-status="${k}" class="${draft.status === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`}
    ${sets.length ? `<label class="field"><span>Extension</span><select id="f-set"><option value="">Toutes les extensions</option>${sets.map((x) => `<option ${draft.set === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>` : ''}
    <div class="btn-row" style="margin-top:6px"><button class="btn" data-reset>Réinitialiser</button><button class="btn primary" data-apply>Appliquer</button></div>
  </div>`);
  draw();
  s.body.onclick = (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.sort) draft.sort = t.dataset.sort;
    if (t.dataset.lang) draft.langs = draft.langs.includes(t.dataset.lang) ? draft.langs.filter((x) => x !== t.dataset.lang) : [...draft.langs, t.dataset.lang];
    if (t.dataset.grade) draft.grade = t.dataset.grade;
    if (t.dataset.status) draft.status = t.dataset.status;
    const setSel = s.body.querySelector('#f-set');
    if (setSel) draft.set = setSel.value;
    if ('reset' in t.dataset) { Object.assign(f, { sort: 'value', langs: [], grade: 'all', status: 'all', set: '' }); s.close(); onApply(); return; }
    if ('apply' in t.dataset) { Object.assign(f, draft); s.close(); onApply(); return; }
    draw();
  };
}
