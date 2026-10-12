import { settings } from '../settings.js?v=2.4.8-202610122059';
import { server, searchCards, findByNumber, tcgLang, cardImage } from '../api.js?v=2.4.8-202610122059';
import { readCard, similar } from '../ocr.js?v=2.4.8-202610122059';
import { esc, icon, pickImage, resizeImage, toast, LANGS, CATEGORIES } from '../ui.js?v=2.4.8-202610122059';
import { openCatalogueCard, openForm } from '../sheets.js?v=2.4.8-202610122059';

// Two engines: the personal server's AI when one is configured, otherwise the text printed on the card is read on
// the device (ocr.js) and matched against the catalogue, number first.
let last = null; // { photo, result | read, matches, error } — kept while navigating

export function render(main) {
  const ready = settings.isServer();
  main.innerHTML = `
    <div class="scan-stage" id="stage">
      ${last?.photo ? `<img src="${esc(last.photo)}" alt="">` : '<div class="frame"></div><div class="hint">Cadrez la carte seule, bien à plat</div>'}
      ${last?.busy ? '<div class="beam"></div>' : ''}
    </div>
    <div class="scan-actions">
      <button class="btn primary" data-shot="camera">${icon('camera')}${last?.photo ? 'Nouvelle photo' : 'Photographier'}</button>
      <button class="btn" data-shot="gallery">${icon('image')}Importer</button>
    </div>
    ${ready ? '' : `<p class="note" style="text-align:center;margin-top:-4px">${icon('info', 'sm')} Lecture sur l’appareil : la photo ne quitte pas votre téléphone. Remplissez le cadre avec la carte, sans reflet.</p>`}
    <div id="scan-result">${resultHtml()}</div>`;

  main.onclick = async (e) => {
    const t = e.target.closest('[data-shot],[data-match],[data-add-card],[data-add-item],[data-retry],[data-research]');
    if (!t) return;
    if (t.dataset.shot) {
      const file = await pickImage({ capture: t.dataset.shot === 'camera' });
      if (!file) return;
      try {
        const photo = await resizeImage(file, 1100, 0.85);   // kept with the card
        // The device reader needs many more pixels to read the small collector number; this copy is never stored.
        const hires = ready ? null : await resizeImage(file, 2400, 0.9);
        last = { photo, hires };
        analyse(main);
      } catch (err) { toast(err.message, { error: true }); }
    }
    if ('retry' in t.dataset) analyse(main);
    if ('research' in t.dataset) research(main);
    if (t.dataset.match) openCatalogueCard(t.dataset.lang, t.dataset.match, { photoData: last.photo, extra: extraFromScan() });
    if ('addCard' in t.dataset) openForm('card', null, prefillCard(), { photoData: last.photo });
    if ('addItem' in t.dataset) openForm('item', null, prefillItem(), { photoData: last.photo });
  };
}

const rerender = () => { const m = document.querySelector('main.view'); if (m && location.hash.startsWith('#/scan')) render(m); };

async function analyse(main) {
  last = { photo: last.photo, hires: last.hires, busy: true };
  render(main);
  if (!settings.isServer()) return analyseOnDevice();
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

/* ---------- Device reading ---------- */
const normNum = (n) => String(n || '').split('/')[0].replace(/^0+(?=\d)/, '').trim().toLowerCase();

function progressLabel(m) {
  if (!m || !m.status) return '';
  if (/load|initiali/i.test(m.status)) return 'Préparation du lecteur (téléchargé une seule fois)…';
  if (/recogniz/i.test(m.status)) return `Lecture de la carte… ${Math.round((m.progress || 0) * 100)} %`;
  return '';
}

async function analyseOnDevice() {
  try {
    const ocr = await readCard(last.hires || last.photo, (m) => {
      const label = progressLabel(m);
      const el = document.getElementById('scan-progress');
      if (label && el) el.textContent = label;
    });
    const number = ocr.number ? (ocr.number.total ? `${ocr.number.num}/${ocr.number.total}` : ocr.number.num) : '';
    const fuzzy = !!ocr.number?.fuzzy;
    last.read = { name: ocr.names[0] || '', number, names: ocr.names, lang: ocr.lang };
    last.matches = await matchCards(ocr.names, number, ocr.lang, fuzzy);
  } catch (e) {
    last.error = e.message;
  }
  last.busy = false;
  rerender();
}

// The user corrected the name or the number read on the card.
async function research(main) {
  const name = (document.getElementById('scan-name')?.value || '').trim();
  const number = (document.getElementById('scan-num')?.value || '').trim();
  last.read = { ...last.read, name, number, names: name ? [name] : [] };
  last.busy = true;
  render(main);
  try { last.matches = await matchCards(last.read.names, number, last.read.lang); } catch (e) { last.error = e.message; }
  last.busy = false;
  rerender();
}

// Candidates from the printed number (sets of that size + classic reprints) and from the names read, ranked by
// how well they agree with both. Catalogue of the language the name was read in first, the other one when nothing fits.
// fuzzy: the total was read next to the rarity symbol and may be off by one.
async function matchCards(names, number, readLang = 'fr', fuzzy = false) {
  const [num, total] = String(number || '').split('/').map((x) => x.trim());
  const totals = !total ? [''] : fuzzy ? [+total - 1, +total, +total + 1] : [+total];
  for (const lang of readLang === 'en' ? ['en', 'fr'] : ['fr', 'en']) {
    const [byNum, ...byName] = await Promise.all([
      num ? Promise.all(totals.map((t) => findByNumber(num, t, lang).catch(() => []))).then((x) => x.flat()) : [],
      ...names.slice(0, 3).map((n) => searchCards(n, { lang, number: num }).catch(() => [])),
    ]);
    const seen = new Map();
    [...byNum, ...byName.flat()].forEach((c) => { if (!seen.has(c.id)) seen.set(c.id, c); });
    const scored = [...seen.values()].map((c) => {
      const pn = c.printed || c.localId;
      const [, pt] = String(c.printed || '').split('/');
      const numOk = num && normNum(pn) === normNum(num);
      const totalOk = total && totals.includes(+pt || c.setTotal);
      const nameSim = Math.max(0, ...names.map((n) => similar(n, c.name)));
      return { ...c, lang, named: nameSim >= 0.5, score: (nameSim >= 0.5 ? 4 * nameSim : 0) + (numOk ? 2 : 0) + (totalOk ? 1 : 0) };
    });
    // A name read on the card outweighs the number (small digits are misread more often): when some candidates bear
    // that name, the others only came from a misread number. Without a name, the number decides.
    const pool = scored.some((c) => c.named) ? scored.filter((c) => c.named) : scored.filter((c) => c.score >= 2);
    // Without a number, every version of that Pokémon may be the one: show them all (newest first).
    if (pool.length) return pool.sort((a, b) => b.score - a.score || b.order - a.order).slice(0, num ? 12 : 90);
  }
  return [];
}

function extraFromScan() {
  const r = last?.result || {};
  const extra = {};
  if (r.grader && r.grader !== 'raw') { extra.grader = r.grader.toLowerCase(); extra.grade = r.grade || ''; }
  if (r.variant) extra.variant = r.variant;
  return extra;
}
function prefillCard() {
  if (last?.read) return { name: last.read.name || '', num: last.read.number || '', lang: last.read.lang || 'fr' };
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
  if (last.busy) return '<div class="section" style="text-align:center"><div class="loading" style="padding:10px"><div class="spinner"></div></div><p class="muted" id="scan-progress">Analyse en cours…</p></div>';
  if (last.error) return `<div class="section empty"><h3>Analyse impossible</h3><p>${esc(last.error)}</p><div class="btn-row" style="max-width:340px;margin:0 auto"><button class="btn" data-retry>${icon('refresh')}Réessayer</button><button class="btn primary" data-add-card>Saisir à la main</button></div></div>`;
  if (last.read) return readResultHtml();
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
        <div class="meta"><b>${esc(c.name)}</b><small>${esc(c.setName)} · ${esc(c.printed || c.localId)}</small></div></button>`).join('')}</div>` : ''}
      <button class="btn block" style="margin-top:12px" data-add-card>${icon('edit')}Ajouter sans fiche catalogue</button>
    </div>`;
}

const matchGrid = (m) => `<div class="grid" style="--cols:3">${m.map((c) => `<button class="tile" data-match="${esc(c.id)}" data-lang="${esc(c.lang)}">
  <div class="art">${c.image ? `<img src="${esc(cardImage(c.image))}" alt="" loading="lazy">` : `<span class="ph">${icon('image')}</span>`}</div>
  <div class="meta"><b>${esc(c.name)}</b><small>${esc(c.setName)} · ${esc(c.printed || c.localId)}${c.lang !== 'fr' ? ' · ' + esc(c.lang.toUpperCase()) : ''}</small></div></button>`).join('')}</div>`;

// Device reading: what was read (editable, in case a letter or a digit was misread) and the catalogue matches.
function readResultHtml() {
  const r = last.read;
  const m = last.matches || [];
  return `<div class="section"><div class="panel"><div class="faint" style="font-size:12px;font-weight:800">LU SUR LA CARTE</div>
      <div class="form-grid" style="margin-top:8px">
        <label class="field"><span>Nom</span><input id="scan-name" value="${esc(r.name)}" placeholder="Métalosse" autocomplete="off"></label>
        <label class="field"><span>Numéro</span><input id="scan-num" value="${esc(r.number)}" placeholder="11/113" inputmode="text" autocomplete="off"></label>
      </div>
      <button class="btn block" style="margin-top:4px" data-research>${icon('search')}Corriger et relancer la recherche</button></div></div>
    <div class="section"><div class="section-head"><h2>${m.length ? 'Choisissez la bonne version' : 'Aucune carte trouvée'}</h2>${m.length > 1 ? `<span class="faint" style="font-size:12px">${m.length} cartes</span>` : ''}</div>
      ${m.length && !r.number && m.length > 6 ? `<div class="banner" style="margin-top:0">${icon('info')}<div class="main">Numéro non lu : tapez-le ci-dessus (en bas de la carte, par exemple 11/113) pour trouver directement la bonne version.</div></div>` : ''}
      ${m.length ? matchGrid(m) : '<p class="muted" style="margin:0 0 10px">Vérifiez le nom et le numéro ci-dessus (ils sont imprimés en haut et en bas de la carte), ou reprenez la photo de plus près.</p>'}
      <button class="btn block" style="margin-top:12px" data-add-card>${icon('edit')}Ajouter sans fiche catalogue</button>
    </div>`;
}
