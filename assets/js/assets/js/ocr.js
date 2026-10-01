// Card scanner (beta): reads the printed name and collector number from a photo, on the device.
// The OCR engine (Tesseract, WebAssembly) is downloaded on first use only, then cached by the browser.
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

const clean = (s) => s.replace(/[|_~*«»"“”<>{}\[\]\\^=+@#$%&]/g, ' ').replace(/\s+/g, ' ').trim();

// Pulls a collector number such as "025/165", "SWSH123", "TG05/TG30" out of raw text.
export function parseNumber(text) {
  const t = text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[Il|](?=\d{2})|(?<=\d{2})[Il|]/g, '1');
  let m = t.match(/\b([A-Z]{0,3}\d{1,3})\s*[\/7]\s*([A-Z]{0,3}\d{2,3})\b/);
  if (m) return { num: m[1], total: m[2] };
  m = t.match(/\b((?:SWSH|SV|SM|XY|BW|HGSS|DP|SVP|TG|GG)\s?\d{1,3})\b/i);
  if (m) return { num: m[1].replace(/\s/g, ''), total: '' };
  return null;
}

// Candidate names from the top band, best first.
export function parseNames(text) {
  const lines = text.split(/\n/).map(clean).filter((l) => /[A-Za-zÀ-ÿ]{3,}/.test(l));
  const out = [];
  for (const l of lines) {
    // Drop "Niveau 45", "PV 120", "Base", "Évolution de …", "STADE 1" and other card chrome.
    let n = l.replace(/\b(PV|HP)\s*\d+\b/gi, ' ').replace(/\b(niv(eau)?|lv|lvl|level)\.?\s*\d+\b/gi, ' ')
      .replace(/\b(base|stade\s*\d|basic|stage\s*\d|évolution|evolution|pokémon|pokemon|dresseur|trainer|énergie|energy)\b/gi, ' ')
      .replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
    n = n.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
    if (n.length >= 3 && !out.includes(n)) out.push(n);
  }
  // Long phrases: also try the longest words on their own.
  const extra = [];
  out.slice(0, 3).forEach((n) => n.split(' ').filter((w) => w.length >= 4).forEach((w) => { if (!out.includes(w) && !extra.includes(w)) extra.push(w); }));
  return [...out.slice(0, 4), ...extra.slice(0, 3)];
}

// photo: data URL. Returns { names:[...], number:{num,total}|null, raw:{top,bottom} }.
export async function readCard(photo, progress) {
  onProgress = progress || null;
  const worker = await getWorker();
  const img = await loadImage(photo);
  const T = window.Tesseract;
  const run = async (canvas, psm) => {
    await worker.setParameters({ tessedit_pageseg_mode: String(psm) });
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  };
  // Name sits in the top ~16 % of a card; the number in the bottom ~14 %.
  const top = await run(band(img, 0.04, 0.02, 0.96, 0.17), T.PSM ? T.PSM.SINGLE_BLOCK : 6);
  let bottom = await run(band(img, 0.02, 0.86, 0.98, 0.99), T.PSM ? T.PSM.SINGLE_BLOCK : 6);
  let number = parseNumber(bottom);
  if (!number) { // the picture may include margins: try a wider bottom band, then the whole card
    bottom += '\n' + await run(band(img, 0, 0.78, 1, 1), 11);
    number = parseNumber(bottom);
  }
  let names = parseNames(top);
  if (names.length < 2) { // photo with margins: look at the whole upper third as well
    const wide = await run(band(img, 0, 0, 1, 0.32), 6);
    parseNames(wide).forEach((n) => { if (!names.includes(n)) names.push(n); });
    names = names.slice(0, 7);
  }
  if (!names.length || !number) { // last resort: sparse-text reading of the whole photo
    const all = await run(band(img, 0, 0, 1, 1), 11);
    if (!number) number = parseNumber(all);
    if (!names.length) names = parseNames(all);
  }
  return { names, number, raw: { top, bottom } };
}

export function disposeOcr() {
  if (workerPromise) workerPromise.then((w) => w.terminate()).catch(() => {});
  workerPromise = null;
}
