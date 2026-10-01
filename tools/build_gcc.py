#!/usr/bin/env python3
"""Builds assets/data/sealed-gcc.json: French-market price of every sealed product, from the real sales on
Graded Card Center (same logic as the personal server's gccItemInfo, ported from Node-RED).

Run daily by .github/workflows/sealed-prices.yml. The store edition reads this static file (GCC has no CORS),
so it shows the same cote as the personal edition. Row: [median90, lastSale, lastSaleDate, mean30, n30, n90, title].
"""
import json
import re
import statistics
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOST = 'https://api.gradedcardcenter.com'
HEADERS = {'x-device-platform': 'web', 'user-agent': 'PokedexInvest/2', 'accept': 'application/json'}
CAT_WORD = {'Blister': 'blister', 'Booster': 'booster', 'Bundle': 'bundle', 'ETB': 'etb', 'Display': 'display',
            'Coffret': 'coffret', 'Duo Pack': 'duo', 'Tripack': 'tripack', 'UPC': 'ultra', 'Pokébox': 'pokebox',
            'Valisette': 'valisette', 'Deck': 'deck'}
STOP_SET = {'et', 'de', 'des', 'la', 'le'}
PACKAGING = {'coffret', 'bundle', 'booster', 'blister', 'anniversaire'}
CODE_RE = re.compile(r'^(ev|eb|me|xy|sl|swsh|sv|bw|dp|sm|mep|svp)\d*(\.\d+)?$')
NUM_RE = re.compile(r'^\d+(\.\d+)?e?$')


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', str(s or '')) if not unicodedata.combining(c)).lower()


def words(s):
    return [w for w in re.sub(r'[^a-z0-9. ]+', ' ', fold(s)).split() if w]


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=25) as r:
                return json.load(r)
        except Exception as e:
            if attempt == 2:
                print('  GCC error:', e, file=sys.stderr)
                return None
            time.sleep(2 + attempt * 2)


_cache = {}


def sales_for(q):
    if q in _cache:
        return _cache[q]
    out, page, failed = [], 1, False
    while page and page <= 3:
        d = get(f'{HOST}/on-sale-items?status=SOLD&searchText={urllib.parse.quote(q)}&page={page}')
        if d is None:
            failed = True
            break
        for s in d.get('results') or []:
            it = s.get('item') or {}
            if (it.get('collectible') or {}).get('type') != 'CARDS':
                try:
                    price = float(s.get('price'))
                except (TypeError, ValueError):
                    continue
                out.append({'title': it.get('title') or '', 'price': price, 'soldAt': s.get('soldAt') or ''})
        page = (d.get('info') or {}).get('nextPage')
        time.sleep(0.3)
    _cache[q] = (out, failed)
    return _cache[q]


def r2(v):
    return None if v is None else round(v * 100) / 100


def median(a):
    return r2(statistics.median(a)) if a else None


def product_row(p, sales):
    cw = CAT_WORD.get(p.get('c'), '')
    set_w = [w for w in words(p.get('s')) if len(w) >= 3 and w not in STOP_SET]
    extra = [w for w in words(p.get('n')) if len(w) >= 4 and w not in set_w and w != cw and w not in PACKAGING]
    counts = {}
    for s in sales:
        tt = ' '.join(words(s['title']))
        if cw and cw not in tt:
            continue
        if cw == 'booster' and re.search(r'blister|display|bundle|duo|tripack', tt):
            continue
        if not all(w in tt for w in set_w):
            continue
        if not all(re.sub(r'-ex$', '', w) in tt for w in extra):
            continue
        counts[s['title']] = counts.get(s['title'], 0) + 1
    if not counts:
        return None
    known = set(words(p.get('n')) + set_w + [cw, 'booster', 'blister', 'collection', 'coffret', 'bundle', 'etb',
                                              'pokemon', 'ex', 'a', 'et', 'de', 'la', 'le', 'du'])

    def foreign(t):
        return len([w for w in words(t) if w not in known and not CODE_RE.match(w) and not NUM_RE.match(w)])

    title = sorted(counts, key=lambda t: (foreign(t), -counts[t]))[0]
    lst = sorted((s for s in sales if s['title'] == title), key=lambda s: s['soldAt'], reverse=True)
    if not lst:
        return None
    now = datetime.now(timezone.utc)

    def since(days):
        return (now - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%S')

    r90 = [s['price'] for s in lst if s['soldAt'] >= since(90)]
    m30 = [s['price'] for s in lst if s['soldAt'] >= since(30)]
    med = median(r90) if len(r90) >= 3 else None
    return [med, r2(lst[0]['price']), lst[0]['soldAt'][:10], r2(sum(m30) / len(m30)) if m30 else None,
            len(m30), len(r90), title]


def main():
    products = json.loads((ROOT / 'assets/data/sealed.json').read_text())['products']
    out_file = ROOT / 'assets/data/sealed-gcc.json'
    rows, fails, queries = {}, 0, 0
    for p in products:
        cw = CAT_WORD.get(p.get('c'), '')
        q = ' '.join(x for x in ['ETB' if cw == 'etb' else cw, p.get('s')] if x)
        if not q:
            continue
        sales, failed = sales_for(q)
        fails += failed
        queries = len(_cache)
        row = product_row(p, sales)
        if row and (row[0] is not None or row[1] is not None):
            rows[str(p['id'])] = row
    print(f'{len(rows)} produits cotés / {len(products)}, {queries} requêtes, {fails} en échec')
    if queries and fails > queries // 3:
        raise SystemExit('Trop d\'échecs GCC, on garde le fichier précédent')
    if not rows:
        raise SystemExit('Aucune cote GCC, on garde le fichier précédent')
    out_file.write_text(json.dumps({'built': time.strftime('%Y-%m-%d'), 'cur': 'EUR', 'p': rows},
                                   separators=(',', ':'), ensure_ascii=False))


if __name__ == '__main__':
    main()
