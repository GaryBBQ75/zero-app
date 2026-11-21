#!/usr/bin/env python3
"""Transforme les listes de titres des cavistes sans alcool (data/raw/*.txt)
en produits structurés : data/retailer-products.json.

Sources : sitemaps produits publics de sanzalc.com et gueuledejoie.com (novembre 2026).
Le script classe chaque titre (catégorie), détecte la marque et le taux d'alcool,
et écarte ce qui sort du positionnement (sirops, tonics, jus, coffrets...).
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'sanzalc': ('data/raw/sanzalc-titles.txt', 'https://www.sanzalc.com', 'Sanzalc'),
    'gueuledejoie': ('data/raw/gueuledejoie-titles.txt', 'https://www.gueuledejoie.com', 'Gueule de Joie'),
}

# Marques connues : la plus longue présente dans le titre l'emporte.
BRANDS = [
    "Sober Spirits", "OSCO", "Edmond", "Brique House", "Chouffe", "Liefmans", "Big Drop", "Brulo", "La Débauche",
    "Jupiler", "La Trappe", "Cornet", "Palm", "Estaminet", "Viven", "De Halve Maan", "Gimber", "Lyre's", "Kwaremont",
    "BrewDog", "Brussels Beer Project", "Martini", "Mikkeller", "Nona Drinks", "Tanqueray", "Paulaner", "Pierre Zéro",
    "JNPR", "Carlsberg", "Force Majeure", "UBY", "Jardins", "Chavin Zéro", "Château Clos de Boüard", "Djin",
    "Collective Arts", "Noughty", "French Bloom", "RUN'HARD", "Domaine de l'Arjolle", "Domaine de la Grenaudière",
    "Moderato", "Tante Nonneke", "Château La Coste", "Athletic Brewing", "BapBap", "Sommer", "Tempera",
    "Sarment Zéro", "Strauch", "Cave de Ribeauvillé", "Spiritique", "To Øl", "Craig Allan", "Maison Sassy",
    "Trottinette", "O'dacieux", "Zeronimo", "Bergdolt-Reif & Nett", "Bibo Runge", "Matthias Anton", "Sauv'Terre",
    "Symples", "Archipel", "Mash Gang", "Belgian Balance", "Below Brew", "Divin", "Nolow", "Põhjala", "Kasteel",
    "Maïa", "Prizm", "Loven", "Cristal Limiñana", "Bertinchamps", "Lupulus", "Track Brewing", "Guinness",
    "Captain Morgan", "SAM", "Vicaris", "Nepo", "Funky Fluid", "Motte Cordonnier", "Maison Héritage", "Granith",
    "Tandem", "Kahol", "Oh My Baie", "Goodsy", "Delirium", "Hommelbier", "Leffe", "Almave", "Broother", "Nivers",
    "Basqueland", "Feral", "Brasserie Dubuisson", "Cuvée des Jonquilles", "The Garden Brewery", "Fraugruber",
    "Cambier", "Poussière de Lune", "ISH Spirits", "Douze", "Les Crapauds Fous", "Lindemans", "French Paradox",
    "Aubert & Mathieu", "Mauperier", "Glen Dochus", "Nautile", "Moutard", "Vault City", "Pallini", "Alefarm",
    "Crocodile Brothers", "Whiplash", "Gross", "Karmeliet", "Sigalas Rabaud", "Citadelle", "Adriatico",
    "Villa Martelle", "Brouwerij 't IJ", "Moersleutel", "L'Alchimiste", "Everleaf", "La Corne", "Bendorf",
    "Jaanihanso", "Vedett", "Moulins d'Ascq", "St Bernardus", "Thrive", "Déserteur", "Beefeater", "Finote",
    "Berger", "Opius", "vandeStreek", "Brasserie Borinage", "Brasserie la Dilettante", "Piggy Brewing",
    "Cloudwater", "Siren", "Silvio Carta", "Popihn", "Verdant", "Neon Raptor", "Namur", "Affligem", "Paljas",
    "Society De La Rassi", "Bolle", "Opia", "La Côte de Vincent", "Brooklyn Brewery", "Appalina", "Brasserie De Sutter",
    "Le Petit Etoilé", "Unaju", "No Ghost in a Bottle", "Lowlander", "Domaine des Grottes", "Jopen", "Frogbeer",
    "William Grant", "Les filles de l'Ouest", "Kiss'Wing", "Optimae", "Kolonne Null", "Pierre Zéro Signature",
    "Niets Co.", "Dr Jaglas", "Sapinca", "Koko Kombucha", "Sparkteez", "Goxoa", "Kéfirade", "Arensbak", "Buddy",
    "Roots Divino", "Penrose", "Cypher", "Spunky", "Brasserie Parallèle", "Vignobles Raguenot", "Bemuse",
    "Far and Son", "Rish", "Ambijus", "Feragaia", "Wine Impact", "Pink Sun Brewing", "Oddbird", "La Madura",
    "Uiltje", "Maison Specht", "EPLEM", "Beach Bum", "Sovage", "Midi Apéritifs", "Tête Haute", "Nighthawks",
    "Bargemone", "Krombacher", "Meteor", "Super 8", "Domaine de Montrose", "Nasdrow", "Château d'Estoublon",
    "Yoleau", "Paragon", "Oma Frida", "Trip", "Belzar", "Bitburger", "Les Brasseurs du Sornin", "La Face Cachée",
    "Majolia", "Ethic Drinks", "La Provenquière", "Les Brasseurs De La Jonte", "AIKAN", "Gueule de Joie",
    "Kisumé", "Captain Morgan",
]
ALIASES = {
    'ribo': 'Cave de Ribeauvillé', 'rib0': 'Cave de Ribeauvillé', 'nooh': 'Château La Coste',
    'prince oscar': 'Château Clos de Boüard', 'eden by coralie': 'Château Clos de Boüard',
    'phénomène': 'Domaine de la Grenaudière', 'arjolle': "Domaine de l'Arjolle", 'nett': 'Bergdolt-Reif & Nett',
    'anton': 'Matthias Anton', 'bibo runge': 'Bibo Runge', 'delirio': 'Delirium', 'lowa trolls': 'Brasserie Dubuisson',
    'cristal 100': 'Cristal Limiñana', 'placebo': 'Lupulus', 'sportzot': 'De Halve Maan', 'sport zot': 'De Halve Maan',
    'cute and sober': 'La Débauche', 'baby hazy': 'La Débauche', 'agent modérateur': 'Craig Allan',
    'implosion': 'To Øl', 'yu no': 'Spiritique', 'limonello': 'Silvio Carta', 'kisumé': 'Aubert & Mathieu',
    'pico bello': 'Brussels Beer Project', 'delta zero': 'Brussels Beer Project', 'yops': 'Prizm', 'nolo': 'Prizm',
    'icauna': 'Popihn', 'blanche de namur': 'Namur', 'chavin zero': 'Chavin Zéro', 'chavin zéro': 'Chavin Zéro',
    'brasserie parallèle': 'Brasserie Parallèle', 'la brasserie parallèle': 'Brasserie Parallèle',
    'sigalas': 'Moderato', 'cuvée révolutionnaire': 'Moderato', 'lune d\'archipel': 'Archipel',
    'plein soleil d\'archipel': 'Archipel', 'urine zéro': 'Brasserie Borinage', 'la java': 'Brasserie la Dilettante',
    'testa rossa': 'Piggy Brewing', 'pohjala': 'Põhjala', 'louis 0': 'Motte Cordonnier', 'même pas mal': 'Tandem',
    'koko': 'Koko Kombucha', 'pierre zéro signature': 'Pierre Zéro Signature', 'tanqueray sevilla': 'Tanqueray',
}

SKIP = re.compile(r"\b(sirop|carte[- ]cadeau|coffret|collection|pack|offre|calendrier|s[ée]lection|bo[iî]te cadeau|chips|speculoos|duo de bulles|kit|tonic water|ginger ale|ginger beer|cola\b|limonade|orangeade|nectar|jus de raisin|th[ée] glac[ée]|citronnade|mat[ée] glac[ée]|premix|intégrale|incontournables|gamme complète|«)", re.I)

CATS = [
    ('cidre', r"\bcidre|\bcider"),
    ('soft', r"kombucha|k[ée]fir|infusion|clean soda|schorle|elixir|th[ée] p[ée]tillant|earl grey|unaju|spunky|houblonade|mindful blend|sapinca|ambijus|rish\b|antidote|antilope"),
    ('aperitif', r"osco|jardins|bulles de|djin|gimber|lune d'archipel|plein soleil d'archipel|no ghost|nona ginger|spritz|ap[ée]riti|bitter|\bamer\b|amaroz|anis[ée]|cocktail|mojito|paloma|daïquiri|daiquiri|margarita|martini|vermouth|aperitivo|aperiniets|vrmh|bttr|sprz|nivers|feral|douze|tempera|riva|tierra|calda|pyra|aria|eterna|villa martelle|maïa|gin tonic|scarlet|limonello|limoncello|limello|botaniets|ose n°|palo santo|ruby rush|roots divino|finote|opius|ginto|gingerum"),
    ('spiritueux', r"\bgin\b|rhum|whisky|bourbon|\bspirit|spiritueux|distillat|amaretto|tequila|agave|\bjnpr\b|rhhm|almave|everleaf|crocodile|atopia|havaniets|nona june|citadelle|yu no|far and son|feragaia|babylon garden|atlantis|american malt|white cane|dark cane|orange sec|coffee originale|gold cane|captain morgan|kahol|glen dochus|botanicals|hibiscus - far"),
    ('biere', r"highway to hell|cloudy krush|bi[èe]re|\bipa\b|neipa|lager|stout|gose|\bsour\b|\bale\b|pale|blonde|blanche|tripel|triple|kriek|\bwit\b|weissbier|brune|ambr[ée]e|pils|dubbel|wit\b|hazy|chug|cult|punk af|energibajer|weird weather|drink in the sun|easy peasy|bird of prey|minim'ale|placebo|pico bello|kasteel|chouffe|estaminet|jupiler|carlsberg|bitburger|vedett|lupulus|lowa trolls|même pas mal|agent modérateur|sport ?zot|a la cool|dark amber|prenzlauer|fun ?house|playground|bumper|special effects|spécial effects|c'est pas banal|la face cachée|piggy driver|karmeliet|bernardus|delirio|hommelbier|poussière de lune|crapauds fous|pecheresse|pêcheresse|fruitesse|rubus|tropical|donker|liefmans|cute and sober|young pug|motor oil|wrench|paljas|wild juice|unruly|all hopped up|implosion"),
    ('vin', r"\bvin\b|effervescent|p[ée]tillant|mousseux|spumante|espumante|ros[ée]|rouge|blanc|chardonnay|sauvignon|merlot|pinot|syrah|cabernet|grenache|riesling|gew[uü]rz|colombard|chenin|viognier|tempranillo|verdejo|gamay|malbec|zweigelt|veltliner|muscat|melon|s[ée]millon|shiraz|brut|blend|cuv[ée]e|classico|french kiss|french touch|french cancan|granith|oma frida|kisumé|nooh|prince oscar|addiction|alternative 0|origo|fiora|calluna|java|oh my baie|equinoxe|équilibre|tip top|sauv'terre|o'dacieux"),
]

def strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

def find_brand(title, source):
    low = title.lower()
    for k, v in sorted(ALIASES.items(), key=lambda kv: -len(kv[0])):
        if k in low:
            return v
    best = None
    for b in BRANDS:
        if re.search(r'(?<![\w])' + re.escape(b.lower()) + r'(?![\w])', low):
            if best is None or len(b) > len(best):
                best = b
    if best:
        return best
    if source == 'gueuledejoie' and ' - ' in title:
        return title.rsplit(' - ', 1)[1].strip()
    return None

def find_abv(title):
    t = title.replace(',', '.')
    m = re.search(r'<\s*0?\.?(\d)\s*%', t)
    if m:
        return 0.5
    for m in re.finditer(r'(\d+(?:\.\d+)?)\s*%', t):
        v = float(m.group(1))
        if v <= 1.2:
            return v
    if re.search(r'\b0\.0+\b|\b0°|\bz[ée]ro\b', t, re.I):
        return 0.0
    return None

def find_quantity(title):
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(cl|ml|l)\b', title, re.I)
    if not m:
        return None
    return f"{m.group(1)} {m.group(2).lower()}"

def category(title):
    for cat, rx in CATS:
        if re.search(rx, title, re.I):
            return cat
    return None

def clean_name(title, brand):
    n = title
    n = re.sub(r'\s*[-–]\s*(\d+(?:[.,]\d+)?\s*(cl|ml|l)|bouteille \d+ ?cl)\s*$', '', n, flags=re.I)
    n = re.sub(r'\b\d+(?:[.,]\d+)?\s*(cl|ml)\b', '', n, flags=re.I)
    n = re.sub(r'<?\s*\d+(?:[.,]\d+)?\s*%', '', n)
    n = re.sub(r'\b0[.,]0+\b', '', n)
    n = re.sub(r'\bsans alcool\b|\bni gluten\b|\bde France\b', '', n, flags=re.I)
    if brand:
        n = re.sub(r'\s*[-–]\s*' + re.escape(brand) + r'\s*$', '', n, flags=re.I)
        n = re.sub(re.escape(brand), '', n, flags=re.I)
    n = re.sub(r'^\s*(Bière|Vin)\s+', '', n, flags=re.I)
    n = re.sub(r'\s+[-–]\s*$|^\s*[-–]\s+', '', n)
    n = re.sub(r'\s{2,}', ' ', n).strip(' -–,')
    n = re.sub(r'\s+(de|par|by|x)$', '', n, flags=re.I).strip(' -–,')
    if len(n) > 38 and ',' in n:
        n = n.split(',')[0]
    if len(n) > 38 and ' - ' in n:
        n = n.split(' - ')[0]
    n = n.strip(' -–,')
    if n and n[0].islower():
        n = n[0].upper() + n[1:]
    return n or title

def key(brand, name):
    k = strip_accents(f"{brand or ''} {name}").lower()
    k = re.sub(r'\b(bio|biologique|le|la|les|de|du|des|et|&|l)\b', ' ', k)
    return ' '.join(sorted(set(re.findall(r'[a-z0-9]+', k))))

def main():
    out, seen, skipped, uncategorized = [], {}, 0, []
    for source, (path, url, label) in SOURCES.items():
        for line in (ROOT / path).read_text(encoding='utf-8').splitlines():
            title = line.strip()
            if not title:
                continue
            if SKIP.search(title):
                skipped += 1
                continue
            brand_guess = find_brand(title, source)
            cat = category(re.sub(re.escape(brand_guess), '', title, flags=re.I) if brand_guess else title) or category(title)
            if not cat:
                uncategorized.append(title)
                continue
            brand = find_brand(title, source)
            name = clean_name(title, brand)
            k = key(brand, name)
            if k in seen:
                seen[k]['retailers'] = sorted(set(seen[k]['retailers'] + [label]))
                continue
            item = {
                'brand': brand or 'Marque à préciser',
                'name': name,
                'cat': cat,
                'style': None,
                'abv': find_abv(title),
                'region': None,
                'quantity': find_quantity(title),
                'source': url,
                'retailers': [label],
            }
            seen[k] = item
            out.append(item)
    (ROOT / 'data/retailer-products.json').write_text(json.dumps({
        'about': 'Produits relevés dans les catalogues publics des cavistes sans alcool Sanzalc et Gueule de Joie (novembre 2026). Généré par scripts/parse_retailers.py.',
        'products': out,
    }, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    counts = {}
    for p in out:
        counts[p['cat']] = counts.get(p['cat'], 0) + 1
    print(f"{len(out)} produits retenus, {skipped} écartés (hors positionnement), {len(uncategorized)} non classés")
    print(counts)
    for t in uncategorized:
        print('  ? ', t)

if __name__ == '__main__':
    main()
