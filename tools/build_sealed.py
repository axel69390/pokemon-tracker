#!/usr/bin/env python3
"""Builds assets/data/sealed.json: French catalogue of sealed Pokémon products.

Products and pictures come from tcgcsv.com (daily TCGplayer catalogue mirror);
set names are translated to French through TCGdex. Only products belonging to
a set that exists in French are kept, and they get a French name
("Display Flammes Fantasmagoriques", "ETB Évolutions Prismatiques"…).

Usage: python3 tools/build_sealed.py
"""
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'data' / 'sealed.json'
UA = {'User-Agent': 'Mozilla/5.0 (PokedexInvest catalogue builder)'}


def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2)


def fold(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# Ordered: first match wins. (regex on the English product name, French category, French label)
RULES = [
    (r'code card|\bcase\b|set of \d|art bundle|display box$|\bbundle of\b|booster box display', None, None),
    (r'ultra[- ]premium collection', 'UPC', 'UPC'),
    (r'elite trainer box', 'ETB', 'ETB'),
    (r'booster box|booster display', 'Display', 'Display'),
    (r'booster bundle', 'Bundle', 'Bundle'),
    (r'3 pack blister|three pack|3-pack', 'Tripack', 'Tripack'),
    (r'blister', 'Blister', 'Blister'),
    (r'collector chest|lunch box', 'Valisette', 'Valisette'),
    (r'\btin\b', 'Pokébox', 'Pokébox'),
    (r'build (&|and) battle', 'Coffret', 'Coffret Avant-Première'),
    (r'theme deck|battle deck|league battle deck|starter deck|\bdeck\b', 'Deck', 'Deck'),
    (r'booster pack|sleeved booster', 'Booster', 'Booster'),
    (r'premium collection|special collection|collection|\bbox\b', 'Coffret', 'Coffret'),
    (r'binder|portfolio|sleeves|playmat|deck box|card sleeves|pin', 'Accessoire', 'Accessoire'),
]


SPECIAL = {
    'sm base set': 'sun and moon', 'xy base set': 'xy', 'sv01 scarlet and violet base set': 'scarlet and violet',
    'swsh01 sword and shield base set': 'sword and shield', 'base set shadowless': 'base set',
    'sv scarlet and violet 151': '151', 'black and white': 'black and white',
}


def candidates(group_name):
    f = fold(group_name)
    out = [SPECIAL.get(f, f)]
    tail = fold(re.split(r':|\s-\s', group_name, maxsplit=1)[-1])
    out += [tail, re.sub(r'^ex ', '', tail), re.sub(r'^(scarlet and violet|sword and shield|sun and moon) ', '', tail),
            re.sub(r' base set$', '', tail), re.sub(r'\s*\(.*\)$', '', tail)]
    return out


WORDS = {'day': 'Jour', 'night': 'Nuit', 'and': 'et', 'revised unlimited edition': 'édition révisée', '1st edition': '1ère édition',
         'unlimited edition': 'édition illimitée', 'unlimited': 'illimitée', 'shadowless': 'sans ombre', 'gym': 'Arène'}
REGIONAL = [(r'^alolan (.+)$', "{} d'Alola"), (r'^galarian (.+)$', '{} de Galar'), (r'^hisuian (.+)$', '{} de Hisui'),
            (r'^paldean (.+)$', '{} de Paldea'), (r'^mega (.+)$', 'Méga-{}')]
SUFFIXES = {'ex', 'v', 'vmax', 'vstar', 'gx', 'lv.x', 'break', 'prime'}


def load_pokemon_names():
    q = '{ pokemon_v2_pokemonspeciesname(where:{language_id:{_in:[5,9]}}){ name language_id pokemon_species_id } }'
    req = urllib.request.Request('https://beta.pokeapi.co/graphql/v1beta', data=json.dumps({'query': q}).encode(),
                                 headers={**UA, 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        rows = json.load(r)['data']['pokemon_v2_pokemonspeciesname']
    fr, en = {}, {}
    for row in rows:
        (fr if row['language_id'] == 5 else en)[row['pokemon_species_id']] = row['name']
    return {en[i].lower(): fr[i] for i in en if i in fr}


def translate(text, names):
    """French rendering of a bracket variant such as 'Alolan Raichu' or 'Sylveon ex'."""
    parts = []
    for chunk in re.split(r'\s*(?:,|/|&)\s*', text):
        low = chunk.strip().lower()
        if low in WORDS:
            parts.append(WORDS[low]); continue
        tokens = low.split()
        suffix = ' '.join(t for t in tokens if t in SUFFIXES)
        core = ' '.join(t for t in tokens if t not in SUFFIXES)
        fmt = '{}'
        if core.startswith('shiny '):
            core, fmt = core[6:], '{} chromatique'
        for pat, f in REGIONAL:
            m = re.match(pat, core)
            if m:
                core, fmt = m.group(1), f
                break
        core = re.sub(r"^(day|night) ", lambda m: '', core) if core.split(' ', 1)[-1] in names else core
        tr = names.get(core)
        if tr:
            word = fmt.format(tr) + (' ' + suffix if suffix else '')
            if low.startswith('day '): word += ' Jour'
            if low.startswith('night '): word += ' Nuit'
            parts.append(word)
        else:
            parts.append(' '.join(WORDS.get(w, w) for w in chunk.strip().split()))
    return ', '.join(parts)


def classify(name):
    n = name.lower()
    for pat, cat, label in RULES:
        if re.search(pat, n):
            return cat, label
    return None, None


def main():
    en_sets = get('https://api.tcgdex.net/v2/en/sets')
    fr_sets = {s['id']: s['name'] for s in get('https://api.tcgdex.net/v2/fr/sets')}
    by_en = {}
    for s in en_sets:
        if s['id'] in fr_sets:
            by_en.setdefault(fold(s['name']), s['id'])

    names = load_pokemon_names()
    groups = get('https://tcgcsv.com/tcgplayer/3/groups')['results']
    out, seen, unmatched = [], set(), []
    for g in sorted(groups, key=lambda x: x['publishedOn'], reverse=True):
        set_id = next((by_en[c] for c in candidates(g['name']) if c in by_en), None)
        if not set_id:
            unmatched.append(g['name'])
            continue
        fr_set = fr_sets[set_id]
        products = get(f"https://tcgcsv.com/tcgplayer/3/{g['groupId']}/products")['results']
        time.sleep(0.15)
        for p in products:
            if any(e.get('name') == 'Number' for e in p.get('extendedData') or []):
                continue  # single card
            cat, label = classify(p['name'])
            if not cat:
                continue
            extra = []
            m = re.search(r'\[([^\]]+)\]', p['name'])
            if m:
                extra.append(translate(m.group(1), names))
            if 'pokemon center' in p['name'].lower():
                extra.append('Pokémon Center')
            if cat == 'Booster' and 'sleeved' in p['name'].lower():
                extra.append('sous blister')
            name = f"{label} {fr_set}" + (f" ({', '.join(extra)})" if extra else '')
            key = fold(name)
            if key in seen:
                continue
            seen.add(key)
            out.append({'id': p['productId'], 'n': name, 'c': cat, 's': fr_set, 'd': (g.get('publishedOn') or '')[:7]})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({'built': time.strftime('%Y-%m-%d'), 'products': out}, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(out)} produits -> {OUT} ({OUT.stat().st_size // 1024} Ko)')
    print('Groupes sans extension FR :', len(unmatched))


if __name__ == '__main__':
    main()
