import { settings } from '../settings.js?v=2.4.0';
import { getSets, getSetCards, searchCards, cardImage, setLogo } from '../api.js?v=2.4.0';
import { esc, icon, toast, CATEGORIES, money } from '../ui.js?v=2.4.0';
import { store, addSet, sealedMarketMap } from '../store.js?v=2.4.0';
import { searchSealed, sealedImage, sealedPrefill } from '../sealed.js?v=2.4.0';
import { openCatalogueCard, openForm, openSetSheet, openSealedInfo } from '../sheets.js?v=2.4.0';

const LANG_OPTIONS = [['fr', 'FR'], ['en', 'EN'], ['ja', 'JP']];
let q = '';
let mode = 'cards';   // 'cards' | 'sealed'
let sealedCat = '';
let sealedGroup = 'type';   // 'type' | 'serie'
let seq = 0;
const openSeries = new Set();   // series left unfolded (kept when coming back from a set)

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
    const b = e.target.closest('[data-lang],[data-card],[data-set],[data-back],[data-mode],[data-sc],[data-sg],[data-sinfo],[data-sealed],[data-track],[data-tracked]');
    if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; q = ''; render(main, { tab, query }); return; }
    if ('sc' in b.dataset) { sealedCat = b.dataset.sc; show(); return; }
    if (b.dataset.sg) { sealedGroup = b.dataset.sg; show(); return; }
    if (b.dataset.sinfo) {
      const p = (out._sealed || []).find((x) => String(x.id) === b.dataset.sinfo);
      if (p) openSealedInfo(p);
      return;
    }
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
    out.innerHTML = [...bySerie.entries()].map(([serie, list]) => `<details class="serie-acc" data-serie="${esc(serie)}"${openSeries.has(serie) ? ' open' : ''}>
      <summary><span>${esc(serie)}<small>${list.length} extension${list.length > 1 ? 's' : ''}</small></span><span class="chev">${icon('chev')}</span></summary>
      <div class="set-list">${list.map((s) => `<button class="set-card" data-set="${esc(s.id)}">
        <span class="logo">${s.logo ? `<img src="${esc(setLogo(s.logo))}" alt="" loading="lazy">` : `<b>${esc(s.name)}</b>`}</span>
        <span><b>${esc(s.name)}</b><br><small>${s.cardCount?.official || s.cardCount?.total || '?'} cartes</small></span></button>`).join('')}</div></details>`).join('');
    out.querySelectorAll('details.serie-acc').forEach((d) => d.addEventListener('toggle', () => { d.open ? openSeries.add(d.dataset.serie) : openSeries.delete(d.dataset.serie); }));
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
    const [res, mk] = await Promise.all([searchSealed(q, sealedCat), sealedMarketMap()]);
    if (my !== seq) return;
    out._sealed = res;
    const card = (p) => {
      const r = mk[p.id];
      const t = r && r.t != null ? r.t : null;
      const tr = t == null ? '' : `<span class="trend-tag ${t > 0.03 ? 'up' : t < -0.03 ? 'down' : 'flat'}">${t > 0.03 ? '↗' : t < -0.03 ? '↘' : '→'} ${(t * 100 > 0 ? '+' : '') + (t * 100).toFixed(1).replace('.', ',')} %</span>`;
      return `<div class="pcard"><button class="pimg" data-sinfo="${p.id}"><img src="${esc(sealedImage(p.id, 200))}" alt="" loading="lazy"></button>
        <b>${esc(p.n)}</b><small>${esc(p.c)}</small>
        <div class="pprice">${r ? `<span class="num">${money(r.v)}</span>${tr}` : '<span class="faint">Pas de cote</span>'}</div>
        <div class="pbtns"><button data-sealed="${p.id}">+ Portefeuille</button><button data-sinfo="${p.id}">Détails ›</button></div></div>`;
    };
    const list = res.slice(0, 150);
    let body;
    if (!list.length) body = '<div class="empty"><h3>Aucun produit</h3><p>Essayez un autre nom.</p></div>';
    else if (sealedGroup === 'serie') {
      const groups = new Map();
      list.forEach((p) => { const k = p.s || 'Autres'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
      body = [...groups.entries()].map(([k, arr]) => `<div class="pgroup"><h4>${esc(k)}<small>${arr.length}</small></h4><div class="pgrid">${arr.map(card).join('')}</div></div>`).join('');
    } else body = `<div class="pgrid">${list.map(card).join('')}</div>`;
    out.innerHTML = `<div class="seg small" style="margin-bottom:10px"><button data-sg="type" class="${sealedGroup === 'type' ? 'on' : ''}">Par type</button><button data-sg="serie" class="${sealedGroup === 'serie' ? 'on' : ''}">Par série</button></div>
      ${sealedGroup === 'type' ? `<div class="chips scroll" style="margin-bottom:12px"><button data-sc="" class="${!sealedCat ? 'on' : ''}">Tous</button>${CATEGORIES.filter((c) => !['Accessoire', 'Autre'].includes(c)).map((c) => `<button data-sc="${c}" class="${sealedCat === c ? 'on' : ''}">${c}</button>`).join('')}</div>` : ''}
      ${body}`;
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
