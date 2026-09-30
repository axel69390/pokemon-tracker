#!/usr/bin/env python3
"""Builds assets/data/sealed-prices.json: TCGplayer market price (USD) of every product of the sealed catalogue.

Run daily by .github/workflows/sealed-prices.yml. The app reads this static file (same origin, no API key,
no server) so a freshly added product gets a value immediately.
"""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = {'User-Agent': 'Mozilla/5.0 (CardVault price builder)'}


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                return None
            time.sleep(2 + attempt * 2)


def main():
    cat = json.loads((ROOT / 'assets/data/sealed.json').read_text())['products']
    wanted = {p['id'] for p in cat}
    groups = sorted({p['g'] for p in cat if p.get('g')})
    prices, failed = {}, 0
    for g in groups:
        data = get(f'https://tcgcsv.com/tcgplayer/3/{g}/prices')
        time.sleep(0.15)
        if not data:
            failed += 1
            continue
        for r in data.get('results', []):
            pid = r.get('productId')
            if pid not in wanted:
                continue
            market = r.get('marketPrice') or r.get('midPrice')
            low = r.get('lowPrice')
            if market and (pid not in prices or market > 0):
                prices[pid] = [round(market, 2), round(low, 2) if low else None]
    out = ROOT / 'assets/data/sealed-prices.json'
    old = json.loads(out.read_text()) if out.exists() else {}
    if failed > len(groups) // 4 and old:
        raise SystemExit(f'{failed} groups failed, keeping the previous file')
    out.write_text(json.dumps({'built': time.strftime('%Y-%m-%d'), 'cur': 'USD', 'p': prices}, separators=(',', ':')))
    print(f'{len(prices)} prix / {len(wanted)} produits, {failed} groupes en échec')


if __name__ == '__main__':
    main()
