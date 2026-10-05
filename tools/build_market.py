#!/usr/bin/env python3
"""Builds assets/data/sealed-market.json: the price index of every sealed product, read by the store edition.

Sources (all optional per product):
  g  GCC       real sales on Graded Card Center, French market          (assets/data/sealed-gcc.json)
  c  Cardmarket trend price, EU, every language                         (assets/data/sealed-cm.json)
  t  TCGplayer  US market price converted to euros (weak: low weight)   (assets/data/sealed-prices.json)

Method (inspired by what serious price indexes do, deliberately simple):
  1. GCC sales of the last 120 days are weighted by recency (half-life 21 days); sales 3x above or below the weighted
     median are dropped as unreliable; the source value is the weighted median of what is left.
  2. Each source gets a weight (GCC grows with the number of sales, Cardmarket 1, TCGplayer 0.25). A source more than
     3x away from the reference (GCC with 5+ sales, else Cardmarket, else the weighted median) is dropped.
  3. The index is the weighted geometric mean of the remaining sources.
  4. It moves at most 10 % per day compared with the previous run (isolated signals cannot cause sharp jumps).
  5. Confidence: 3 high (GCC with 5+ sales and Cardmarket agree within 25 %), 2 good (a solid source, or two that
     disagree), 1 medium (few sales), 0 low (TCGplayer only, or one or two sales).

Row: {v: index, c: confidence, s: {g, c, t}: each source value, x: dropped sources, n: GCC sales (last 30 days),
      t: 30-day change, l: [date, price] of the last GCC sale, h: [[date, price], ...] weekly history}.
"""
import json
import math
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'assets/data'
HALF_LIFE = 21.0
MAX_DAILY_MOVE = 0.10


def load(name):
    f = DATA / name
    try:
        return json.loads(f.read_text()) if f.exists() else None
    except Exception:
        return None


def get_fx():
    for url, pick in (('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR', lambda j: j['rates']['EUR']),
                      ('https://open.er-api.com/v6/latest/USD', lambda j: j['rates']['EUR'])):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CardVault'}), timeout=20) as r:
                v = float(pick(json.load(r)))
                if 0.3 < v < 2:
                    return v
        except Exception as e:
            print('  fx error', url, e, file=sys.stderr)
    return 0.86


def wmedian(vals, weights):
    pairs = sorted(zip(vals, weights))
    half = sum(weights) / 2
    acc = 0.0
    for v, w in pairs:
        acc += w
        if acc >= half:
            return v
    return pairs[-1][0]


def median(vals):
    return wmedian(vals, [1.0] * len(vals))


def r2(v):
    return None if v is None else round(v * 100) / 100


def gcc_estimate(sales, today):
    """sales: [[date, price], ...]. Returns None or a dict with the weighted value, counts and kept sales."""
    pts = []
    for d, p in sales:
        try:
            age = (today - date.fromisoformat(d)).days
        except Exception:
            continue
        if 0 <= age <= 120 and p and p > 0:
            pts.append((age, d, float(p)))
    if not pts:
        return None
    w = lambda age: 0.5 ** (age / HALF_LIFE)
    m = wmedian([p for _, _, p in pts], [w(a) for a, _, _ in pts])
    kept = [(a, d, p) for a, d, p in pts if m / 3 <= p <= m * 3]
    v = wmedian([p for _, _, p in kept], [w(a) for a, _, _ in kept])
    kept_desc = sorted(kept, key=lambda x: x[1], reverse=True)
    return {'v': v, 'n': len(kept), 'n30': sum(1 for a, _, _ in kept if a <= 30),
            'last': [kept_desc[0][1], r2(kept_desc[0][2])], 'kept': kept}


def change30(est, cm):
    """30-day change: recent GCC sales vs the 30-90 days before, else Cardmarket trend vs its 30-day average."""
    if est:
        recent = [p for a, _, p in est['kept'] if a <= 30]
        before = [p for a, _, p in est['kept'] if 30 < a <= 90]
        if len(recent) >= 2 and len(before) >= 2:
            return median(recent) / median(before) - 1
    if cm and cm[0] and cm[2]:
        return cm[0] / cm[2] - 1
    return None


def history(est, today_str, index, prev_h=None):
    """Weekly points (oldest first): previous history kept, weekly medians of the kept GCC sales, today's index."""
    weeks = {}
    wk = lambda d: date.fromisoformat(d) - timedelta(days=date.fromisoformat(d).weekday())
    for d, v in (prev_h or []):
        try:
            weeks[wk(d)] = [d, v]
        except Exception:
            pass
    if est:
        by_week = defaultdict(list)
        for _, d, p in est['kept']:
            by_week[wk(d)].append((d, p))
        for monday, items in by_week.items():
            weeks[monday] = [max(d for d, _ in items), r2(median([p for _, p in items]))]
    weeks[wk(today_str)] = [today_str, r2(index)]
    return [weeks[k] for k in sorted(weeks)][-60:]


def build_row(p, g_sales, cm, tcg_usd, fx, prev, today):
    today_str = today.isoformat()
    est = gcc_estimate(g_sales, today) if g_sales else None
    srcs = {}                                     # key -> (value, weight)
    if est:
        n = est['n']
        srcs['g'] = (est['v'], 0.0 if n < 1 else min(1.0, n / 8) if n >= 3 else 0.15)
    if cm and cm[0] and cm[0] > 0:
        srcs['c'] = (float(cm[0]), 1.0)
    if tcg_usd:
        srcs['e'] = (tcg_usd * fx, 0.5)
    srcs = {k: v for k, v in srcs.items() if v[0] > 0 and v[1] > 0}
    if not srcs:
        return None
    vals = sorted(v[0] for v in srcs.values())
    if len(vals) == 2 and vals[1] > vals[0] * 2 and not (est and est['n'] >= 5):
        return None   # two sources far apart and no solid French sales: no cote is better than a wrong one
    dropped = []
    if len(srcs) >= 2:
        # Reference = the best evidence: GCC with 5+ sales (real French sales), else Cardmarket, else the weighted median.
        n_ref = est['n'] if est else 0
        ref = srcs['g'][0] if 'g' in srcs and n_ref >= 5 else \
            wmedian([v for v, _ in srcs.values()], [w for _, w in srcs.values()])
        for k in list(srcs):
            if not (ref / 2 <= srcs[k][0] <= ref * 2):
                dropped.append(k)
                del srcs[k]
    tw = sum(w for _, w in srcs.values())
    index = math.exp(sum(w * math.log(v) for v, w in srcs.values()) / tw)
    if prev and prev.get('v') and prev.get('_age', 99) <= 10:
        index = min(max(index, prev['v'] * (1 - MAX_DAILY_MOVE)), prev['v'] * (1 + MAX_DAILY_MOVE))
    n_g = est['n'] if est else 0
    both = 'g' in srcs and 'c' in srcs
    agree = both and max(srcs['g'][0], srcs['c'][0]) / min(srcs['g'][0], srcs['c'][0]) <= 1.25
    strong = ('c' in srcs) or ('g' in srcs and n_g >= 5)
    if both and agree and n_g >= 5:
        conf = 3
    elif strong:
        conf = 2
    elif 'g' in srcs and n_g >= 3:
        conf = 1
    else:
        conf = 0
    row = {'v': r2(index), 'c': conf, 's': {}}
    if est:
        row['s']['g'] = r2(est['v'])
    if cm and cm[0]:
        row['s']['c'] = r2(float(cm[0]))
    if tcg_usd:
        row['s']['e'] = r2(tcg_usd * fx)
    if dropped:
        row['x'] = dropped
    if est:
        row['n'] = est['n30']
        row['l'] = est['last']
    ch = change30(est, cm)
    if ch is not None and abs(ch) < 5:
        row['t'] = round(ch, 4)
    row['h'] = history(est, today_str, index, prev.get('h') if prev else None)
    return row


def main():
    today = date.today()
    products = load('sealed.json')['products']
    gcc_file = load('sealed-gcc.json') or {}
    gcc = gcc_file.get('p', {}) if gcc_file.get('v') == 2 else {}      # v1 rows (older layout) are ignored
    cmj = load('sealed-cm.json') or {}
    cm = cmj.get('p', {})
    tcgj = load('sealed-ebay.json') or {}   # eBay France asking prices (tools/build_ebay.py)
    tcg = tcgj.get('p', {})
    old = load('sealed-market.json') or {}
    old_age = 99
    try:
        old_age = (today - date.fromisoformat(old.get('built'))).days
    except Exception:
        pass
    fx = 1.0
    rows = {}
    for p in products:
        pid = str(p['id'])
        g = gcc.get(pid)
        prev = dict(old.get('p', {}).get(pid) or {})
        prev['_age'] = old_age if old_age > 0 else 99      # same-day rerun: no smoothing against itself
        t = tcg.get(pid)
        row = build_row(p, g[1] if g else None, cm.get(pid), t[0] if t else None, fx, prev, today)
        if row:
            rows[pid] = row
    if not rows:
        raise SystemExit('Aucune cote, on garde le fichier précédent')
    conf = defaultdict(int)
    for r in rows.values():
        conf[r['c']] += 1
    print(f'{len(rows)} produits cotés / {len(products)}; confiance {dict(sorted(conf.items()))}; '
          f'GCC {sum(1 for r in rows.values() if "g" in r["s"])}, Cardmarket {sum(1 for r in rows.values() if "c" in r["s"])}, '
          f'TCGplayer {sum(1 for r in rows.values() if "t" in r["s"])}; fx {fx:.4f}')
    (DATA / 'sealed-market.json').write_text(json.dumps(
        {'built': today.isoformat(), 'cur': 'EUR', 'v': 2, 'p': rows}, separators=(',', ':'), ensure_ascii=False))


if __name__ == '__main__':
    main()
