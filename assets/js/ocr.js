// Card scanner without a server: reads the printed name and collector number from a photo, on the device.
// The OCR engine (Tesseract, WebAssembly) is downloaded on first use only, then cached by the browser.
import { asset } from './edition.js?v=2.4.9-202610241707';

const LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const LANG = 'fra';

let libPromise = null;
let workerPromise = null;
let onProgress = null;

function loadLib() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!libPromise) {
    libPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = LIB;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { libPromise = null; reject(new Error('Moteur de lecture indisponible (connexion nécessaire la première fois).')); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = loadLib().then((T) => T.createWorker(LANG, 1, {
      logger: (m) => { if (onProgress) onProgress(m); },
    })).catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

// Crops a band of the picture (fractions of its size), upscales it and boosts the contrast.
function band(img, x0, y0, x1, y1, { invert = false } = {}) {
  const sw = Math.round((x1 - x0) * img.width), sh = Math.round((y1 - y0) * img.height);
  const scale = Math.min(3, Math.max(1, 1600 / sw));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x0 * img.width, y0 * img.height, sw, sh, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  let lo = 255, hi = 0;
  const grey = new Uint8Array(c.width * c.height);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const v = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    grey[j] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  const span = Math.max(40, hi - lo);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    let v = ((grey[j] - lo) / span) * 255;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    if (invert) v = 255 - v;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// Pulls a collector number such as "025/165", "SWSH123", "TG05/TG30" out of raw text. The total may be followed
// by the rarity symbol, read as a digit or a letter ("11/113★" comes out as "11/1142").
export function parseNumber(text) {
  const t = text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[Il|](?=\d{2})|(?<=\d{2})[Il|]/g, '1');
  // Sparkles also produce digit soup ("977/226"): a number can exceed its total only by the secret rares. The
  // collector number is printed at the very bottom, and the text comes top to bottom: the last candidate wins.
  // A digit glued to the total is the rarity symbol misread, which may also have changed the last digit
  // ("113★" → "1123"): the total is then only known within ±1 (fuzzy).
  let found = null;
  for (const m of t.matchAll(/(?<![A-Za-z0-9])([A-Z]{0,3}\d{1,3})\s*[\/7]\s*([A-Z]{0,3}\d{2,3})/g)) {
    const n = parseInt(m[1].replace(/\D/g, ''), 10), tot = parseInt(m[2].replace(/\D/g, ''), 10);
    if (/[A-Z]/.test(m[1] + m[2]) || (n >= 1 && tot >= 10 && n <= tot * 1.6)) {
      found = { num: m[1], total: m[2], fuzzy: /\d/.test(t[m.index + m[0].length] || '') };
    }
  }
  if (found) return found;
  const m = t.match(/\b((?:SWSH|SV|SM|XY|BW|HGSS|DP|SVP|TG|GG)\s?\d{1,3})\b/i);
  if (m) return { num: m[1].replace(/\s/g, ''), total: '' };
  return null;
}

/* ---------- Pokémon names ----------
   A holo card makes the OCR read sparkles as letters: the words read are only trusted when they are close to a real
   Pokémon name (assets/data/pokemon-names.json, French and English). */
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
let dict = null;   // [{ fr, en, f: folded fr, e: folded en }]
const loadDict = () => (dict ||= fetch(asset('assets/data/pokemon-names.json')).then((r) => r.json())
  .then((rows) => rows.map(([, fr, en]) => ({ fr, en, f: fold(fr).replace(/ /g, ''), e: fold(en).replace(/ /g, '') })))
  .catch(() => { dict = null; return []; }));

// Letter-pair similarity (0..1): tolerant of misread letters ("Metal0sse", "Mctalosse").
export function similar(a, b) {
  const pairs = (s) => { const t = fold(s).replace(/ /g, ''); const out = []; for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2)); return out; };
  const x = pairs(a), y = pairs(b);
  if (!x.length || !y.length) return 0;
  const pool = [...y];
  let hit = 0;
  x.forEach((p) => { const i = pool.indexOf(p); if (i >= 0) { hit++; pool.splice(i, 1); } });
  return (2 * hit) / (x.length + y.length);
}

// Words of the rules text that look like Pokémon names once misread ("type" → Type:0): never a card name.
const CARD_WORDS = new Set(('type pokemon niveau evolution energie energies attaque attaques degats degat carte cartes votre vos deck main tour '
  + 'pouvoir talent dresseur especes espece delta faiblesse resistance retraite illus nintendo placez choisissez dessous dessus vous pouvez '
  + 'autres autre utilise special etat autant attachees voulez cette inflige plus chaque defaussee defaussez supplementaires cout fois lors '
  + 'avant adversaire actif banc jeu ce cet pioche piochez stade base basic stage weakness resistance retreat energy damage your this').split(' '));

// Words read (text, confidence, position y and letter height h, as fractions of the photo) → the Pokémon names they
// spell, best first, and the language they were written in (an English name such as "Metagross" means an English card).
async function namesFromWords(words) {
  const names = await loadDict();
  const tokens = [];
  words.forEach((w, i) => {
    const t = fold(w.text).replace(/[0-9 ]/g, '');
    if (t.length >= 4 && w.confidence >= 50 && !CARD_WORDS.has(t)) tokens.push({ t, c: w.confidence, y: w.y, h: w.h });
    const next = words[i + 1];   // two-word names: "Mr Mime", "Ho Oh"
    const plain = (x) => !CARD_WORDS.has(fold(x.text).replace(/[0-9 ]/g, ''));
    if (next && w.confidence >= 50 && next.confidence >= 50 && Math.abs(next.y - w.y) < 0.02 && plain(w) && plain(next)) {
      tokens.push({ t: fold(w.text + next.text).replace(/[0-9 ]/g, ''), c: Math.min(w.confidence, next.confidence), y: w.y, h: Math.max(w.h, next.h) });
    }
  });
  const hits = [];   // { fr, s, c, y, h, en }
  tokens.forEach(({ t, c, y, h }) => names.forEach((n) => {
    if (Math.abs(n.f.length - t.length) > 2 && Math.abs(n.e.length - t.length) > 2) return;
    const sf = similar(t, n.f), se = similar(t, n.e);
    const s = Math.max(sf, se);
    if (s >= (t.length < 7 ? 0.85 : 0.75)) hits.push({ fr: n.fr, s, c, y, h, en: se > sf && n.e !== n.f });
  }));
  // The card name is the largest text, at the top: "Évolution de Reptincel" in small print must not win over
  // "Dracaufeu". Letter height counts most, height on the photo a little.
  const maxH = Math.max(0, ...hits.map((x) => x.h || 0)) || 1;
  const best = new Map();   // fr name → { score, en }
  hits.forEach(({ fr, s, c, y, h, en }) => {
    const score = s * (0.5 + c / 200) * (0.4 + 0.6 * Math.min(1, (h || 0) / maxH)) * (1.15 - 0.3 * Math.min(1, y || 0));
    const prev = best.get(fr);
    if (!prev || score > prev.score) best.set(fr, { score, en });
  });
  // Runners-up only when nearly as likely as the best: a clear "Metalosse" must not bring "Malosse" along.
  const sorted = [...best.entries()].sort((a, b) => b[1].score - a[1].score);
  const ranked = sorted.filter(([, v]) => v.score >= (sorted[0]?.[1].score || 0) * 0.9).slice(0, 3);
  return { names: ranked.map(([fr]) => fr), lang: ranked[0] && ranked[0][1].en ? 'en' : 'fr' };
}

// Whole picture, enlarged to `max` pixels on its long side.
function scaled(img, max) {
  const k = Math.min(3, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// photo: data URL (the larger, the better the small number reads). Returns
// { names: [Pokémon names, best first], number: {num,total}|null, lang: 'fr'|'en' }.
export async function readCard(photo, progress) {
  onProgress = progress || null;
  const worker = await getWorker();
  const img = await loadImage(photo);
  const run = async (canvas, psm) => {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await worker.recognize(canvas);
    const words = (data.words || []).map((w) => ({
      text: w.text, confidence: w.confidence,
      y: w.bbox ? w.bbox.y0 / canvas.height : 0, h: w.bbox ? (w.bbox.y1 - w.bbox.y0) / canvas.height : 0,
    }));
    return { words, text: data.text || '' };
  };
  // 1. The whole photo as sparse text, which works whatever the framing (card on a table, in a sleeve, in a slab):
  //    a light pass reads the large name well, a detailed one the small collector number. The holo sparkles make
  //    each pass miss different words, so the second one also adds its words to the first.
  const words = [];
  let found = { names: [], lang: 'fr' };
  let number = null;
  for (const max of [1400, 2600]) {
    const pass = await run(scaled(img, max), 11);
    words.push(...pass.words);
    found = await namesFromWords(words);
    number = parseNumber(pass.text) || number;   // the detailed pass reads the small digits better
    if (found.names.length && number && number.total && !number.fuzzy) break;
  }
  let { names, lang } = found;
  // 2. A card filling the photo: its name band (top ~20 %) and number band (bottom ~20 %), enlarged and contrasted.
  if (!names.length) {
    const top = await run(band(img, 0.02, 0.01, 0.98, 0.2), 6);
    ({ names, lang } = await namesFromWords(top.words));
  }
  if (!number) number = parseNumber((await run(band(img, 0, 0.8, 1, 1), 11)).text);
  return { names, number, lang };
}

export function disposeOcr() {
  if (workerPromise) workerPromise.then((w) => w.terminate()).catch(() => {});
  workerPromise = null;
}
