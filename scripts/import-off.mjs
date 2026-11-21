#!/usr/bin/env node
// Import du catalogue de boissons sans alcool vendues en France depuis Open Food Facts.
// Sortie : data/off-products.json, puis fusion avec le catalogue curé (scripts/merge-catalogue.mjs)
// Données : Open Food Facts, licence ODbL (attribution obligatoire, partage à l'identique de la base).
//
// Usage : node scripts/import-off.mjs
// Option : OFF_MAX_PAGES (pages de 100 produits par catégorie, défaut 5)

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'data/off-products.json')
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
  { tag: 'en:non-alcoholic-ciders', cat: 'cidre' },
  { tag: 'en:kombuchas', cat: 'soft' },
]

const FIELDS = [
  'code', 'product_name', 'product_name_fr', 'brands', 'quantity',
  'nutriments', 'image_front_small_url', 'image_front_url', 'categories_tags', 'unique_scans_n',
  'ingredients_text_fr', 'ingredients_text', 'labels_tags', 'origins', 'manufacturing_places', 'generic_name_fr',
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
  let last = ''
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(60000) })
      if (res.ok) return await res.json()
      last = `HTTP ${res.status}`
      if (res.status !== 429 && res.status < 500) break
    } catch (e) {
      last = e.name || 'erreur réseau'
    }
    await sleep(20000 * attempt)
  }
  console.warn(`  ${tag} page ${page} ignorée (${last})`)
  return null
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
    image: p.image_front_url || p.image_front_small_url || null,
    ingredients: (p.ingredients_text_fr || p.ingredients_text || '').trim() || null,
    description: (p.generic_name_fr || '').trim() || null,
    labels: (p.labels_tags || []).filter((l) => /organic|bio|vegan|gluten-free|no-gluten/.test(l)).map((l) => l.replace(/^[a-z]{2}:/, '')),
    origin: [p.origins, p.manufacturing_places].filter(Boolean).join(', ') || null,
    popularity: p.unique_scans_n || 0,
    source: 'off',
  }
}

async function main() {
  const byCode = new Map()
  const stats = {}
  let failures = 0
  for (const { tag, cat } of SOURCES) {
    stats[tag] = 0
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await fetchPage(tag, page)
      if (!data) { failures++; break }
      const products = data.products || []
      for (const raw of products) {
        const p = normalize(raw, cat)
        if (p && !byCode.has(p.barcode)) { byCode.set(p.barcode, p); stats[tag]++ }
      }
      await sleep(10000) // OFF limite la recherche à environ 10 requêtes par minute
      if (products.length < 100) break
    }
    console.log(`${tag}: ${stats[tag]} produits retenus`)
  }
  if (byCode.size === 0) throw new Error('Aucun produit récupéré : catalogue existant conservé.')
  if (failures) console.warn(`${failures} catégorie(s) incomplète(s), relancer plus tard pour compléter.`)
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
  console.log(`Total : ${products.length} produits OFF écrits dans data/off-products.json`)
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/merge-catalogue.mjs')], { stdio: 'inherit' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
