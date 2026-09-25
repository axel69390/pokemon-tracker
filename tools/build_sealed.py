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
    (r'2-pack blister|2 pack blister|two pack', 'Duo Pack', 'Duo Pack'),
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


# Descriptors that tell apart products of the same set and category (English → French).
DESCR = [
    (r'poster collection', 'Poster'), (r'knock ?out collection', 'Knock Out'), (r'tech sticker collection', 'Stickers'),
    (r'figure collection', 'Figurine'), (r'binder collection', 'Classeur'), (r'pin collection', "Pin's"),
    (r'super[- ]premium collection', 'Super Premium'), (r'premium collection', 'Premium'), (r'special collection', 'Spéciale'),
    (r'illustration collection', 'Illustration'), (r'mini tin', 'Mini'), (r'stacking tin', 'Empilable'),
    (r'surprise box', 'Surprise'), (r'stadium', 'Stade'), (r'portfolio', 'Portfolio'), (r'accessory pouch', 'Pochette'),
]
STRIP = [r'ultra[- ]premium collection', r'elite trainer box', r'booster box', r'booster display', r'booster bundle',
         r'sleeved booster( pack)?', r'booster packs?', r'[23][- ]pack blister', r'blister( pack)?', r'checklane', r'single pack',
         r'build (&|and) battle', r'collection', r'\bbox(es)?\b', r'\btins?\b', r'theme deck', r'battle deck', r'league battle deck',
         r'\bdeck\b', r'pokemon center', r'exclusive', r'\bdisplay\b', r'\bbundle\b', r'\bpremium\b', r'\bkit\b', r'\bpack\b']


def describe(en_name, set_names, names):
    n = re.sub(r'\((international|retail|english|us) version\)', ' ', en_name, flags=re.I)
    brackets = re.findall(r'\[([^\]]+)\]', n)
    n = re.sub(r'\[[^\]]+\]|\([^)]*\)', ' ', n)
    for sn in sorted(set_names, key=len, reverse=True):
        if sn:
            n = re.sub(re.escape(sn), ' ', n, flags=re.I)
    low = ' ' + n.lower().replace('pokémon', 'pokemon') + ' '
    extras = []
    for pat, fr in DESCR:
        if re.search(pat, low):
            extras.append(fr)
            low = re.sub(pat, ' ', low)
    for pat in STRIP:
        low = re.sub(pat, ' ', low)
    rest = re.sub(r'[^a-z0-9éèà\'.&\- ]', ' ', low)
    rest = ' '.join(rest.replace(' - ', ' ').split()).strip(' -&')
    if rest and rest not in ('ex', 'and', 'the', 'of', 'set', 'series'):
        extras.append(translate(rest, names))
    extras += [translate(b, names) for b in brackets if not re.match(r'set of \d', b, re.I)]
    return [e for e in extras if e]


EXTRA_WORDS = [(r'\b1st Edition\b', '1ère édition'), (r'\bUnlimited Edition\b', 'édition illimitée'),
               (r'\bUnlimited\b', 'illimitée'), (r'\bShadowless\b', 'sans ombre')]


def finalize(products, names):
    """French clean-up of generated names, then de-duplication."""
    out, seen = [], set()
    for x in products:
        for a, r in EXTRA_WORDS:
            x['n'] = re.sub(a, r, x['n'])
        m = re.match(r'^(.*?) \((.*)\)$', x['n'])
        if m:
            head, inner = m.groups()
            parts = []
            for part in inner.split(', '):
                p = part.strip()
                if p.lower() == x['s'].lower():
                    continue
                if p.lower().startswith(x['s'].lower() + ' '):
                    p = p[len(x['s']) + 1:]
                if p and p[0].islower():
                    p = translate(p, names)
                    p = {'classic': 'Classique'}.get(p.lower(), p)
                    p = p[:1].upper() + p[1:]
                if p and p not in parts:
                    parts.append(p)
            x['n'] = head + (' (' + ', '.join(parts) + ')' if parts else '')
        k = fold(x['n'])
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out


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
            tail = re.split(r':|\s-\s', g['name'], maxsplit=1)[-1].strip()
            extra = describe(p['name'], [g['name'], tail, re.sub(r'^(EX|SM|XY|SWSH\d*|SV\d*|ME\d*)\s+', '', tail)], names)
            if 'pokemon center' in p['name'].lower():
                extra.append('Pokémon Center')
            if cat == 'Booster' and 'sleeved' in p['name'].lower():
                extra.append('sous blister')
            name = f"{label} {fr_set}" + (f" ({', '.join(extra)})" if extra else '')
            key = fold(name)
            if key in seen:
                continue
            seen.add(key)
            out.append({'id': p['productId'], 'g': g['groupId'], 'n': name, 'c': cat, 's': fr_set, 'd': (g.get('publishedOn') or '')[:7]})
    out = finalize(out, names)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({'built': time.strftime('%Y-%m-%d'), 'products': out}, ensure_ascii=False, separators=(',', ':')))
    print(f'{len(out)} produits -> {OUT} ({OUT.stat().st_size // 1024} Ko)')
    print('Groupes sans extension FR :', len(unmatched))


if __name__ == '__main__':
    main()
