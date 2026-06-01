const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3456;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Pokemon API running' });
});

app.get('/cards', async (req, res) => {
  try {
    const { name, lang = 'fr', page = 1, limit = 12 } = req.query;
    if (!name) return res.json([]);
    const fetch = (await import('node-fetch')).default;
    const results = [];
    const seen = new Set();

    try {
      const url = `https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(name)}&page=${page}&itemsPerPage=${limit}`;
      const r = await fetch(url, { timeout: 5000 });
      if (r.ok) {
        const data = await r.json();
        const cards = Array.isArray(data) ? data : [];
        for (const c of cards) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            results.push({
              id: c.id,
              name: c.name || '',
              set: c.set?.name || c.set || '',
              number: c.localId || '',
              image: c.image ? c.image + '/low.webp' : '',
              lang: lang,
              src: 'tcgdex'
            });
          }
        }
      }
    } catch(e) {}

    if (lang === 'fr' && results.length < 5) {
      try {
        const urlEn = `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}&page=1&itemsPerPage=8`;
        const r2 = await fetch(urlEn, { timeout: 5000 });
        if (r2.ok) {
          const data2 = await r2.json();
          for (const c of (Array.isArray(data2) ? data2 : [])) {
            if (!seen.has('en_'+c.id)) {
              seen.add('en_'+c.id);
              results.push({
                id: 'en_'+c.id,
                name: c.name || '',
                set: c.set?.name || c.set || '',
                number: c.localId || '',
                image: c.image ? c.image + '/low.webp' : '',
                lang: 'en',
                src: 'tcgdex-en'
              });
            }
          }
        }
      } catch(e) {}
    }

    try {
      const urlTcgio = `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(name)}*&pageSize=8&orderBy=-set.releaseDate`;
      const r3 = await fetch(urlTcgio, { timeout: 5000 });
      if (r3.ok) {
        const data3 = await r3.json();
        for (const c of (data3.data || [])) {
          if (!seen.has('tcgio_'+c.id)) {
            seen.add('tcgio_'+c.id);
            const p = c?.tcgplayer?.prices;
            const mkt = p ? (p.holofoil?.market || p['1stEditionHolofoil']?.market || p.normal?.market || p.reverseHolofoil?.market || null) : null;
            results.push({
              id: 'tcgio_'+c.id,
              name: c.name || '',
              set: c.set?.name || '',
              number: c.number || '',
              image: c.images?.small || '',
              lang: 'en',
              src: 'tcgio',
              marketPrice: mkt ? Math.round(mkt * 92) / 100 : null,
              cardId: c.id
            });
          }
        }
      }
    } catch(e) {}

    res.json(results.slice(0, 20));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sets', async (req, res) => {
  try {
    const { lang = 'fr' } = req.query;
    const fetch = (await import('node-fetch')).default;
    const r = await fetch(`https://api.tcgdex.net/v2/${lang}/sets`, { timeout: 5000 });
    if (!r.ok) return res.json([]);
    res.json(await r.json());
  } catch(e) { res.json([]); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Pokemon API running on port ' + PORT);
});
