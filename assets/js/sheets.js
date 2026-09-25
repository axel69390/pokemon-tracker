// Modal sheets: asset detail, add/edit form, sell, sales history, catalogue card & picker.
import {
  store, find, addAsset, updateAsset, removeAsset, priceModeOf, sellAsset, deleteSale, savePhoto, photoUrl, imageOf, officialImage, setProgress, removeSet,
  worthOf, gainOf, gainPct, costOf, unitCost, unitValue, qtyOf, hasValue, salesSummary, saleRevenue, salePnl,
} from './store.js?v=2.2.2';
import {
  esc, money, signed, pct, pill, icon, flag, dateFr, today, toast, openSheet, confirmSheet, lightbox, resizeImage, pickImage,
  LANGS, GRADERS, CONDITIONS, CATEGORIES, CATEGORY_ICON, gradeLabel, trend, attachSuggest,
} from './ui.js?v=2.2.2';
import { searchSealed, sealedImage, sealedPrefill } from './sealed.js?v=2.2.2';
import { getCard, getSetCards, searchCards, priceVariants, links, tcgLang, cardImage, server } from './api.js?v=2.2.2';
import { settings } from './settings.js?v=2.2.2';
import { renderChart } from './chart.js?v=2.2.2';

const PLATFORMS = ['Vinted', 'eBay', 'Cardmarket', 'Leboncoin', 'Main propre', 'Autre'];
const VARIANTS = ['Normale', 'Holo', 'Reverse', '1ère édition', 'Shadowless', 'Promo', 'Alternative', 'Full Art', 'Gold'];
const appLang = (l) => (l === 'ja' ? 'jp' : l);

/* ======================================================================
   Detail
   ====================================================================== */
export function openDetail(kind, id) {
  let showOfficial = false;
  let market = null;             // { loading, error, variants, selected }
  let gcc = null;                // { loading, error, sales, scope, edition }
  const sheet = openSheet({ title: kind === 'card' ? 'Carte' : 'Item', full: true, onClose: () => off() });
  const off = store.on(() => draw());

  function draw() {
    const a = find(kind, id);
    if (!a) { sheet.close(); return; }
    sheet.setTitle(a.name);
    const photo = photoUrl(a.photo);
    const official = officialImage(a);
    const img = showOfficial ? official : photo || official;
    const g = gradeLabel(a);
    const gain = gainOf(a);
    const sq = kind === 'item';

    sheet.render(`
      <div class="detail-hero">
        <div class="art ${sq ? 'sq' : ''} ${sq && img && img === official ? 'cat' : ''}">
          ${img ? `<img src="${esc(img)}" alt="" data-zoom>` : `<span class="ph" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--text-3)">${icon(sq ? CATEGORY_ICON[a.category] || 'box' : 'image', 'lg')}</span>`}
          ${photo && official ? `<button class="icon-btn swap" data-swap title="${showOfficial ? 'Voir ma photo' : 'Voir le visuel officiel'}" style="width:32px;height:32px">${icon('swap', 'sm')}</button>` : ''}
        </div>
        <div>
          <h2>${esc(a.name)}</h2>
          <div class="sub">${esc([a.set, a.num, a.year].filter(Boolean).join(' · ') || (sq ? a.category : ''))}</div>
          <div class="tags">
            <span class="tag">${flag(a.lang)} ${esc(LANGS[a.lang]?.label || a.lang || '')}</span>
            ${g ? `<span class="tag gold">${icon('star', 'sm')}${esc(g)}</span>` : ''}
            ${kind === 'card' && (!a.grader || a.grader === 'raw') && a.condition ? `<span class="tag">${esc(CONDITIONS[a.condition] || a.condition)}</span>` : ''}
            ${a.variant ? `<span class="tag">${esc(a.variant)}</span>` : ''}
            ${a.rarity ? `<span class="tag">${esc(a.rarity)}</span>` : ''}
            ${sq ? `<span class="tag">${esc(a.category || 'Autre')}</span><span class="tag">${a.status === 'opened' ? 'Ouvert' : 'Scellé'}</span>` : ''}
          </div>
          <div class="price">
            <div class="faint" style="font-size:12px;font-weight:700">VALEUR${qtyOf(a) > 1 ? ` · ${qtyOf(a)} EXEMPLAIRES` : ''}</div>
            <div class="v num">${money(worthOf(a))}</div>
            ${costOf(a) ? pill(gain, `${signed(gain)} · ${pct(gainPct(a))}`) : '<span class="pill flat">Prix d’achat non renseigné</span>'}
          </div>
        </div>
      </div>

      <div class="section" style="margin-top:20px">
        <div class="kv">
          <div><small>Valeur unitaire</small><b class="num">${hasValue(a) ? money(+a.value) : '<span class="faint">—</span>'}</b></div>
          <div><small>Achat unitaire</small><b class="num">${money(unitCost(a))}</b></div>
          <div><small>Coût total</small><b class="num">${money(costOf(a))}</b></div>
          <div><small>Quantité</small><b class="num">${qtyOf(a)}</b></div>
          <div><small>Date d’achat</small><b>${dateFr(a.buyDate)}</b></div>
          <div><small>Valeur mise à jour</small><b>${dateFr(a.valueUpdatedAt)}</b></div>
        </div>
      </div>

      ${marketBlock(a)}

      <div class="section">
        <div class="section-head"><h2>Cote</h2>
          ${kind === 'card' ? `<div class="seg small" style="width:170px">
            <button data-mode="auto" class="${priceModeOf(kind, a) === 'auto' ? 'on' : ''}">Auto</button>
            <button data-mode="manual" class="${priceModeOf(kind, a) === 'manual' ? 'on' : ''}">Manuelle</button></div>` : ''}</div>
        ${a.pendingValue ? `<div class="banner" style="margin:0 0 10px">${icon('info')}<div class="main"><b>Nouvelle cote proposée : ${money(a.pendingValue.v)}</b><br>
          <small class="muted">${esc(a.pendingValue.src)} · variation de ${pct(((a.pendingValue.v - a.value) / a.value) * 100)}, à valider</small></div>
          <div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm primary" data-pending="apply">Appliquer</button><button class="btn sm" data-pending="skip">Ignorer</button></div></div>` : ''}
        <p class="note" style="margin:-4px 0 10px">${priceModeOf(kind, a) === 'auto'
          ? `Mise à jour automatique chaque nuit${a.valueSource ? ` · ${esc(a.valueSource)} · ${dateFr(a.valueUpdatedAt)}` : ''}.`
          : 'Cote saisie par vous : elle n’est jamais modifiée automatiquement.'}</p>
        <form class="quick-value" data-quick>
          <label class="field"><div class="suffix" data-suffix="€"><input name="value" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Valeur unitaire" value="${hasValue(a) ? +a.value : ''}"></div></label>
          <button class="btn primary" type="submit">${icon('check')}Enregistrer</button>
        </form>
      </div>

      ${(a.priceLog || []).length ? `<div class="section">
        <div class="section-head"><h2>Évolution de la valeur</h2><span class="faint" style="font-size:12px">${a.priceLog.length} relevé${a.priceLog.length > 1 ? 's' : ''}</span></div>
        <div class="panel" style="padding:10px 12px"><div class="chart" id="asset-chart" style="height:150px"></div></div></div>` : ''}

      ${kind === 'card' ? gccHtml(a) : ''}

      ${kind === 'card' ? marketHtml(a) : ''}

      <div class="section">
        <div class="section-head"><h2>Ventes et annonces</h2></div>
        <div class="links">
          <a class="link-card" href="${esc(links.ebaySold(a))}" target="_blank" rel="noopener"><span class="lg" style="background:#fff;color:#e53238">eB</span><span>Ventes eBay<small>Dernières ventes réussies</small></span></a>
          <a class="link-card" href="${esc(links.ebayLive(a))}" target="_blank" rel="noopener"><span class="lg" style="background:#fff;color:#0064d2">eB</span><span>Annonces eBay<small>En cours</small></span></a>
          <a class="link-card" href="${esc(links.cardmarket(a))}" target="_blank" rel="noopener"><span class="lg" style="background:#012169;color:#fff">CM</span><span>Cardmarket<small>Offres en Europe</small></span></a>
          <a class="link-card" href="${esc(links.gcc(a))}" target="_blank" rel="noopener"><span class="lg" style="background:#111;color:#fff;border:1px solid #333">GCC</span><span>Graded Card Center<small>Ventes de cartes gradées</small></span></a>
          <a class="link-card" href="${esc(links.vinted(a))}" target="_blank" rel="noopener"><span class="lg" style="background:#09b1ba;color:#fff">V</span><span>Vinted<small>Annonces</small></span></a>
        </div>
      </div>

      ${a.note ? `<div class="section"><div class="section-head"><h2>Remarque</h2></div><div class="panel muted" style="white-space:pre-wrap">${esc(a.note)}</div></div>` : ''}

      <div class="sticky-actions"><div class="btn-row">
        <button class="btn" data-edit>${icon('edit')}Modifier</button>
        <button class="btn primary" data-sell>${icon('tag')}Vendre</button>
        <button class="btn danger" data-del style="flex:0 0 48px;padding:0" aria-label="Supprimer">${icon('trash')}</button>
      </div></div>`);

    const chartEl = sheet.body.querySelector('#asset-chart');
    if (chartEl) {
      const pts = (a.priceLog || []).map((p) => ({ d: p.d, value: p.v, cost: unitCost(a) }));
      renderChart(chartEl, pts, [
        { key: 'cost', label: 'Achat', color: '#6e6d7a', dashed: true, width: 1.4 },
        { key: 'value', label: 'Valeur', color: '#e9b949', area: true, dot: true },
      ], { height: 150 });
    }
    if (kind === 'card' && a.tcgdexId && !market) loadMarket(a);
    if (kind === 'card' && !gcc && settings.isServer()) loadGcc(a);
  }

  function marketBlock(a) {
    const m = a.market;
    if (!m) return '';
    const gcc = m.src === 'GCC';
    const box = (label, v, sub) => `<div class="m"><span><small>${label}</small><b class="num">${v != null ? money(v) : '—'}</b>${sub ? `<small style="font-weight:600">${sub}</small>` : ''}</span>${v != null ? `<button class="use" data-use="${v}">Utiliser</button>` : ''}</div>`;
    return `<div class="section"><div class="section-head"><h2>Prix du marché</h2><span class="pill gold">${esc(m.src)}</span></div>
      <div class="market">
        ${box(gcc ? 'Dernière vente' : 'Moyenne du jour', m.d1, gcc ? dateFr(m.d1At) : '')}
        ${box('Moyenne 30 jours', m.d30, gcc ? `${m.n30 || 0} vente${m.n30 > 1 ? 's' : ''}` : m.src.startsWith('TCG') && m.n30 < 30 ? `${m.n30} jour${m.n30 > 1 ? 's' : ''} relevé${m.n30 > 1 ? 's' : ''}` : '')}
      </div>
      <div class="note">${m.src === 'Cardmarket' ? 'Cardmarket, version exacte' + (a.variant ? ' (' + esc(a.variant) + ')' : '') + ', non gradée.' : gcc ? 'Ventes réalisées sur Graded Card Center, même note.' : 'Prix du marché américain converti en euros ; la moyenne 30 jours se construit chaque nuit.'} Relevé du ${dateFr(m.at)}.</div>
    </div>`;
  }

  function marketHtml(a) {
    if (!a.tcgdexId) {
      return `<div class="section"><div class="section-head"><h2>Version de la carte</h2></div>
        <div class="banner" style="margin-top:0">${icon('link')}<div class="main">Associez cette carte à sa fiche catalogue pour suivre automatiquement le prix de sa version exacte.</div>
        <button class="btn sm primary" data-link>Associer</button></div></div>`;
    }
    let inner;
    if (!market || market.loading) inner = '<div class="loading"><div class="spinner"></div></div>';
    else if (market.error) inner = `<div class="empty" style="padding:18px"><p style="margin:0">${esc(market.error)}</p></div>`;
    else if (!market.variants.length) inner = '<div class="empty" style="padding:18px"><p style="margin:0">Aucune cote disponible pour cette carte.</p></div>';
    else {
      const v = market.variants.find((x) => x.id === market.selected) || market.variants[0];
      const cm = v.cm || {};
      const cell = (label, val) => `<div class="m"><span><small>${label}</small><b class="num">${val != null ? money(val) : '—'}</b></span>${val != null ? `<button class="use" data-use="${val}">Utiliser</button>` : ''}</div>`;
      inner = `${market.variants.length > 1 ? `<div class="chips" style="margin-bottom:10px">${market.variants.map((x) => `<button data-variant="${esc(x.id)}" class="${x.id === v.id ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>` : ''}
        <div class="market">${cell('Prix moyen', cm.avg)}${cell('Tendance', cm.trend)}${cell('Moyenne 30 j', cm.avg30)}${cell('Plus bas', cm.low)}</div>
        ${v.tp ? `<div class="note">TCGplayer (US) : ${v.tp.market != null ? '$' + v.tp.market.toFixed(2) : '—'} (market price)</div>` : ''}
        <div class="note">Source : Cardmarket via TCGdex${cm.updated ? ' · mis à jour le ' + dateFr(cm.updated) : ''}. Prix d’une carte non gradée, tous états confondus.</div>`;
    }
    return `<div class="section"><div class="section-head"><h2>Version de la carte</h2><button class="link" data-link>Changer de fiche ${icon('chev', 'sm')}</button></div>${inner}</div>`;
  }

  function gccHtml(a) {
    if (!settings.isServer()) return '';
    let inner;
    if (!gcc || gcc.loading) inner = '<div class="loading"><div class="spinner"></div></div>';
    else if (gcc.error) inner = `<div class="empty" style="padding:18px"><p style="margin:0">${esc(gcc.error)}</p></div>`;
    else {
      const base = gccMatches(a, gcc.sales);
      const graded = a.grader && a.grader !== 'raw';
      const editions = [...new Set(base.map((x) => x.edition).filter(Boolean))];
      const list = base.filter((x) => (gcc.scope !== 'grade' || sameGrade(a, x)) && (gcc.edition === 'all' || x.edition === gcc.edition));
      const st = gccStats(list);
      const chips = `<div class="chips" style="margin-bottom:10px">
          ${graded ? `<button data-gcc-scope="grade" class="${gcc.scope === 'grade' ? 'on' : ''}">${esc(gradeLabel(a))}</button><button data-gcc-scope="all" class="${gcc.scope === 'all' ? 'on' : ''}">Toutes notes</button>` : ''}
          ${editions.length > 1 ? `<button data-gcc-ed="all" class="${gcc.edition === 'all' ? 'on' : ''}">Toutes éditions</button>${editions.map((e) => `<button data-gcc-ed="${esc(e)}" class="${gcc.edition === e ? 'on' : ''}">${esc(editionFr(e))}</button>`).join('')}` : ''}
        </div>`;
      if (!base.length) inner = `<div class="empty" style="padding:18px"><p style="margin:0">Aucune vente de cette carte sur GCC${a.num ? ' (n° ' + esc(a.num) + ')' : ''}.</p></div>`;
      else if (!list.length) inner = chips + '<div class="empty" style="padding:18px"><p style="margin:0">Aucune vente pour cette sélection.</p></div>';
      else {
        inner = `${chips}
          <div class="market">
            <div class="m"><span><small>Prix moyen${st.recent ? ' · 12 mois' : ''}</small><b class="num">${money(st.avg)}</b></span><button class="use" data-use="${st.avg.toFixed(2)}">Utiliser</button></div>
            <div class="m"><span><small>Médiane</small><b class="num">${money(st.median)}</b></span><button class="use" data-use="${st.median.toFixed(2)}">Utiliser</button></div>
            <div class="m"><span><small>Ventes</small><b class="num">${st.count}</b></span></div>
            <div class="m"><span><small>Fourchette</small><b class="num" style="font-size:13px">${money(st.min)} – ${money(st.max)}</b></span></div>
          </div>
          <div class="list" style="margin-top:10px">${list.slice(0, 8).map((x) => `<a class="row" href="https://gradedcardcenter.com/item/${esc(x.id)}" target="_blank" rel="noopener">
            ${x.image ? `<img class="thumb" src="${esc(x.image)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}
            <span class="main"><b>${esc(x.title)}</b><small>${esc([x.set, editionFr(x.edition), dateFr(x.soldAt)].filter(Boolean).join(' · '))}</small></span>
            <span class="end"><b class="num">${money(x.price)}</b></span></a>`).join('')}</div>
          <div class="note">Ventes réalisées sur Graded Card Center (${list.length} correspondance${list.length > 1 ? 's' : ''}, même numéro et même langue).</div>`;
      }
    }
    return `<div class="section"><div class="section-head"><h2>Ventes GCC</h2><span class="pill gold">Cartes gradées</span></div>${inner}</div>`;
  }

  async function loadGcc(a) {
    gcc = { loading: true };
    try {
      const num = a.num ? String(a.num).split('/').map((x) => x.replace(/^0+(?=\d)/, '')).join('/') : '';
      const sales = await server.gccSales([a.name, kind === 'card' ? num : ''].filter(Boolean).join(' '));
      const graded = a.grader && a.grader !== 'raw';
      const first = /1(re|ère|st)?\s*[ée]d/i.test(a.variant || '');
      const base = gccMatches(a, sales);
      gcc = {
        sales,
        scope: graded && base.some((x) => sameGrade(a, x)) ? 'grade' : 'all',
        edition: first && base.some((x) => x.edition === 'Edition 1') ? 'Edition 1' : 'all',
      };
    } catch (e) {
      gcc = { error: e.message };
    }
    draw();
  }

  async function loadMarket(a) {
    market = { loading: true };
    try {
      const card = await getCard(a.tcgLang || tcgLang(a.lang), a.tcgdexId);
      const variants = priceVariants(card);
      market = { variants, selected: a.tcgdexVariant && variants.some((v) => v.id === a.tcgdexVariant) ? a.tcgdexVariant : variants[0]?.id };
    } catch (e) {
      market = { error: 'Cote indisponible pour le moment.' };
    }
    draw();
  }

  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-zoom],[data-swap],[data-edit],[data-sell],[data-del],[data-link],[data-use],[data-variant],[data-gcc-scope],[data-gcc-ed],[data-mode],[data-pending]');
    if (!t) return;
    const a = find(kind, id);
    if ('zoom' in t.dataset) lightbox(t.src.replace('/low.webp', '/high.webp'));
    if ('swap' in t.dataset) { showOfficial = !showOfficial; draw(); }
    if ('edit' in t.dataset) openForm(kind, a);
    if ('sell' in t.dataset) openSell(kind, a);
    if ('del' in t.dataset) {
      if (await confirmSheet(`Supprimer « ${a.name} » de votre collection ?`, { ok: 'Supprimer', danger: true })) {
        removeAsset(kind, id); toast('Supprimé de la collection');
      }
    }
    if ('link' in t.dataset) {
      openCataloguePicker({ query: a.name, number: a.num, lang: a.tcgLang || tcgLang(a.lang), onPick: async (brief, lang) => {
        const pre = await prefillFromCatalogue(lang, brief.id);
        updateAsset(kind, id, { tcgdexId: pre.tcgdexId, tcgLang: pre.tcgLang, tcgdexVariant: null, image: a.image || pre.image, rarity: a.rarity || pre.rarity });
        market = null; draw();
      } });
    }
    if (t.dataset.gccScope) { gcc.scope = t.dataset.gccScope; draw(); }
    if (t.dataset.gccEd) { gcc.edition = t.dataset.gccEd; draw(); }
    if (t.dataset.variant) { market.selected = t.dataset.variant; updateAsset(kind, id, { tcgdexVariant: t.dataset.variant }); }
    if (t.dataset.use) { updateAsset(kind, id, { value: +(+t.dataset.use).toFixed(2), priceMode: 'manual', valueSource: null }); toast('Cote enregistrée (manuelle)'); }
    if (t.dataset.mode) { updateAsset(kind, id, { priceMode: t.dataset.mode }); toast(t.dataset.mode === 'auto' ? 'Cote automatique : mise à jour chaque nuit' : 'Cote manuelle'); }
    if (t.dataset.pending) {
      const pv = a.pendingValue;
      if (t.dataset.pending === 'apply') updateAsset(kind, id, { value: pv.v, valueSource: pv.src, pendingValue: null });
      else updateAsset(kind, id, { pendingValue: null });
    }
  });
  sheet.body.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.value.value;
    if (v === '') return;
    updateAsset(kind, id, { value: +(+v).toFixed(2), priceMode: 'manual', valueSource: null });
    toast('Cote enregistrée (manuelle)');
  });

  draw();
}

/* ---------- GCC matching ---------- */
const GCC_LANG = { fr: 'French', en: 'English', jp: 'Japanese', de: 'German', it: 'Italian', es: 'Spanish', kr: 'Korean', cn: 'Chinese' };
const GCC_GRADER = { 'collect aura': 'ca', akat: 'akatsuki' };
const normRef = (r) => String(r || '').replace(/^#/, '').split('/').map((x) => x.trim().replace(/^0+(?=\d)/, '').toLowerCase()).join('/');
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const editionFr = (e) => (e === 'Edition 1' ? '1ère édition' : e === 'Unlimited' ? 'Illimitée' : e || '');

function gccMatches(a, sales) {
  const ref = a.num ? normRef(a.num) : '';
  const refHasTotal = ref.includes('/');
  const lang = GCC_LANG[a.lang];
  const name = fold(a.name).split(/\s+/)[0];
  const setWords = fold(a.set).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !['pokemon', 'edition', 'promo', 'promos'].includes(w));
  return sales.filter((x) => {
    if (lang && x.lang && x.lang !== lang) return false;
    if (ref) {
      const r = normRef(x.ref);
      if (refHasTotal ? r !== ref : r.split('/')[0] !== ref) return false;
      // Without the set total, a bare number is ambiguous: require a shared word with the set name.
      if (!refHasTotal && setWords.length && !setWords.some((w) => fold(x.set).includes(w))) return false;
    } else if (!fold(x.title).includes(name)) return false;
    return true;
  }).sort((p, q) => String(q.soldAt).localeCompare(String(p.soldAt)));
}
function sameGrade(a, x) {
  const g = GCC_GRADER[a.grader] || a.grader;
  return fold(x.grader) === fold(g) && parseFloat(x.grade) === parseFloat(a.grade);
}
function gccStats(list) {
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString();
  const recent = list.filter((x) => x.soldAt >= yearAgo);
  const use = recent.length ? recent : list;
  const prices = use.map((x) => +x.price).filter(isFinite).sort((p, q) => p - q);
  const mid = Math.floor(prices.length / 2);
  return {
    recent: recent.length > 0, count: prices.length,
    avg: prices.reduce((s, v) => s + v, 0) / prices.length,
    median: prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2,
    min: prices[0], max: prices[prices.length - 1],
  };
}

/* ======================================================================
   Add / edit form
   ====================================================================== */
export function openForm(kind, existing = null, prefill = {}, { photoData = null } = {}) {
  const isCard = kind === 'card';
  const a = { lang: 'fr', qty: 1, grader: 'raw', condition: 'nm', status: 'sealed', category: 'Booster', buyDate: today(), ...(existing || {}), ...prefill };
  let newPhoto = photoData;            // data URL waiting to be uploaded
  let removePhoto = false;
  const sheet = openSheet({ title: existing ? 'Modifier' : isCard ? 'Nouvelle carte' : 'Nouvel item', full: true });

  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v.flag + ' ' + v.label)}</option>`).join('');
  const val = (x) => (x == null ? '' : esc(x));

  function previewSrc() {
    if (newPhoto) return newPhoto;
    if (!removePhoto && a.photo) return photoUrl(a.photo);
    return a.image ? a.image.replace('/high.webp', '/low.webp') : null;
  }

  function draw() {
    const src = previewSrc();
    sheet.render(`<form class="form" novalidate>
      <div class="photo-pick">
        <div class="pv ${isCard ? '' : 'sq'}">${src ? `<img src="${esc(src)}" alt="">` : icon('camera', 'lg')}</div>
        <div class="btns">
          <button type="button" class="btn sm" data-photo="camera">${icon('camera', 'sm')}Prendre une photo</button>
          <button type="button" class="btn sm" data-photo="gallery">${icon('image', 'sm')}Choisir une image</button>
          ${newPhoto || (a.photo && !removePhoto) ? `<button type="button" class="btn sm ghost" data-photo="remove">${icon('trash', 'sm')}Retirer ma photo</button>` : ''}
        </div>
      </div>

      ${isCard ? (a.tcgdexId
        ? `<div class="linked">${a.image ? `<img src="${esc(a.image.replace('/high.webp', '/low.webp'))}" alt="">` : ''}<div class="main"><b>Fiche catalogue associée</b><br><small class="muted">${esc(a.tcgdexId)}</small></div><button type="button" class="btn sm" data-catalogue>Changer</button></div>`
        : `<button type="button" class="btn block" data-catalogue>${icon('search')}Remplir depuis le catalogue</button>`)
        : (a.tcgplayerId
          ? `<div class="linked"><img src="${esc(sealedImage(a.tcgplayerId, 200))}" alt="" style="background:#fff;object-fit:contain;height:32px"><div class="main"><b>Produit du catalogue</b><br><small class="muted">${esc(a.set || '')}</small></div><button type="button" class="btn sm" data-sealed>Changer</button></div>`
          : `<button type="button" class="btn block" data-sealed>${icon('search')}Choisir dans le catalogue</button>`)}

      <div class="form-section">${isCard ? 'La carte' : 'Le produit'}</div>
      <div class="form-grid">
        <label class="field span"><span>Nom *</span><input name="name" required value="${val(a.name)}" placeholder="${isCard ? 'Tapez un nom : Dracaufeu…' : 'Tapez un nom : Display 151…'}"></label>
        ${isCard ? '' : `<div class="field span"><span>Catégorie</span><div class="chips">${CATEGORIES.map((c) => `<button type="button" data-cat="${c}" class="${a.category === c ? 'on' : ''}">${c}</button>`).join('')}</div></div>`}
        <label class="field ${isCard ? '' : 'span'}"><span>Extension</span><input name="set" value="${val(a.set)}" placeholder="Set de Base"></label>
        ${isCard ? `<label class="field"><span>Numéro</span><input name="num" value="${val(a.num)}" placeholder="4/102"></label>` : ''}
        <label class="field"><span>Langue</span><select name="lang">${opt(LANGS, a.lang)}</select></label>
        ${isCard ? `<label class="field"><span>Année</span><input name="year" inputmode="numeric" value="${val(a.year)}" placeholder="1999"></label>
          <label class="field"><span>Rareté</span><input name="rarity" value="${val(a.rarity)}" placeholder="Rare Holo"></label>
          <label class="field"><span>Version</span><input name="variant" list="variants" value="${val(a.variant)}" placeholder="1ère édition…"><datalist id="variants">${VARIANTS.map((v) => `<option value="${v}">`).join('')}</datalist></label>`
        : `<div class="field"><span>État</span><div class="chips">${[['sealed', 'Scellé'], ['opened', 'Ouvert']].map(([k, l]) => `<button type="button" data-status="${k}" class="${a.status === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>`}
      </div>

      ${isCard ? `<div class="form-section">État et gradation</div>
      <div class="form-grid">
        <label class="field"><span>Gradation</span><select name="grader">${opt(GRADERS, a.grader || 'raw')}</select></label>
        ${a.grader && a.grader !== 'raw'
          ? `<label class="field"><span>Note</span><input name="grade" inputmode="decimal" value="${val(a.grade)}" placeholder="9.5"></label>`
          : `<label class="field"><span>État</span><select name="condition">${opt(CONDITIONS, a.condition || 'nm')}</select></label>`}
      </div>` : ''}

      <div class="form-section">Achat et valeur</div>
      <div class="form-grid">
        <label class="field"><span>Quantité</span><input name="qty" type="number" inputmode="numeric" min="1" step="1" value="${val(a.qty || 1)}"></label>
        <label class="field"><span>Date d’achat</span><input name="buyDate" type="date" value="${val(a.buyDate)}"></label>
        <label class="field"><span>Prix d’achat unitaire</span><div class="suffix" data-suffix="€"><input name="buyPrice" type="number" inputmode="decimal" min="0" step="0.01" value="${val(a.buyPrice)}" placeholder="0"></div></label>
        ${isCard ? `<label class="field"><span>Frais de gradation</span><div class="suffix" data-suffix="€"><input name="gradingCost" type="number" inputmode="decimal" min="0" step="0.01" value="${val(a.gradingCost)}" placeholder="0"></div></label>` : ''}
        <label class="field ${isCard ? 'span' : ''}"><span>Valeur actuelle unitaire</span><div class="suffix" data-suffix="€"><input name="value" type="number" inputmode="decimal" min="0" step="0.01" value="${val(a.value)}" placeholder="Laisser vide = prix d’achat"></div></label>
        <label class="field span"><span>Remarque</span><textarea name="note" placeholder="Emplacement, provenance…">${esc(a.note || '')}</textarea></label>
      </div>

      <div class="sticky-actions"><button class="btn primary block" type="submit">${icon('check')}${existing ? 'Enregistrer' : 'Ajouter à ma collection'}</button></div>
    </form>`);
    const nameInput = sheet.body.querySelector('input[name=name]');
    if (isCard) {
      attachSuggest(nameInput, {
        search: (q) => searchCards(q, { lang: 'fr' }),
        render: (c) => `${c.image ? `<img src="${esc(cardImage(c.image))}" alt="" loading="lazy">` : '<img alt="">'}<span class="main"><b>${esc(c.name)}</b><small>${esc(c.setName)} · ${esc(c.localId)}${c.setTotal ? '/' + c.setTotal : ''}</small></span>`,
        onPick: async (c) => {
          readForm();
          try { Object.assign(a, await prefillFromCatalogue('fr', c.id)); } catch { toast('Carte indisponible', { error: true }); }
          draw();
        },
      });
    } else {
      attachSuggest(nameInput, {
        search: (q) => searchSealed(q),
        render: (p) => `<img class="sq" src="${esc(sealedImage(p.id, 200))}" alt="" loading="lazy"><span class="main"><b>${esc(p.n)}</b><small>${esc(p.c)} · ${esc(p.s)}</small></span>`,
        onPick: (p) => { readForm(); Object.assign(a, sealedPrefill(p)); draw(); },
      });
    }
  }

  // Keep typed values when the form re-renders (grader switch, chips…)
  function readForm() {
    const fd = new FormData(sheet.body.querySelector('form'));
    for (const [k, v] of fd.entries()) a[k] = v;
  }

  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-photo],[data-catalogue],[data-sealed],[data-cat],[data-status]');
    if (!t) return;
    readForm();
    if (t.dataset.photo === 'remove') { newPhoto = null; removePhoto = true; draw(); return; }
    if (t.dataset.photo) {
      const file = await pickImage({ capture: t.dataset.photo === 'camera' });
      if (!file) return;
      try { newPhoto = await resizeImage(file, settings.isServer() ? 1000 : 640, settings.isServer() ? 0.82 : 0.72); removePhoto = false; draw(); }
      catch (err) { toast(err.message, { error: true }); }
      return;
    }
    if ('catalogue' in t.dataset) {
      openCataloguePicker({ query: a.name || '', number: a.num || '', lang: a.tcgLang || tcgLang(a.lang), onPick: async (brief, lang) => {
        Object.assign(a, await prefillFromCatalogue(lang, brief.id));
        draw();
      } });
      return;
    }
    if ('sealed' in t.dataset) {
      openSealedPicker({ onPick: (p) => { Object.assign(a, sealedPrefill(p)); draw(); } });
      return;
    }
    if (t.dataset.cat) a.category = t.dataset.cat;
    if (t.dataset.status) a.status = t.dataset.status;
    draw();
  });
  sheet.body.addEventListener('change', (e) => { if (e.target.name === 'grader') { readForm(); draw(); } });

  sheet.body.addEventListener('submit', async (e) => {
    e.preventDefault();
    readForm();
    if (!String(a.name || '').trim()) { toast('Le nom est obligatoire', { error: true }); return; }
    const btn = sheet.body.querySelector('[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px"></span>Enregistrement…';
    try {
      let photo = removePhoto ? null : a.photo || null;
      if (newPhoto) photo = await savePhoto(newPhoto);
      const num = (v) => (v === '' || v == null ? null : +v);
      const data = {
        name: a.name.trim(), set: (a.set || '').trim(), lang: a.lang, qty: Math.max(1, parseInt(a.qty, 10) || 1),
        buyPrice: num(a.buyPrice) ?? 0, buyDate: a.buyDate || null, value: num(a.value), note: (a.note || '').trim(),
        photo, image: a.image || null,
      };
      if (isCard) Object.assign(data, {
        num: (a.num || '').trim(), year: (a.year || '').trim(), rarity: (a.rarity || '').trim(), variant: (a.variant || '').trim(),
        grader: a.grader || 'raw', grade: a.grader && a.grader !== 'raw' ? (a.grade || '').trim() : null,
        condition: a.grader && a.grader !== 'raw' ? null : a.condition, gradingCost: num(a.gradingCost) ?? 0,
        tcgdexId: a.tcgdexId || null, tcgLang: a.tcgLang || null, tcgdexVariant: a.tcgdexVariant || null,
      });
      else Object.assign(data, { category: a.category || 'Autre', status: a.status || 'sealed', tcgplayerId: a.tcgplayerId || null, tcgplayerGroup: a.tcgplayerGroup || null });

      if (existing) { updateAsset(kind, existing.id, data); toast('Modifications enregistrées'); sheet.close(); }
      else {
        const created = addAsset(kind, data);
        toast(isCard ? 'Carte ajoutée' : 'Item ajouté');
        sheet.close();
        if (!location.hash.startsWith('#/collection')) location.hash = '#/collection/' + (isCard ? 'cards' : 'items');
        setTimeout(() => openDetail(kind, created.id), 320);
      }
    } catch (err) {
      toast('Photo non enregistrée : ' + err.message, { error: true });
      btn.disabled = false;
      btn.innerHTML = icon('check') + 'Réessayer';
    }
  });

  draw();
}

export async function prefillFromCatalogue(lang, id) {
  const card = await getCard(lang, id);
  let year = '';
  try { const set = await getSetCards(lang, card.set.id); year = (set.releaseDate || '').slice(0, 4); } catch { /* optional */ }
  const total = card.set?.cardCount?.official;
  return {
    name: card.name, set: card.set?.name || '', num: total ? `${card.localId}/${total}` : card.localId, year,
    rarity: card.rarity || '', lang: appLang(lang), image: card.image ? cardImage(card.image, 'high') : null,
    tcgdexId: card.id, tcgLang: lang,
  };
}

/* ======================================================================
   Sell
   ====================================================================== */
export function openSell(kind, a) {
  const q = qtyOf(a);
  const sheet = openSheet({ title: 'Vendre « ' + a.name + ' »' });
  let platform = 'Vinted';
  sheet.render(`<form class="form">
    <div class="form-grid">
      ${q > 1 ? `<label class="field"><span>Quantité vendue</span><input name="qty" type="number" min="1" max="${q}" step="1" value="1"></label>` : '<input type="hidden" name="qty" value="1">'}
      <label class="field ${q > 1 ? '' : 'span'}"><span>Prix de vente unitaire</span><div class="suffix" data-suffix="€"><input name="sellPrice" type="number" inputmode="decimal" step="0.01" min="0" required value="${hasValue(a) ? +a.value : ''}"></div></label>
      <label class="field"><span>Frais (port, commission)</span><div class="suffix" data-suffix="€"><input name="fees" type="number" inputmode="decimal" step="0.01" min="0" value="0"></div></label>
      <label class="field"><span>Date</span><input name="date" type="date" value="${today()}"></label>
      <div class="field span"><span>Plateforme</span><div class="chips">${PLATFORMS.map((p) => `<button type="button" data-p="${p}" class="${p === platform ? 'on' : ''}">${p}</button>`).join('')}</div></div>
    </div>
    <div class="kv" id="sell-sum"></div>
    <button class="btn primary block" type="submit">${icon('tag')}Enregistrer la vente</button>
  </form>`);
  const form = sheet.body.querySelector('form');
  const sum = () => {
    const qty = Math.min(q, Math.max(1, +form.qty.value || 1));
    const revenue = (+form.sellPrice.value || 0) * qty - (+form.fees.value || 0);
    const cost = unitCost(a) * qty;
    sheet.body.querySelector('#sell-sum').innerHTML = `<div><small>Montant net</small><b class="num">${money(revenue)}</b></div>
      <div><small>Résultat</small><b class="num ${trend(revenue - cost)}">${signed(revenue - cost)}</b></div>`;
  };
  sum();
  form.addEventListener('input', sum);
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    platform = b.dataset.p;
    form.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (form.sellPrice.value === '') { toast('Indiquez le prix de vente', { error: true }); return; }
    sellAsset(kind, a.id, { qty: form.qty.value, sellPrice: form.sellPrice.value, fees: form.fees.value, date: form.date.value, platform });
    toast('Vente enregistrée');
    sheet.close();
  });
}

/* ======================================================================
   Sales history
   ====================================================================== */
export function openSales(initial = 'all') {
  let tab = initial;
  const sheet = openSheet({ title: 'Historique des ventes', full: true, onClose: () => off() });
  const off = store.on(() => draw());
  function draw() {
    const all = store.get().sales;
    const list = tab === 'all' ? all : all.filter((s) => s.kind === tab);
    const pnl = list.reduce((s, x) => s + salePnl(x), 0);
    const revenue = list.reduce((s, x) => s + saleRevenue(x), 0);
    const ci = salesSummary('item'), cc = salesSummary('card');
    sheet.render(`
      <div class="seg" style="margin-bottom:14px">
        <button data-tab="all" class="${tab === 'all' ? 'on' : ''}">Tout · ${all.length}</button>
        <button data-tab="item" class="${tab === 'item' ? 'on' : ''}">Items · ${ci.count}</button>
        <button data-tab="card" class="${tab === 'card' ? 'on' : ''}">Cartes · ${cc.count}</button>
      </div>
      <div class="kv" style="margin-bottom:14px"><div><small>Encaissé</small><b class="num">${money(revenue)}</b></div>
        <div><small>Résultat</small><b class="num ${trend(pnl)}">${signed(pnl)}</b></div></div>
      ${list.length ? `<div class="list">${[...list].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((s) => {
        const img = photoUrl(s.photo) || (s.image ? s.image.replace('/high.webp', '/low.webp') : null);
        return `<button class="row" data-sale="${s.id}">
          ${img ? `<img class="thumb ${s.kind === 'item' ? 'sq' : ''}" src="${esc(img)}" alt="" loading="lazy">` : `<span class="thumb ${s.kind === 'item' ? 'sq' : ''}"></span>`}
          <span class="main"><b>${esc(s.name)}${s.qty > 1 ? ' ×' + s.qty : ''}</b><small>${dateFr(s.date)}${s.platform ? ' · ' + esc(s.platform) : ''}</small></span>
          <span class="end"><b class="num">${money(saleRevenue(s))}</b>${pill(salePnl(s))}</span></button>`;
      }).join('')}</div>`
      : `<div class="empty"><div class="ico">${icon('tag', 'lg')}</div><h3>Aucune vente</h3><p>Utilisez « Vendre » depuis la fiche d’une carte ou d’un item.</p></div>`}`);
  }
  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab],[data-sale]');
    if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; draw(); }
    if (t.dataset.sale) {
      const s = store.get().sales.find((x) => x.id === t.dataset.sale);
      if (s && await confirmSheet(`Supprimer la vente de « ${s.name} » (${money(saleRevenue(s))}) de l’historique ?`, { ok: 'Supprimer', danger: true })) {
        deleteSale(s.id); toast('Vente supprimée');
      }
    }
  });
  draw();
}

/* ======================================================================
   Catalogue: card preview & picker
   ====================================================================== */
export function openCatalogueCard(lang, id, { photoData = null, extra = {} } = {}) {
  const sheet = openSheet({ title: 'Catalogue', full: true });
  sheet.render('<div class="loading"><div class="spinner"></div></div>');
  let selected = null;
  getCard(lang, id).then((card) => {
    const variants = priceVariants(card);
    selected = variants[0]?.id;
    const draw = () => {
      const v = variants.find((x) => x.id === selected);
      const cm = v?.cm || {};
      const ref = { name: card.name, num: card.localId + (card.set?.cardCount?.official ? '/' + card.set.cardCount.official : ''), set: card.set?.name || '' };
      sheet.setTitle(card.name);
      sheet.render(`
        <div class="detail-hero">
          <div class="art">${card.image ? `<img src="${esc(cardImage(card.image, 'high'))}" alt="" data-zoom>` : ''}</div>
          <div><h2>${esc(card.name)}</h2>
            <div class="sub">${esc(card.set?.name || '')} · ${esc(card.localId)}${card.set?.cardCount?.official ? '/' + card.set.cardCount.official : ''}</div>
            <div class="tags">${card.rarity ? `<span class="tag">${esc(card.rarity)}</span>` : ''}${card.illustrator ? `<span class="tag">${esc(card.illustrator)}</span>` : ''}</div>
            ${cm.avg != null ? `<div class="price"><div class="faint" style="font-size:12px;font-weight:700">PRIX MOYEN CARDMARKET</div><div class="v num">${money(cm.avg)}</div></div>` : ''}
          </div>
        </div>
        ${variants.length ? `<div class="section"><div class="section-head"><h2>Cote du marché</h2></div>
          ${variants.length > 1 ? `<div class="chips" style="margin-bottom:10px">${variants.map((x) => `<button data-variant="${esc(x.id)}" class="${x.id === selected ? 'on' : ''}">${esc(x.label)}</button>`).join('')}</div>` : ''}
          <div class="market">${[['Prix moyen', cm.avg], ['Tendance', cm.trend], ['Moyenne 30 j', cm.avg30], ['Plus bas', cm.low]].map(([l, x]) => `<div class="m"><span><small>${l}</small><b class="num">${x != null ? money(x) : '—'}</b></span></div>`).join('')}</div>
          <div class="note">Source : Cardmarket via TCGdex${cm.updated ? ' · ' + dateFr(cm.updated) : ''}.</div></div>` : ''}
        <div class="section"><div class="links">
          <a class="link-card" href="${esc(links.ebaySold(ref))}" target="_blank" rel="noopener"><span class="lg" style="background:#fff;color:#e53238">eB</span><span>Ventes eBay<small>Ventes réussies</small></span></a>
          <a class="link-card" href="${esc(links.cardmarket(ref))}" target="_blank" rel="noopener"><span class="lg" style="background:#012169;color:#fff">CM</span><span>Cardmarket<small>Offres</small></span></a>
        </div></div>
        <div class="sticky-actions"><button class="btn primary block" data-add>${icon('plus')}Ajouter à ma collection</button></div>`);
    };
    draw();
    sheet.body.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-variant],[data-add],[data-zoom]');
      if (!t) return;
      if ('zoom' in t.dataset) lightbox(t.src);
      if (t.dataset.variant) { selected = t.dataset.variant; draw(); }
      if ('add' in t.dataset) {
        const pre = await prefillFromCatalogue(lang, id);
        const v = variants.find((x) => x.id === selected);
        if (v && v.id !== 'default') { pre.tcgdexVariant = v.id; pre.variant = v.label.includes('1re') || v.label.includes('1ère') ? '1ère édition' : ''; }
        if (v?.cm?.avg != null) pre.value = +v.cm.avg.toFixed(2);
        sheet.close();
        openForm('card', null, { ...pre, ...extra }, { photoData });
      }
    });
  }).catch(() => sheet.render('<div class="empty"><h3>Catalogue indisponible</h3><p>Réessayez dans un instant.</p></div>'));
}

export function openCataloguePicker({ query = '', number = '', lang = 'fr', onPick }) {
  const sheet = openSheet({ title: 'Choisir la carte', full: true });
  let seq = 0;
  sheet.render(`
    <div class="toolbar" style="margin-top:0">
      <label class="search">${icon('search', 'sm')}<input id="pq" type="search" value="${esc(query)}" placeholder="Nom de la carte" autocomplete="off"></label>
      <select id="pl" class="input" style="width:86px;height:42px">${['fr', 'en', 'ja', 'de', 'it', 'es'].map((l) => `<option value="${l}" ${l === lang ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}</select>
    </div>
    <label class="field" style="margin-bottom:12px"><input id="pn" value="${esc(number)}" placeholder="Numéro (facultatif) : 4/102"></label>
    <div id="pr"></div>`);
  const q = sheet.body.querySelector('#pq'), l = sheet.body.querySelector('#pl'), nEl = sheet.body.querySelector('#pn'), out = sheet.body.querySelector('#pr');
  const run = async () => {
    const my = ++seq;
    if (q.value.trim().length < 2) { out.innerHTML = '<p class="faint" style="text-align:center">Tapez au moins 2 lettres.</p>'; return; }
    out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const res = await searchCards(q.value, { lang: l.value, number: nEl.value });
      if (my !== seq) return;
      out.innerHTML = res.length ? `<div class="grid" style="--cols:3">${res.slice(0, 90).map((c) => `<button class="tile" data-id="${esc(c.id)}">
        <div class="art">${c.image ? `<img src="${esc(cardImage(c.image))}" alt="" loading="lazy">` : `<span class="ph">${icon('image')}</span>`}</div>
        <div class="meta"><b>${esc(c.name)}</b><small>${esc(c.setName)} · ${esc(c.localId)}</small></div></button>`).join('')}</div>`
        : '<div class="empty"><h3>Aucune carte trouvée</h3><p>Essayez une autre langue ou orthographe.</p></div>';
    } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
  };
  let t;
  [q, nEl].forEach((el) => el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 350); }));
  l.addEventListener('change', run);
  out.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    b.style.opacity = '.5';
    try { await onPick({ id: b.dataset.id }, l.value); sheet.close(); }
    catch { toast('Impossible de charger cette carte', { error: true }); b.style.opacity = ''; }
  });
  run();
}

/* ======================================================================
   Sealed catalogue picker (French products)
   ====================================================================== */
export function openSealedPicker({ onPick, category = '' }) {
  const sheet = openSheet({ title: 'Ajouter un item', full: true });
  let cat = category;
  let q = '';
  let seq = 0;
  sheet.render(`
    <label class="search" style="margin-bottom:10px">${icon('search', 'sm')}<input id="sq" type="search" placeholder="Rechercher : Display 151, ETB Évolutions…" autocomplete="off"></label>
    <div class="chips scroll" id="sc" style="margin-bottom:12px"></div>
    <div id="sr"></div>`);
  const chipsEl = sheet.body.querySelector('#sc');
  const out = sheet.body.querySelector('#sr');
  const drawChips = () => {
    chipsEl.innerHTML = `<button data-c="" class="${!cat ? 'on' : ''}">Tous</button>` +
      CATEGORIES.filter((c) => !['Accessoire', 'Autre'].includes(c)).map((c) => `<button data-c="${c}" class="${cat === c ? 'on' : ''}">${c}</button>`).join('');
  };
  const run = async () => {
    const my = ++seq;
    out.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
      const res = await searchSealed(q, cat);
      if (my !== seq) return;
      out.innerHTML = res.length
        ? `<div class="grid" style="--cols:3">${res.slice(0, 150).map((p) => `<button class="tile" data-id="${p.id}">
            <div class="art item-art cat"><img src="${esc(sealedImage(p.id, 200))}" alt="" loading="lazy"></div>
            <div class="meta"><b>${esc(p.s)}</b><small>${esc(p.n.replace(p.c + ' ', '').replace(p.s, '').replace(/^\s*\(|\)\s*$/g, '') || p.c)}</small></div></button>`).join('')}</div>
          ${res.length > 150 ? '<p class="note" style="text-align:center">Affinez la recherche pour voir plus de produits.</p>' : ''}`
        : '<div class="empty"><h3>Aucun produit</h3><p>Essayez un autre nom d’extension ou une autre catégorie.</p></div>';
      out._res = res;
    } catch (e) { if (my === seq) out.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
  };
  drawChips();
  run();
  let t;
  sheet.body.querySelector('#sq').addEventListener('input', (e) => { q = e.target.value; clearTimeout(t); t = setTimeout(run, 200); });
  chipsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; drawChips(); run(); });
  out.addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const p = (out._res || []).find((x) => String(x.id) === b.dataset.id);
    if (p) { sheet.close(); onPick(p); }
  });
}

/* ======================================================================
   Tracked set (master set) detail
   ====================================================================== */
export function openSetSheet(setId, { getSetCards: loadSet = getSetCards } = {}) {
  let filter = 'all';
  let briefs = null;
  const sheet = openSheet({ title: 'Set', full: true, onClose: () => off() });
  const off = store.on(() => draw());
  const tracked = () => store.get().sets.find((x) => x.id === setId);

  async function loadBriefs(set) {
    const ids = [...new Set(set.cards.map((id) => id.slice(0, id.lastIndexOf('-'))))];
    const map = new Map();
    await Promise.all(ids.map(async (sid) => {
      try { (await loadSet(set.lang === 'jp' ? 'ja' : set.lang || 'fr', sid)).cards.forEach((c) => map.set(c.id, c)); } catch { /* keep going */ }
    }));
    briefs = map;
    draw();
  }

  function draw() {
    const set = tracked();
    if (!set) { sheet.close(); return; }
    sheet.setTitle(set.name);
    if (!briefs) { sheet.render('<div class="loading"><div class="spinner"></div></div>'); return; }
    const pr = setProgress(set);
    const pctDone = pr.total ? Math.round((pr.count / pr.total) * 100) : 0;
    const ids = set.cards.filter((id) => filter === 'all' || (filter === 'own' ? pr.owned.has(id) : !pr.owned.has(id)));
    sheet.render(`
      <div class="panel set-track" style="margin-bottom:14px">
        ${set.description ? `<span class="muted" style="font-size:13px">${esc(set.description)}</span>` : ''}
        <div class="top"><span class="count num">${pr.count}<small> / ${pr.total} cartes</small></span><span class="pill gold">${pctDone} %</span></div>
        <div class="progress"><span style="width:${pctDone}%"></span></div>
        <div class="top muted" style="font-size:13px"><span>Dépensé <b class="num" style="color:var(--text)">${money(pr.cost)}</b></span><span>Manquantes <b class="num" style="color:var(--text)">${pr.total - pr.count}</b></span></div>
      </div>
      <div class="seg" style="margin-bottom:14px">
        <button data-f="all" class="${filter === 'all' ? 'on' : ''}">Toutes</button>
        <button data-f="own" class="${filter === 'own' ? 'on' : ''}">Possédées · ${pr.count}</button>
        <button data-f="miss" class="${filter === 'miss' ? 'on' : ''}">Manquantes · ${pr.total - pr.count}</button>
      </div>
      <div class="grid" style="--cols:3">${ids.map((id) => {
        const b = briefs.get(id) || { name: id, localId: id.split('-').pop() };
        const own = pr.owned.get(id);
        const img = own ? imageOf(own[0], { thumb: true }) : b.image ? cardImage(b.image) : null;
        return `<button class="tile ${own ? '' : 'missing'}" data-card="${esc(id)}">
          <div class="art">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="ph">${icon('image')}</span>`}
            ${own ? `<span class="own">${icon('check')}</span>` : ''}</div>
          <div class="meta"><b>${esc(b.name)}</b><small>n° ${esc(b.localId)}${own && costOf(own[0]) ? ' · ' + money(costOf(own[0])) : ''}</small></div></button>`;
      }).join('')}</div>
      <button class="btn danger block" data-untrack style="margin-top:22px">${icon('trash')}Ne plus suivre ce set</button>`);
  }

  sheet.body.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-f],[data-card],[data-untrack]');
    if (!t) return;
    const set = tracked();
    if (t.dataset.f) { filter = t.dataset.f; draw(); }
    if (t.dataset.card) {
      const own = setProgress(set).owned.get(t.dataset.card);
      if (own) openDetail('card', own[0].id);
      else openCatalogueCard(set.lang === 'jp' ? 'ja' : set.lang || 'fr', t.dataset.card);
    }
    if ('untrack' in t.dataset && await confirmSheet(`Ne plus suivre « ${set.name} » ? Vos cartes restent dans la collection.`, { ok: 'Retirer', danger: true })) {
      removeSet(set.id); toast('Set retiré');
    }
  });
  draw();
  loadBriefs(tracked());
}
