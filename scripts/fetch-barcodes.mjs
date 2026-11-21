#!/usr/bin/env node
// Récupère les codes-barres (EAN) des produits qui n'en ont pas.
// 1. Boutiques Shopify des cavistes : chaque fiche produit expose ses variantes en JSON (/products/<handle>.js),
//    avec le code-barres quand le marchand l'a saisi.
// 2. Open Food Facts : recherche par marque et nom pour les produits restants.
// Sortie : data/barcodes.json, lu par scripts/merge-catalogue.mjs.
// Tourne dans GitHub Actions (accès réseau), voir .github/workflows/barcodes.yml.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { norm } from './merge-catalogue.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'data/barcodes.json')
const UA = 'zero-app/0.1 (https://github.com/GaryBBQ75/zero-app)'
const SHOPS = [
  { label: 'Sanzalc', base: 'https://www.sanzalc.com' },
  { label: 'Gueule de Joie', base: 'https://www.gueuledejoie.com' },
  { label: 'Sans Alcool du Vigneron', base: 'https://www.sans-alcool-du-vigneron.fr' },
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const validEan = (c) => typeof c === 'string' && /^\d{8,14}$/.test(c.trim())

async function get(url, type = 'text') {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
      if (res.ok) return type === 'json' ? await res.json() : await res.text()
      if (res.status === 404) return null
      if (res.status === 429 || res.status >= 500) { await sleep(5000 * attempt); continue }
      return null
    } catch {
      await sleep(3000 * attempt)
    }
  }
  return null
}

const locs = (xml) => [...(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'))

async function shopProducts(shop) {
  const index = await get(`${shop.base}/sitemap.xml`)
  const sitemaps = locs(index).filter((u) => u.startsWith(`${shop.base}/sitemap_products`))
  const urls = []
  for (const sm of sitemaps) urls.push(...locs(await get(sm)).filter((u) => u.includes('/products/')))
  const items = []
  for (const url of urls) {
    const p = await get(`${url}.js`, 'json')
    await sleep(350)
    if (!p) continue
    const barcode = (p.variants || []).map((v) => (v.barcode || '').trim()).find(validEan)
    if (barcode) items.push({ shop: shop.label, title: p.title, vendor: p.vendor, barcode, url })
  }
  console.log(`${shop.label} : ${urls.length} fiches lues, ${items.length} avec code-barres`)
  return items
}

const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1))
function similarity(a, b) {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const w of ta) if (tb.has(w)) common++
  return common / Math.min(ta.size, tb.size)
}

async function offSearch(product) {
  const q = encodeURIComponent(`${product.brand} ${product.name}`)
  const data = await get(`https://search.openfoodfacts.org/search?q=${q}&page_size=8&fields=code,product_name,brands`, 'json')
  const hits = data?.hits || []
  let best = null
  for (const h of hits) {
    const brands = Array.isArray(h.brands) ? h.brands.join(' ') : h.brands || ''
    const nb = norm(brands)
    const pb = norm(product.brand)
    if (!nb || !pb || !(nb.includes(pb) || pb.includes(nb))) continue
    const s = similarity(product.name, h.product_name || '')
    if (s >= 0.6 && validEan(String(h.code)) && (!best || s > best.s)) best = { s, code: String(h.code), title: h.product_name }
  }
  return best
}

async function main() {
  const catalogue = JSON.parse(await readFile(resolve(ROOT, 'public/data/products.json'), 'utf8'))
  const shops = []
  for (const shop of SHOPS) shops.push(...await shopProducts(shop))

  const missing = catalogue.products.filter((p) => !p.barcode && p.brand !== 'Marque à préciser')
  const off = []
  for (const p of missing) {
    const hit = await offSearch(p)
    await sleep(700)
    if (hit) off.push({ id: p.id, barcode: hit.code, offTitle: hit.title, score: Math.round(hit.s * 100) / 100 })
  }
  console.log(`Open Food Facts : ${off.length} codes trouvés sur ${missing.length} produits cherchés`)

  await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), shops, off }, null, 1) + '\n')
}

main().catch((e) => { console.error(e); process.exit(1) })
