import { settings } from '../settings.js?v=2.3.4';
import { getSets, getSetCards, searchCards, cardImage, setLogo } from '../api.js?v=2.3.4';
import { esc, icon, toast, CATEGORIES } from '../ui.js?v=2.3.4';
import { store, addSet } from '../store.js?v=2.3.4';
import { searchSealed, sealedImage, sealedPrefill } from '../sealed.js?v=2.3.4';
import { openCatalogueCard, openForm, openSetSheet } from '../sheets.js?v=2.3.4';

const LANG_OPTIONS = [['fr', 'FR'], ['en', 'EN'], ['ja', 'JP']];
let q = '';
let mode = 'cards';   // 'cards' | 'sealed'
let sealedCat = '';
let seq = 0;

export function render(main, { tab, query }) {
  const lang = settings.get().catalogLang;
  const setId = query && query.get('set');
  main.innerHTML = `
    <div class="seg" style="margin-top:4px">
      <button data-mode="cards" class="${mode === 'cards' ? 'on' : ''}">Cartes</button>
      <button data-mode="sealed" class="${mode === 'sealed' ? 'on' : ''}">Produits scellés</button>
    </div>
    <div class="toolbar">
      <label class="search">${icon('search', 'sm')}<input id="cq" type="search" placeholder="${mode === 'sealed' ? 'Display 151, ETB Évolutions…' : 'Rechercher une carte (Dracaufeu, Pikachu…)'}" value="${esc(q)}" autocomplete="off"></label>
      <div class="seg small ${mode === 'sealed' ? 'hidden' : ''}" style="width:132px">${LANG_OPTIONS.map(([k, l]) => `<button data-lang="${k}" class="${lang === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <div id="cat-out"></div>`;
  const out = main.querySelector('#cat-out');
  const input = main.querySelector('#cq');

  const show = () => {
    if (mode === 'sealed') return showSealed(out);
    if (q.trim().length >= 2) return showSearch(out, lang);
    if (setId) return showSet(out, lang, setId);
    return showSets(out, lang);
  };
  let t;
  input.addEventListener('input', () => { q = input.value; clearTimeout(t); t = setTimeout(show, 350); });
  main.onclick = (e) => {
    const b = e.target.closest('[data-lang],[data-card],[data-set],[data-back],[data-mode],[data-sc],[data-sealed],[data-track],[data-tracked]');
    if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; q = ''; render(main, { tab, query }); return; }
    if ('sc' in b.dataset) { sealedCat = b.dataset.sc; show(); return; }
    if (b.dataset.sealed) {
      const p = (out._sealed || []).find((x) => String(x.id) === b.dataset.sealed);
      if (p) openForm('item', null, sealedPrefill(p));
      return;
    }
    if (b.dataset.track) { trackSet(lang, b.dataset.track); return; }
    if (b.dataset.tracked) { openSetSheet(b.dataset.tracked); return; }
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
      ${(() => {
        const ids = (set.cards || []).map((c) => c.id).join('|');
        const t = store.get().sets.find((s) => s.cards.join('|') === ids);
        return t
          ? `<button class="btn block" data-tracked="${t.id}" style="margin-bottom:14px">${icon('check')}Set suivi — voir ma progression</button>`
          : `<button class="btn primary block" data-track="${esc(set.id)}" style="margin-bottom:14px">${icon('plus')}Suivre ce set</button>`;
      })()}
      ${cardGrid((set.cards || []).map((c) => ({ ...c, setName: '' })))}`;
  } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}

async function showSealed(out) {
  const my = ++seq;
  out.innerHTML = loading;
  try {
    const res = await searchSealed(q, sealedCat);
    if (my !== seq) return;
    out._sealed = res;
    out.innerHTML = `<div class="chips scroll" style="margin-bottom:12px"><button data-sc="" class="${!sealedCat ? 'on' : ''}">Tous</button>${CATEGORIES.filter((c) => !['Accessoire', 'Autre'].includes(c)).map((c) => `<button data-sc="${c}" class="${sealedCat === c ? 'on' : ''}">${c}</button>`).join('')}</div>
      ${res.length ? `<div class="grid" style="--cols:3">${res.slice(0, 150).map((p) => `<button class="tile" data-sealed="${p.id}">
        <div class="art item-art cat"><img src="${esc(sealedImage(p.id, 200))}" alt="" loading="lazy"></div>
        <div class="meta"><b>${esc(p.s)}</b><small>${esc(p.n)}</small></div></button>`).join('')}</div>`
        : '<div class="empty"><h3>Aucun produit</h3><p>Essayez un autre nom.</p></div>'}`;
  } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}

async function trackSet(lang, setId) {
  try {
    const set = await getSetCards(lang, setId);
    const t = addSet({ name: set.name, description: [set.serie?.name, set.releaseDate?.slice(0, 4)].filter(Boolean).join(' · '),
      lang: lang === 'ja' ? 'jp' : lang, cards: (set.cards || []).map((c) => c.id) });
    toast('Set suivi');
    openSetSheet(t.id);
  } catch (e) { toast(e.message, { error: true }); }
}
