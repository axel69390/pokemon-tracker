import { settings } from '../settings.js?v=2.3.1';
import { server, searchCards, tcgLang, cardImage } from '../api.js?v=2.3.1';
import { esc, icon, pickImage, resizeImage, toast, LANGS, CATEGORIES } from '../ui.js?v=2.3.1';
import { openCatalogueCard, openForm } from '../sheets.js?v=2.3.1';

let last = null; // { photo, result, matches, error } — kept while navigating

export function render(main) {
  const ready = settings.isServer();
  main.innerHTML = `
    <div class="scan-stage" id="stage">
      ${last?.photo ? `<img src="${esc(last.photo)}" alt="">` : '<div class="frame"></div><div class="hint">Cadrez la carte ou le produit, bien à plat</div>'}
      ${last?.busy ? '<div class="beam"></div>' : ''}
    </div>
    <div class="scan-actions">
      <button class="btn primary" data-shot="camera">${icon('camera')}${last?.photo ? 'Nouvelle photo' : 'Photographier'}</button>
      <button class="btn" data-shot="gallery">${icon('image')}Importer</button>
    </div>
    ${ready ? '' : `<div class="banner">${icon('info')}<div class="main">La reconnaissance automatique utilise votre serveur personnel. Configurez-le dans les réglages, ou ajoutez vos cartes depuis le catalogue.</div><a class="btn sm" href="#/settings">Réglages</a></div>`}
    <div id="scan-result">${resultHtml()}</div>`;

  main.onclick = async (e) => {
    const t = e.target.closest('[data-shot],[data-match],[data-add-card],[data-add-item],[data-retry]');
    if (!t) return;
    if (t.dataset.shot) {
      const file = await pickImage({ capture: t.dataset.shot === 'camera' });
      if (!file) return;
      try {
        const photo = await resizeImage(file, 1100, 0.85);
        last = { photo };
        if (ready) analyse(main); else render(main);
      } catch (err) { toast(err.message, { error: true }); }
    }
    if ('retry' in t.dataset) analyse(main);
    if (t.dataset.match) openCatalogueCard(t.dataset.lang, t.dataset.match, { photoData: last.photo, extra: extraFromScan() });
    if ('addCard' in t.dataset) openForm('card', null, prefillCard(), { photoData: last.photo });
    if ('addItem' in t.dataset) openForm('item', null, prefillItem(), { photoData: last.photo });
  };
}

async function analyse(main) {
  last = { photo: last.photo, busy: true };
  render(main);
  const rerender = () => { const m = document.querySelector('main.view'); if (m && location.hash.startsWith('#/scan')) render(m); };
  try {
    const r = await server.scan(last.photo);
    last.result = r;
    if (r.type !== 'item' && (r.name || r.name_fr)) {
      const lang = tcgLang(r.lang || 'fr');
      let matches = await searchCards(r.name || r.name_fr, { lang, number: r.number }).catch(() => []);
      if (!matches.length && r.name_fr && lang !== 'fr') matches = (await searchCards(r.name_fr, { lang: 'fr', number: r.number }).catch(() => [])).map((m) => ({ ...m, lang: 'fr' }));
      if (!matches.length && r.name_en) matches = (await searchCards(r.name_en, { lang: 'en', number: r.number }).catch(() => [])).map((m) => ({ ...m, lang: 'en' }));
      last.matches = matches.slice(0, 12).map((m) => ({ ...m, lang: m.lang || lang }));
    }
  } catch (e) {
    last.error = e.message;
  }
  last.busy = false;
  rerender();
}

function extraFromScan() {
  const r = last?.result || {};
  const extra = {};
  if (r.grader && r.grader !== 'raw') { extra.grader = r.grader.toLowerCase(); extra.grade = r.grade || ''; }
  if (r.variant) extra.variant = r.variant;
  return extra;
}
function prefillCard() {
  const r = last?.result || {};
  return {
    name: r.name || r.name_fr || '', num: r.number || '', set: r.set || '', lang: LANGS[r.lang] ? r.lang : 'fr',
    year: r.year || '', rarity: r.rarity || '', ...extraFromScan(),
  };
}
function prefillItem() {
  const r = last?.result || {};
  return { name: r.name || r.name_fr || '', set: r.set || '', lang: LANGS[r.lang] ? r.lang : 'fr', category: CATEGORIES.includes(r.category) ? r.category : 'Autre' };
}

function resultHtml() {
  if (!last) {
    return `<div class="section"><div class="list">
      <div class="row"><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('camera')}</span></span><span class="main"><b>1. Photographiez</b><small>Carte, carte gradée ou produit scellé</small></span></div>
      <div class="row"><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('sparkle')}</span></span><span class="main"><b>2. Identification automatique</b><small>Nom, numéro, extension, langue, gradation</small></span></div>
      <div class="row"><span class="stat" style="padding:0;border:0;background:none"><span class="ico">${icon('check')}</span></span><span class="main"><b>3. Validez et ajoutez</b><small>Avec votre photo et la cote du marché</small></span></div>
    </div></div>`;
  }
  if (last.busy) return '<div class="section" style="text-align:center"><div class="loading" style="padding:10px"><div class="spinner"></div></div><p class="muted">Analyse en cours…</p></div>';
  if (last.error) return `<div class="section empty"><h3>Analyse impossible</h3><p>${esc(last.error)}</p><div class="btn-row" style="max-width:340px;margin:0 auto"><button class="btn" data-retry>${icon('refresh')}Réessayer</button><button class="btn primary" data-add-card>Saisir à la main</button></div></div>`;
  if (!last.result) {
    return `<div class="section"><div class="btn-row"><button class="btn" data-add-item>${icon('box')}Ajouter un item</button><button class="btn primary" data-add-card>${icon('cards')}Ajouter une carte</button></div></div>`;
  }
  const r = last.result;
  const title = r.name || r.name_fr || 'Produit non identifié';
  const sub = [r.set, r.number, r.lang && LANGS[r.lang] ? LANGS[r.lang].flag : '', r.grader && r.grader !== 'raw' ? `${String(r.grader).toUpperCase()} ${r.grade || ''}` : ''].filter(Boolean).join(' · ');
  if (r.type === 'item') {
    return `<div class="section"><div class="panel"><div class="faint" style="font-size:12px;font-weight:800">PRODUIT DÉTECTÉ</div>
      <h3 style="margin:4px 0 2px">${esc(title)}</h3><div class="muted" style="font-size:13px">${esc([r.category, r.set].filter(Boolean).join(' · '))}</div></div>
      <button class="btn primary block" style="margin-top:12px" data-add-item>${icon('plus')}Ajouter cet item</button></div>`;
  }
  const m = last.matches || [];
  return `<div class="section"><div class="panel"><div class="faint" style="font-size:12px;font-weight:800">CARTE DÉTECTÉE</div>
      <h3 style="margin:4px 0 2px">${esc(title)}</h3><div class="muted" style="font-size:13px">${esc(sub)}</div></div></div>
    <div class="section"><div class="section-head"><h2>${m.length ? 'Choisissez la bonne version' : 'Aucune correspondance catalogue'}</h2></div>
      ${m.length ? `<div class="grid" style="--cols:3">${m.map((c) => `<button class="tile" data-match="${esc(c.id)}" data-lang="${esc(c.lang)}">
        <div class="art">${c.image ? `<img src="${esc(cardImage(c.image))}" alt="" loading="lazy">` : `<span class="ph">${icon('image')}</span>`}</div>
        <div class="meta"><b>${esc(c.name)}</b><small>${esc(c.setName)} · ${esc(c.localId)}</small></div></button>`).join('')}</div>` : ''}
      <button class="btn block" style="margin-top:12px" data-add-card>${icon('edit')}Ajouter sans fiche catalogue</button>
    </div>`;
}
