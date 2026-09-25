// French catalogue of sealed products (built by tools/build_sealed.py from TCGplayer data).
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

let cache = null;
export function loadSealed() {
  if (!cache) {
    cache = fetch('assets/data/sealed.json?v=2.2.0')
      .then((r) => { if (!r.ok) throw new Error('Catalogue indisponible'); return r.json(); })
      .then((d) => d.products.map((p) => ({ ...p, key: fold(`${p.n} ${p.c}`) })))
      .catch((e) => { cache = null; throw e; });
  }
  return cache;
}

export const sealedImage = (id, size = 400) => `https://tcgplayer-cdn.tcgplayer.com/product/${id}_${size}w.jpg`;

// Every typed word must appear (accents and case ignored); newest products first.
export async function searchSealed(query = '', category = '') {
  const list = await loadSealed();
  const words = fold(query).split(' ').filter(Boolean);
  return list.filter((p) => (!category || p.c === category) && words.every((w) => p.key.includes(w)));
}

export const sealedPrefill = (p) => ({ name: p.n, category: p.c, set: p.s, image: sealedImage(p.id, 400), tcgplayerId: p.id, tcgplayerGroup: p.g || null });
