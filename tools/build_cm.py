#!/usr/bin/env python3
"""Builds assets/data/sealed-cm.json: Cardmarket prices (EUR) of the sealed products of the catalogue.

Cardmarket publishes its price guide and product catalogue for download (public, no key, refreshed daily):
  https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json            (game 6 = Pokémon)
  https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json   (sealed products)
Products there carry English names only, so our catalogue (TCGplayer ids, English names on tcgcsv.com) is matched by
normalised name. A product is only matched when exactly one Cardmarket product has that name: a wrong match is worse
than no match. Row: [trend, avg7, avg30, low, cardmarketId]. The prices cover every language (the public guide has no
language split), which the app says.

Run daily by .github/workflows/sealed-prices.yml (after build_prices.py). Never fails the workflow: no file, no Cardmarket.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://downloads.s3.cardmarket.com/productCatalog'
GAME = 6
UA = {'User-Agent': 'Mozilla/5.0 (CardVault price builder)'}


def get(url, tries=3):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == tries - 1:
                print('  error', url, e, file=sys.stderr)
                return None
            time.sleep(2 + attempt * 2)


def norm(name):
    """Comparable form of a product name (English, Cardmarket or TCGplayer flavour)."""
    s = unicodedata.normalize('NFD', str(name or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c)).lower()
    if '—' in s:                      # TCGplayer: "Scarlet & Violet—Prismatic Evolutions Elite Trainer Box"
        s = s.split('—', 1)[1]
    s = s.replace('&', ' and ').replace("'", '').replace('’', '')
    s = re.sub(r'pok[eé]mon center( exclusive)?', 'pkmncenter', s)
    s = re.sub(r'\bpok[eé]mon\b|\btcg\b', ' ', s)
    s = re.sub(r'\b(sleeved )?booster pack\b', lambda m: (m.group(1) or '') + 'booster', s)
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return re.sub(r'\bthe\b', '', s).replace('  ', ' ').strip()


def first_list(d, keys):
    for k in keys:
        if isinstance(d.get(k), list):
            return d[k]
    for v in d.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v
    return []


def main():
    products = json.loads((ROOT / 'assets/data/sealed.json').read_text())['products']
    cat = get(f'{BASE}/productList/products_nonsingles_{GAME}.json')
    guide = get(f'{BASE}/priceGuide/price_guide_{GAME}.json')
    if not cat or not guide:
        raise SystemExit('Cardmarket indisponible, on garde le fichier précédent')
    cm_products = first_list(cat, ['products'])
    cm_prices = first_list(guide, ['priceGuides', 'products'])
    print(f'Cardmarket : {len(cm_products)} produits non-singles, {len(cm_prices)} prix; clés prix: {sorted(cm_prices[0].keys()) if cm_prices else "?"}')

    by_name = {}
    for c in cm_products:
        by_name.setdefault(norm(c.get('name')), []).append(c)
    price_of = {p.get('idProduct'): p for p in cm_prices}

    groups = sorted({p['g'] for p in products if p.get('g')})
    en_name = {}
    for g in groups:
        data = get(f'https://tcgcsv.com/tcgplayer/3/{g}/products')
        time.sleep(0.12)
        for r in (data or {}).get('results', []):
            en_name[r.get('productId')] = r.get('name')

    rows, unmatched, ambiguous = {}, [], 0
    for p in products:
        name = en_name.get(p['id'])
        if not name:
            continue
        cands = by_name.get(norm(name), [])
        if len(cands) != 1:
            if len(cands) > 1:
                ambiguous += 1
            elif len(unmatched) < 60:
                unmatched.append(name)
            continue
        pr = price_of.get(cands[0].get('idProduct'))
        if not pr:
            continue
        trend, avg7, avg30, low = (pr.get(k) for k in ('trend', 'avg7', 'avg30', 'low'))
        if not (trend or avg30 or pr.get('avg')):
            continue
        rows[str(p['id'])] = [trend or pr.get('avg'), avg7, avg30, low, cands[0].get('idProduct')]
    print(f'{len(rows)} produits cotés Cardmarket / {len(products)}, {ambiguous} ambigus')
    if not rows:
        raise SystemExit('Aucun produit apparié, on garde le fichier précédent')
    out = {'built': time.strftime('%Y-%m-%d'), 'cur': 'EUR', 'p': rows,
           'dbg': {'matched': len(rows), 'total': len(products), 'ambiguous': ambiguous, 'unmatched': unmatched}}
    (ROOT / 'assets/data/sealed-cm.json').write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))


if __name__ == '__main__':
    main()
