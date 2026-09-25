import { settings } from '../settings.js';
import { getSets, getSetCards, searchCards, cardImage, setLogo } from '../api.js';
import { esc, icon } from '../ui.js';
import { openCatalogueCard } from '../sheets.js';

const LANG_OPTIONS = [['fr', 'FR'], ['en', 'EN'], ['ja', 'JP']];
let q = '';
let seq = 0;

export function render(main, { tab, query }) {
  const lang = settings.get().catalogLang;
  const setId = query && query.get('set');
  main.innerHTML = `
    <div class="toolbar" style="margin-top:4px">
      <label class="search">${icon('search', 'sm')}<input id="cq" type="search" placeholder="Rechercher une carte (Dracaufeu, Pikachu…)" value="${esc(q)}" autocomplete="off"></label>
      <div class="seg small" style="width:132px">${LANG_OPTIONS.map(([k, l]) => `<button data-lang="${k}" class="${lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div id="cat-out"></div>`;
  const out = main.querySelector('#cat-out');
  const input = main.querySelector('#cq');

  const show = () => {
    if (q.trim().length >= 2) return showSearch(out, lang);
    if (setId) return showSet(out, lang, setId);
    return showSets(out, lang);
  };
  let t;
  input.addEventListener('input', () => { q = input.value; clearTimeout(t); t = setTimeout(show, 350); });
  main.onclick = (e) => {
    const b = e.target.closest('[data-lang],[data-card],[data-set],[data-back]');
    if (!b) return;
    if (b.dataset.lang) { settings.set({ catalogLang: b.dataset.lang }); render(main, { tab, query }); }
    if (b.dataset.card) openCatalogueCard(lang, b.dataset.card);
    if (b.dataset.set) location.hash = '#/catalogue?set=' + encodeURIComponent(b.dataset.set);
    if ('back' in b.dataset) location.hash = '#/catalogue';
  };
  show();
}

const cardGrid = (cards) => `<div class="grid" style="--cols:3">${cards.map((c) => `<button class="tile" data-card="${esc(c.id)}">
  <div class="art">${c.image ? `<img src="${esc(cardImage(c.image))}" alt="" loading="lazy">` : `<span class="ph">${icon('image')}</span>`}</div>
  <div class="meta"><b>${esc(c.name)}</b><small>${esc(c.setName ? c.setName + ' · ' : '')}${esc(c.localId)}</small></div></button>`).join('')}</div>`;

const loading = '<div class="loading"><div class="spinner"></div></div>';

async function showSearch(out, lang) {
  const my = ++seq;
  out.innerHTML = loading;
  try {
    const res = await searchCards(q, { lang });
    if (my !== seq) return;
    out.innerHTML = res.length
      ? `<div class="summary-bar"><span><b>${res.length}</b> carte${res.length > 1 ? 's' : ''}</span></div>${cardGrid(res.slice(0, 120))}`
      : '<div class="empty"><h3>Aucune carte trouvée</h3><p>Vérifiez l’orthographe ou changez de langue.</p></div>';
  } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}

async function showSets(out, lang) {
  const my = ++seq;
  out.innerHTML = loading;
  try {
    const sets = await getSets(lang);
    if (my !== seq) return;
    const bySerie = new Map();
    [...sets].sort((a, b) => b.serieOrder - a.serieOrder || b.idx - a.idx).forEach((s) => {
      if (!bySerie.has(s.serieName)) bySerie.set(s.serieName, []);
      bySerie.get(s.serieName).push(s);
    });
    out.innerHTML = [...bySerie.entries()].map(([serie, list]) => `<div class="serie-title">${esc(serie)}</div>
      <div class="set-list">${list.map((s) => `<button class="set-card" data-set="${esc(s.id)}">
        <span class="logo">${s.logo ? `<img src="${esc(setLogo(s.logo))}" alt="" loading="lazy">` : `<b>${esc(s.name)}</b>`}</span>
        <span><b>${esc(s.name)}</b><br><small>${s.cardCount?.official || s.cardCount?.total || '?'} cartes</small></span></button>`).join('')}</div>`).join('');
  } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}

async function showSet(out, lang, setId) {
  const my = ++seq;
  out.innerHTML = loading;
  try {
    const set = await getSetCards(lang, setId);
    if (my !== seq) return;
    out.innerHTML = `<button class="link" data-back style="display:flex;align-items:center;gap:4px;color:var(--text-2);margin-bottom:10px">${icon('back', 'sm')}Toutes les extensions</button>
      <div class="panel" style="display:flex;gap:14px;align-items:center;margin-bottom:14px">
        ${set.logo ? `<img src="${esc(setLogo(set.logo))}" alt="" style="height:48px;max-width:40%;object-fit:contain">` : ''}
        <div><b style="font-size:17px">${esc(set.name)}</b><br><small class="muted">${esc(set.serie?.name || '')} · ${set.cardCount?.official ?? '?'} cartes${set.releaseDate ? ' · ' + esc(set.releaseDate.slice(0, 4)) : ''}</small></div>
      </div>
      ${cardGrid((set.cards || []).map((c) => ({ ...c, setName: '' })))}`;
  } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}
