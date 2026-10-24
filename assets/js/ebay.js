// Active eBay France listings of a card or a product (through the proxy, tools/ebay-proxy/worker.js) and the French
// market estimate drawn from them. Shared by the detail sheet and the Monday / Thursday price update.
import { EBAY_API } from './edition.js?v=2.4.10-202610241907';

/* ---------- Classic-collection reprints ----------
   A 30th anniversary or Celebrations reprint carries the number of the original card (Metalosse 11/113 exists in
   2006 and in 2026): a sale or a listing counts for the reprint only when it says so, and never for the original. */
export const markText = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const REPRINT_MARK = /\b(30|25)\s?(e|eme|th|ans)\b|\b30c\b|anniv|celebration|collection classique|classic collection|reprint/;
const GRADED = /\b(psa|pca|cgc|bgs|sgs|ccc|beckett|collect aura|gradee?|graded)\b/;
// Same list as tools/build_ebay.py: listings of another language version.
const FOREIGN = /\b(japon\w*|jap|jp|anglais|english|eng|korean|coreen|chinese|chinois|allemand|deutsch|german|italien|italian|espagnol|spanish)\b/;
export const reprintOf = (a) => (/^30th-c-/.test(a.tcgdexId || '') ? '30' : /^cel25cc-/.test(a.tcgdexId || '') ? '25' : '');
export function sameEdition(a, text) {
  const t = markText(text);
  const r = reprintOf(a);
  if (!r) return !REPRINT_MARK.test(t) || /^(30th|cel25)/.test(a.tcgdexId || '') || /celebration|anniv/.test(markText(a.set));
  if (!REPRINT_MARK.test(t)) return false;
  return r === '30' ? !/\b25\s?(e|eme|th|ans)\b/.test(t) : !/\b30\s?(e|eme|th|ans)\b|\b30c\b/.test(t);
}

// The estimate is shown from 3 fixed-price listings; it becomes a card's value from 5 (fewer: one odd asking price
// would move it too much).
export const EST_MIN_VALUE = 5;

const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// kind: 'card' | 'item'. Returns { items, est, estCount }: est is the French market estimate of a French card, the
// same rule as the sealed products (tools/build_ebay.py): asking prices run above real sales, so the 30th percentile
// of the fixed-price listings, and at least 3 of them.
export async function ebayListings(a, kind = 'card') {
  if (!EBAY_API) return { items: [], est: null, estCount: 0 };
  const base = String(a.name || '').replace(/\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = fold(base).split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map((w) => (w.length > 5 ? w.slice(0, 5) : w));
  const isCard = kind === 'card';
  const q = base + ' pokemon' + (isCard && a.num ? ' ' + String(a.num).split('/')[0] : '');
  // A classic-collection reprint is often listed as "… 30 ans" without its number: ask for those too.
  const r = isCard ? reprintOf(a) : '';
  const queries = [q, ...(r ? [base + ' pokemon ' + (r === '30' ? '30 ans' : 'celebrations')] : [])];
  const answers = await Promise.all(queries.map(async (s) => {
    const res = await fetch(`${EBAY_API}?q=${encodeURIComponent(s)}`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return (await res.json()).items || [];
  }));
  const seen = new Set();
  // Keep only real matches: every word of the name, EUR prices, no empty boxes / proxies / lots.
  const bad = /\b(vide|empty|proxy|custom|reproduction|replica|fake|lot|boite seule|carte seule)\b/i;
  // Same card only: the full number (11/113, not 11/107), the same edition (original vs 30th reprint) and,
  // for a raw card, no graded slab.
  const [n, total] = isCard && a.num ? String(a.num).split('/').map((x) => x.trim().replace(/^0+(?=\d)/, '')) : [];
  const numRe = n && total ? new RegExp(`(^|\\D)0*${n}\\s*/\\s*0*${total}(\\D|$)`) : null;
  const raw = !a.grader || a.grader === 'raw';
  const items = answers.flat().filter((x) => {
    const key = x && x.title + '|' + x.price;    // the same listing comes back from both searches
    if (!x || seen.has(key)) return false;
    seen.add(key);
    const t = fold(x.title);
    if (x.currency !== 'EUR' || !(x.price > 0) || !words.every((w) => t.includes(w)) || bad.test(t)) return false;
    if (!isCard) return true;
    // Another number in the title (11/107, 11/128) is another card; no number at all is only accepted for a
    // reprint listed by its collection ("Metalosse 30 ans").
    if (numRe && !numRe.test(t) && (/\d+\s*\/\s*\d+/.test(t) || !(r && REPRINT_MARK.test(markText(x.title))))) return false;
    if (raw && GRADED.test(t)) return false;
    if (a.lang === 'fr' && FOREIGN.test(t)) return false;   // a French card is priced on French copies only
    return sameEdition(a, x.title);
  });
  const fixed = items.filter((x) => x.buying !== 'auction').map((x) => x.price).sort((p, q2) => p - q2);
  const est = isCard && a.lang === 'fr' && fixed.length >= 3 ? Math.round(fixed[Math.floor((fixed.length - 1) * 0.3)] * 100) / 100 : null;
  return { items, est, estCount: fixed.length };
}
