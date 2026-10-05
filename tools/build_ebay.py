#!/usr/bin/env python3
"""Builds assets/data/sealed-ebay.json: asking prices of ACTIVE eBay France listings, one value per sealed product.

Reads the Cloudflare Worker that already holds the eBay keys (no secret here). Only fixed-price listings in EUR whose
title carries every word of the product name; lots, empty boxes, proxies and foreign-language versions are dropped.
Asking prices run above real sales, so the value is the 30th percentile of the listings, and a product needs at least
3 listings to get one. build_market.py uses it as a light-weight source next to GCC sales and Cardmarket.
Row: {id: [price, number of listings]}.
"""
import json
import re
import sys
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'assets/data'
WORKER = 'https://ebay-proxy.axel-ger.workers.dev/'
BAD = re.compile(r'\b(vide|empty|proxy|custom|reproduction|replica|fake|lot|lots|boite seule|carte seule|japon\w*|jap|jp|'
                 r'anglais|english|eng|korean|coreen|chinese|chinois|allemand|deutsch|german|italien|italian|espagnol|spanish)\b')
# Other product types a listing must NOT be when we price this category (a "Booster Célébrations" search also returns
# coffrets, ETB and displays that contain the word booster: they pulled the median up).
OTHER = {
    'Booster': r'coffret|etb|display|bundle|blister|tripack|tri pack|duo|pokebox|deck|tin|ultra|premium|collection|classique|classic|\d+ ?boosters|x ?\d+|36',
    'ETB': r'display|bundle|blister|tripack|tri pack|duo|pokebox|boosters? seuls?',
    'Bundle': r'display|etb|blister|tripack|tri pack|duo|pokebox',
    'Duo Pack': r'display|etb|bundle|tripack|tri pack|pokebox',
    'Display': r'etb|bundle|blister|tripack|tri pack|duo|pokebox|booster seul',
}
ANNIV30 = re.compile(r'\b30 ?(e|eme|ans|th)\b|30e')   # 30th anniversary (2026) vs Célébrations = 25th anniversary (2021)
GENERIC = {'pokemon', 'edition', 'promo', 'promos', 'coffret', 'display', 'booster', 'blister'}


def fold(t):
    return unicodedata.normalize('NFKD', str(t or '')).encode('ascii', 'ignore').decode().lower()


def words(t):
    return [w for w in re.split(r'[^a-z0-9]+', fold(re.sub(r'\([^)]*\)', ' ', t))) if len(w) >= 3]


def stem(w):
    return w[:5] if len(w) > 5 else w


def fetch(q):
    url = WORKER + '?q=' + urllib.parse.quote(q)
    for _ in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CardVault-index'}), timeout=25) as r:
                return json.load(r).get('items') or []
        except Exception:
            pass
    return None


def one(p):
    name = p['n']
    nw = words(name)
    if not nw:
        return None
    sw = [w for w in words(p.get('s') or '') if w not in nw and w not in GENERIC]
    q = re.sub(r'\s+', ' ', re.sub(r'\([^)]*\)', ' ', name)).strip() + (' ' + ' '.join(sw[:2]) if sw else '') + ' pokemon'
    items = fetch(q)
    if not items:
        return None
    prices = []
    for x in items:
        t = fold(x.get('title'))
        if x.get('currency') != 'EUR' or not x.get('price') or x['price'] <= 0 or x.get('buying') == 'auction':
            continue
        if OTHER.get(p.get('c')) and re.search(r'\b(' + OTHER[p['c']] + r')\b', t):
            continue
        if 'Célébrations' in (p.get('s') or '') and ANNIV30.search(t):
            continue
        if BAD.search(t) or not all(stem(w) in t for w in nw + words(' '.join(re.findall(r'\(([^)]*)\)', name)))):
            continue
        prices.append(float(x['price']))
    if len(prices) < 3:
        return None
    prices.sort()
    return [round(prices[int((len(prices) - 1) * 0.3)], 2), len(prices)]


def main():
    products = json.loads((DATA / 'sealed.json').read_text())['products']
    with ThreadPoolExecutor(6) as ex:
        res = list(ex.map(one, products))
    rows = {str(p['id']): r for p, r in zip(products, res) if r}
    if len(rows) < 20:
        sys.exit(f'Only {len(rows)} eBay rows: keeping the previous file')
    (DATA / 'sealed-ebay.json').write_text(json.dumps({'built': date.today().isoformat(), 'v': 1, 'p': rows}, separators=(',', ':')))
    print(f'eBay: {len(rows)} / {len(products)} products with 3+ listings')


if __name__ == '__main__':
    main()
