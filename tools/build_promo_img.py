#!/usr/bin/env python3
"""Builds assets/data/promo-img.json: TCGplayer picture id of every card of the promo sets.

TCGdex has no illustration for the promo cards (MEP), so the app takes the TCGplayer picture
(https://tcgplayer-cdn.tcgplayer.com/product/<id>_400w.jpg). Keyed by set id then card number.
Source: tcgcsv.com (daily TCGplayer mirror). Where a number has several versions (staff, prerelease,
Pokémon Center…), the plain one wins.
"""
import json
import re
import time
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'data' / 'promo-img.json'
UA = {'User-Agent': 'Mozilla/5.0 (PokedexInvest catalogue builder)'}
GROUPS = {'mep': 24451}   # tcgcsv group ids


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def main():
    out = {}
    for set_id, gid in GROUPS.items():
        rows = {}
        for p in get(f'https://tcgcsv.com/tcgplayer/3/{gid}/products')['results']:
            num = next((e['value'] for e in p.get('extendedData') or [] if e.get('name') == 'Number'), None)
            if not num:
                continue
            num = re.sub(r'\D', '', num.split('/')[0]).zfill(3)
            plain = not re.search(r'\[|\(', p['name'].split(' - ', 1)[-1] if ' - ' in p['name'] else p['name'])
            old = rows.get(num)
            if old is None or (plain and not old[1]):
                rows[num] = (p['productId'], plain)
        out[set_id] = {k: v[0] for k, v in sorted(rows.items())}
        print(set_id, len(rows), 'cards')
    OUT.write_text(json.dumps(out, separators=(',', ':'), ensure_ascii=False))


if __name__ == '__main__':
    main()
