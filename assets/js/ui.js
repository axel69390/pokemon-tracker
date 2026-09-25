// Shared UI helpers: escaping, formatting, icons, sheets, toasts, images.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const money = (v, compact = false) => (v == null || !isFinite(v) ? '—' : (compact && Math.abs(v) >= 10000 ? eur0 : eur).format(v));
export const signed = (v) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + eur.format(Math.abs(v)));
export const pct = (v) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %');
export const trend = (v) => (v > 0.004 ? 'up' : v < -0.004 ? 'down' : 'flat');
export const pill = (v, label) => `<span class="pill ${trend(v)} num">${label ?? signed(v)}</span>`;

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export function dateFr(d, withYear = true) {
  if (!d) return '—';
  const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number);
  return `${dd} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const LANGS = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇬🇧', label: 'Anglais' },
  jp: { flag: '🇯🇵', label: 'Japonais' },
  de: { flag: '🇩🇪', label: 'Allemand' },
  it: { flag: '🇮🇹', label: 'Italien' },
  es: { flag: '🇪🇸', label: 'Espagnol' },
  kr: { flag: '🇰🇷', label: 'Coréen' },
  cn: { flag: '🇨🇳', label: 'Chinois' },
};
export const flag = (l) => `<span class="flag" title="${esc(LANGS[l]?.label || l || '')}">${LANGS[l]?.flag || '🏳️'}</span>`;

export const GRADERS = { raw: 'Raw', psa: 'PSA', pca: 'PCA', cgc: 'CGC', bgs: 'BGS', ccc: 'CCC', pg: 'PG', akat: 'Akatsuki', 'collect aura': 'Collect Aura', sfg: 'SFG', ace: 'ACE', other: 'Autre' };
export const gradeLabel = (c) => (!c.grader || c.grader === 'raw' ? '' : `${GRADERS[c.grader] || c.grader.toUpperCase()}${c.grade ? ' ' + c.grade : ''}`);
export const CONDITIONS = { mint: 'Mint', nm: 'Near Mint', ex: 'Excellent', gd: 'Good', lp: 'Light Played', pl: 'Played', po: 'Poor' };

export const CATEGORIES = ['Display', 'ETB', 'Bundle', 'UPC', 'Coffret', 'Duo Pack', 'Tripack', 'Blister', 'Booster', 'Pokébox', 'Valisette', 'Deck', 'Accessoire', 'Autre'];

/* ---------- Icons (Lucide-style, inline) ---------- */
const P = {
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3"/><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M21 12h-4a2 2 0 0 0 0 4h4v-4Z"/>',
  cards: '<rect x="3" y="4" width="12" height="17" rx="2"/><path d="M15 6.5 19.4 8a2 2 0 0 1 1.3 2.5l-3.6 10.4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="8" y="7" width="8" height="10" rx="1.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  settings: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3 5h18M6 12h12M10 19h4"/>',
  grid2: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  grid3: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/>',
  grid4: '<path d="M3 3h3v3H3zM8 3h3v3H8zM13 3h3v3h-3zM18 3h3v3h-3zM3 8h3v3H3zM8 8h3v3H8zM13 8h3v3h-3zM18 8h3v3h-3zM3 13h3v3H3zM8 13h3v3H8zM13 13h3v3h-3zM18 13h3v3h-3zM3 18h3v3H3zM8 18h3v3H8zM13 18h3v3h-3zM18 18h3v3h-3z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  camera: '<path d="M14.5 4h-5L7.5 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  up: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  sparkle: '<path d="M12 3 13.9 8.1 19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 3v4M21 5h-4"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  server: '<rect x="3" y="3" width="18" height="8" rx="2"/><rect x="3" y="13" width="18" height="8" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
};
export const icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

export const CATEGORY_ICON = {
  Booster: 'layers', Blister: 'layers', Tripack: 'layers', 'Duo Pack': 'layers', Display: 'box', ETB: 'box', Coffret: 'box', UPC: 'star',
  Bundle: 'box', Tin: 'box', Valisette: 'box', Deck: 'cards', Pokébox: 'box', Accessoire: 'star', Autre: 'box',
};

/* ---------- Toast ---------- */
let toastTimer;
export function toast(message, { error = false, ms = 2600 } = {}) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.className = 'toast' + (error ? ' err' : '');
  el.innerHTML = (error ? icon('info', 'sm down') : icon('check', 'sm up')) + `<span>${esc(message)}</span>`;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- Sheets (bottom modal) ---------- */
const stack = [];
export function openSheet({ title = '', body = '', full = false, onMount, onClose, headActions = '' } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const sheet = document.createElement('section');
  sheet.className = 'sheet' + (full ? ' full' : '');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.innerHTML = `<header class="sheet-head"><h3>${esc(title)}</h3>${headActions}<button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></header><div class="sheet-body"></div>`;
  const bodyEl = sheet.querySelector('.sheet-body');
  document.body.append(scrim, sheet);
  document.body.style.overflow = 'hidden';
  const api = {
    el: sheet, body: bodyEl,
    setTitle: (t) => { sheet.querySelector('.sheet-head h3').textContent = t; },
    render: (html) => { bodyEl.innerHTML = html; },
    close: () => close(),
  };
  const close = () => {
    if (api.closed) return;
    api.closed = true;
    sheet.classList.remove('open'); scrim.classList.remove('open');
    const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
    if (!stack.length) document.body.style.overflow = '';
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 280);
    onClose && onClose();
  };
  scrim.addEventListener('click', close);
  sheet.querySelector('[data-close]').addEventListener('click', close);
  stack.push(api);
  api.render(body);
  onMount && onMount(api);
  requestAnimationFrame(() => { sheet.classList.add('open'); scrim.classList.add('open'); });
  return api;
}
export const closeAllSheets = () => [...stack].reverse().forEach((s) => s.close());
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

export function confirmSheet(message, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const s = openSheet({
      title: 'Confirmation',
      body: `<p class="muted" style="margin:4px 0 20px">${esc(message)}</p>
        <div class="btn-row"><button class="btn" data-no>Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(ok)}</button></div>`,
      onClose: () => { if (!done) resolve(false); },
    });
    s.body.querySelector('[data-no]').onclick = () => s.close();
    s.body.querySelector('[data-yes]').onclick = () => { done = true; resolve(true); s.close(); };
  });
}

export function lightbox(src) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<img src="${esc(src)}" alt="">`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}

/* ---------- Images ---------- */
// Resizes a picked photo to a JPEG data URL (keeps uploads small for the Pi and mobile data).
export function resizeImage(file, maxSide = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

export function pickImage({ capture = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (capture) input.capture = 'environment';
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}

export function download(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Type-ahead suggestions ---------- */
// Shows a dropdown under `input` while typing. search(q) → items, render(item) → inner HTML, onPick(item).
export function attachSuggest(input, { search, render, onPick, min = 2, max = 8 }) {
  const host = input.closest('.field') || input.parentElement;
  host.style.position = 'relative';
  const box = document.createElement('div');
  box.className = 'suggest hidden';
  host.appendChild(box);
  let seq = 0;
  let items = [];
  const hide = () => box.classList.add('hidden');
  const run = debounce(async () => {
    const q = input.value.trim();
    const my = ++seq;
    if (q.length < min) { hide(); return; }
    box.innerHTML = '<div class="suggest-empty"><span class="spinner" style="width:16px;height:16px"></span></div>';
    box.classList.remove('hidden');
    try {
      const res = await search(q);
      if (my !== seq) return;
      items = res.slice(0, max);
      box.innerHTML = items.length
        ? items.map((it, i) => `<button type="button" data-i="${i}">${render(it)}</button>`).join('')
        : '<div class="suggest-empty">Aucune suggestion</div>';
    } catch {
      if (my === seq) box.innerHTML = '<div class="suggest-empty">Suggestions indisponibles</div>';
    }
  }, 250);
  input.setAttribute('autocomplete', 'off');
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (items.length && input.value.trim().length >= min) box.classList.remove('hidden'); });
  input.addEventListener('blur', () => setTimeout(hide, 180));
  // pointerdown fires before blur, so the pick is not lost when the keyboard closes.
  box.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    e.preventDefault();
    hide();
    onPick(items[+b.dataset.i]);
  });
}
