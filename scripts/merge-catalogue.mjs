#!/usr/bin/env node
// Fusionne les deux sources du catalogue en public/data/products.json :
// - data/off-products.json : import Open Food Facts (scripts/import-off.mjs)
// - data/curated-products.json : produits ajoutés à la main (artisans, domaines, marques absentes d'OFF)
// Un produit curé déjà présent dans OFF (même marque, nom proche) n'est pas dupliqué :
// il complète la fiche OFF (région, style, source) au lieu de créer un doublon.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OFF = resolve(ROOT, 'data/off-products.json')
const CURATED = resolve(ROOT, 'data/curated-products.json')
const RETAILERS = resolve(ROOT, 'data/retailer-products.json')
const OUT = resolve(ROOT, 'public/data/products.json')
const MAX_ABV = 1.2

const readJson = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch { return fallback }
}

export const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(sans alcool|alcohol free|non alcoolisee?|0[,.]0 ?%?|0 ?%|biere|brasserie|domaine|la|le|les|de|du|des)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 60)

export function sameProduct(off, cur) {
  const ob = norm(off.brand)
  const cb = norm(cur.brand)
  if (!ob || !cb || !(ob.includes(cb) || cb.includes(ob))) return false
  const on = new Set(norm(off.name).split(' ').filter(Boolean))
  const cn = norm(cur.name).split(' ').filter(Boolean)
  if (cn.length === 0) return false
  return cn.every((w) => on.has(w))
}

export function merge(offProducts, curatedProducts) {
  const products = offProducts.map((p) => ({
    ...p,
    cat: /\b(cidre|cider)\b/i.test(`${p.name} ${p.brand}`) ? 'cidre' : p.cat,
  }))
  let added = 0
  let enriched = 0
  for (const c of curatedProducts) {
    if (c.abv != null && c.abv > MAX_ABV) continue
    const match = products.find((p) => sameProduct(p, c))
    if (match) {
      match.region = match.region ?? c.region ?? null
      match.style = match.style ?? c.style ?? null
      match.abv = match.abv ?? c.abv ?? null
      match.price = match.price ?? c.price ?? null
      match.quantity = match.quantity ?? c.quantity ?? null
      if (c.retailers) match.retailers = [...new Set([...(match.retailers || []), ...c.retailers])]
      enriched++
      continue
    }
    products.push({
      id: `cur-${slug(c.brand)}-${slug(c.name)}`,
      barcode: c.barcode ?? null,
      name: c.name,
      brand: c.brand,
      cat: c.cat,
      abv: c.abv ?? null,
      sugar: null,
      kcal: null,
      quantity: c.quantity ?? null,
      price: c.price ?? null,
      image: null,
      popularity: 0,
      style: c.style ?? null,
      region: c.region ?? null,
      note: c.note ?? null,
      sourceUrl: c.source ?? null,
      retailers: c.retailers ?? [],
      source: 'curated',
    })
    added++
  }
  return { products, added, enriched }
}

async function main() {
  const off = await readJson(OFF, { products: [] })
  const curated = await readJson(CURATED, { products: [] })
  const retailers = await readJson(RETAILERS, { products: [] })
  const { products, added, enriched } = merge(off.products || [], [...(curated.products || []), ...(retailers.products || [])])
  const out = {
    generatedAt: new Date().toISOString(),
    sources: {
      openFoodFacts: { count: (off.products || []).length, importedAt: off.generatedAt ?? null, license: 'ODbL 1.0' },
      curated: { added, enriched },
    },
    count: products.length,
    products,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
  console.log(`Catalogue : ${products.length} produits (${(off.products || []).length} OFF, ${added} ajoutés à la main, ${enriched} fiches OFF enrichies)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
