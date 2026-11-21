#!/usr/bin/env node
// Import du catalogue de boissons sans alcool vendues en France depuis Open Food Facts.
// Sortie : public/data/products.json
// Données : Open Food Facts, licence ODbL (attribution obligatoire, partage à l'identique de la base).
//
// Usage : node scripts/import-off.mjs
// Option : OFF_MAX_PAGES (pages de 100 produits par catégorie, défaut 5)

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/data/products.json')
const MAX_PAGES = Number(process.env.OFF_MAX_PAGES || 5)
const MAX_ABV = 1.2 // seuil légal français de la mention « sans alcool » pour la bière
const UA = 'zero-app/0.1 (https://github.com/GaryBBQ75/zero-app)'

// Catégories Open Food Facts visées, rangées dans les catégories de l'app.
// Une catégorie inconnue d'OFF renvoie simplement 0 produit.
export const SOURCES = [
  { tag: 'en:non-alcoholic-beers', cat: 'biere' },
  { tag: 'en:alcohol-free-beers', cat: 'biere' },
  { tag: 'en:low-alcohol-beers', cat: 'biere' },
  { tag: 'en:non-alcoholic-wines', cat: 'vin' },
  { tag: 'en:dealcoholised-wines', cat: 'vin' },
  { tag: 'en:alcohol-free-wines', cat: 'vin' },
  { tag: 'en:non-alcoholic-sparkling-wines', cat: 'vin' },
  { tag: 'en:non-alcoholic-spirits', cat: 'spiritueux' },
  { tag: 'en:alcohol-free-spirits', cat: 'spiritueux' },
  { tag: 'en:non-alcoholic-aperitifs', cat: 'aperitif' },
  { tag: 'en:non-alcoholic-cocktails', cat: 'aperitif' },
  { tag: 'en:mocktails', cat: 'aperitif' },
  { tag: 'en:non-alcoholic-ciders', cat: 'soft' },
  { tag: 'en:kombuchas', cat: 'soft' },
]

const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity',
  'nutriments', 'image_front_small_url', 'categories_tags', 'unique_scans_n',
].join(',')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(tag, page) {
  const url = new URL('https://world.openfoodfacts.org/api/v2/search')
  url.searchParams.set('categories_tags', tag)
  url.searchParams.set('countries_tags', 'en:france')
  url.searchParams.set('fields', FIELDS)
  url.searchParams.set('page_size', '100')
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort_by', 'unique_scans_n')
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return res.json()
    if (res.status === 429 || res.status >= 500) { await sleep(15000 * attempt); continue }
    throw new Error(`OFF ${res.status} sur ${tag} page ${page}`)
  }
  throw new Error(`OFF indisponible sur ${tag} page ${page}`)
}

const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10)

export function normalize(p, cat) {
  const n = p.nutriments || {}
  const name = (p.product_name_fr || p.product_name || '').trim()
  if (!p.code || !name) return null
  const abv = num(n.alcohol_100g ?? n.alcohol_value ?? n.alcohol)
  if (abv !== null && abv > MAX_ABV) return null
  return {
    id: `off-${p.code}`,
    barcode: String(p.code),
    name,
    brand: (p.brands || '').split(',')[0].trim() || 'Marque inconnue',
    cat,
    abv,
    sugar: num(n.sugars_100g),
    kcal: num(n['energy-kcal_100g']),
    quantity: p.quantity || null,
    image: p.image_front_small_url || null,
    popularity: p.unique_scans_n || 0,
    source: 'off',
  }
}

async function main() {
  const byCode = new Map()
  const stats = {}
  for (const { tag, cat } of SOURCES) {
    stats[tag] = 0
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchPage(tag, page)
      const products = data.products || []
      for (const raw of products) {
        const p = normalize(raw, cat)
        if (p && !byCode.has(p.barcode)) { byCode.set(p.barcode, p); stats[tag]++ }
      }
      await sleep(7000) // OFF limite la recherche à environ 10 requêtes par minute
      if (products.length < 100) break
    }
    console.log(`${tag}: ${stats[tag]} produits retenus`)
  }
  const products = [...byCode.values()].sort((a, b) => b.popularity - a.popularity)
  const out = {
    generatedAt: new Date().toISOString(),
    source: 'Open Food Facts (https://world.openfoodfacts.org)',
    license: 'ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/)',
    count: products.length,
    products,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
  console.log(`Total : ${products.length} produits écrits dans public/data/products.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
