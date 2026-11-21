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
      match.sugar = match.sugar ?? c.sugar ?? null
      match.kcal = match.kcal ?? c.kcal ?? null
      match.note = match.note ?? c.note ?? null
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
      sugar: c.sugar ?? null,
      kcal: c.kcal ?? null,
      quantity: c.quantity ?? null,
      price: c.price ?? null,
      image: null,
      popularity: 0,
      style: c.style ?? null,
      region: c.region ?? null,
      note: c.note ?? null,
      sourceUrl: c.source ?? null,
      rawTitle: c.rawTitle ?? null,
      retailers: c.retailers ?? [],
      source: 'curated',
    })
    added++
  }
  return { products, added, enriched }
}

// ---------- Normalisation : noms propres, marques, rubriques, exclusions ----------

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'sur', 'by', 'x', "l'", "d'"])
const isShouty = (s) => {
  const letters = s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
  return letters.length > 3 && letters === letters.toUpperCase()
}
const titleCase = (s) => s.toLowerCase().split(' ').map((w, i) => {
  if (i > 0 && SMALL.has(w)) return w
  return w.charAt(0).toUpperCase() + w.slice(1)
}).join(' ')
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function cleanBrand(brand, name, known = null) {
  let b = (brand || '').trim()
  const GENERIC = /^(bi[èe]re|beer|kombucha|vin|cidre|boisson|0%|marque (inconnue|à préciser))$/i
  if (!b || /^[\d%.,\s°]+$/.test(b) || GENERIC.test(b)) {
    const STOP = /^(sans|alcool|organic|bio|the|la|le|les|l'|de|du|des|cerveza|tea|boisson|pur|blanche|blonde|ambr[ée]e|brune)$/i
    const words = (name || '').trim().split(/\s+/).filter((w) => /^1664$/.test(w) || (!GENERIC.test(w) && !STOP.test(w) && !/^[\d%.,°]+$/.test(w)))
    b = words[0] || ''
    if (known && b && !known.has(norm(b)) && !/^1664$/.test(b)) b = ''
  }
  b = b.replace(/\s+(kombucha|brewery|brasserie)$/i, '').trim()
  if (b.length > 4 && isShouty(b)) b = titleCase(b)
  b = capFirst(b)
  return b || 'Marque à préciser'
}

export function cleanName(name, brand) {
  const original = (name || '').trim()
  let n = ' ' + original + ' '
  n = n.replace(/\b\d+\s*x\s*\d+(?:[.,]\d+)?\s*(cl|ml|l)\b/gi, ' ')
  n = n.replace(/\b\d+(?:[.,]\d+)?\s*(cl|ml|l)\b/gi, ' ')
  n = n.replace(/<?\s*\d+(?:[.,]\d+)?\s*%\s*(vol\.?)?/gi, ' ')
  n = n.replace(/\b0[.,]\d+\b|\b\d?[.,]?\d+\s*°/g, ' ')
  n = n.replace(/\b(d[ée]gr[ée]s?\s+(d'?\s*)?alc+o+l|sans alc+o+l|non alcoolis[ée]e?s?|alcohol[- ]free|non[- ]alcoholic|z[ée]ro alc+o+l|alc+o+l)\b/gi, ' ')
  n = n.replace(/\b(can|vp|vc|x\d+)\b/gi, ' ')
  n = n.replace(/\b(ble|bte|bt|pack|lot|vr|bouteille|canette|bocal)\b/gi, ' ')
  if (brand && brand !== 'Marque à préciser') {
    const rx = new RegExp('(^|\\s)' + escapeRx(brand) + '(?=\\s|$)', 'gi')
    const without = n.replace(rx, ' ')
    if (without.replace(/[^\p{L}]/gu, '').length >= 3) n = without
  }
  n = n.replace(/\s+[-–:,]\s*(?=\s|$)/g, ' ').replace(/\(\s*\)/g, ' ')
  n = n.replace(/\s{2,}/g, ' ').trim().replace(/^[-–:,.\s]+|[-–:,.\s]+$/g, '')
  n = n.replace(/\s[°%]+(?=\s|$)/g, ' ').replace(/\s{2,}/g, ' ').trim()
  n = n.split(' ').map((w) => (w.length > 3 && isShouty(w) ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join(' ')
  n = n.split(' ').filter((w, i, a) => i === 0 || w.toLowerCase() !== a[i - 1].toLowerCase()).join(' ')
  if (isShouty(n)) n = titleCase(n)
  n = capFirst(n)
  if (n.replace(/[^\p{L}]/gu, '').length < 2) n = ''
  return n
}

const CAT_DEFAULT = { biere: 'Bière', vin: 'Vin', cidre: 'Cidre', aperitif: 'Apéritif', spiritueux: 'Spiritueux', kombucha: 'Kombucha', soft: 'Boisson' }

const RX_KOMBUCHA = /kom ?b?u?t?cha|kombuch|kambucha|k[ée]fir|kefir|k[ée]fruit|kamat[ée]/i
const RX_CIDRE = /\b(cidre|cider|poir[ée])\b/i
const RX_EXCLUDE = /ginger ?beer|ginger ?ale|\btonic\b|\bcola\b|limonade|orangeade|schweppes|orangina|ice ?tea|th[ée] glac[ée]|\bjus de (pomme|raisin|fruits?|orange|poire)\b|\bnectar\b|\bsirop\b|eau (min[ée]rale|gazeuse|p[ée]tillante)|\bsoda\b/i
const RX_EXCLUDE_EXTRA = /green tea|th[ée] vert menthe|\bmat[ée]\b(?! ?k)/i
const RX_KEEP_SODA = /pr[ée]biotique|fibres|clean soda|kombucha|k[ée]fir/i

export function finalize(products) {
  const kept = []
  const seen = new Map()
  const known = new Set(products.map((p) => (p.brand || '').trim()).filter((b) => b && !/^[\d%.,\s°]+$/.test(b) && !/^marque/i.test(b)).map(norm))
  let excluded = 0
  for (const p of products) {
    const text = `${p.name} ${p.brand} ${p.style || ''}`
    if ((RX_EXCLUDE.test(text) || RX_EXCLUDE_EXTRA.test(text)) && !RX_KEEP_SODA.test(text)) { excluded++; continue }
    const brand = cleanBrand(p.brand, p.name, known)
    let cat = p.cat
    if (RX_KOMBUCHA.test(text)) cat = 'kombucha'
    else if (RX_CIDRE.test(text)) cat = 'cidre'
    let name = cleanName(p.name, brand) || p.style || CAT_DEFAULT[cat] || 'Boisson'
    if (norm(name) === norm(brand) || norm(name) === '') name = p.style || CAT_DEFAULT[cat] || 'Boisson'
    const item = { ...p, brand, name, cat }
    const key = `${norm(brand)}|${norm(name)}|${cat}`
    const prev = seen.get(key)
    if (prev) {
      for (const f of ['abv', 'sugar', 'kcal', 'image', 'price', 'quantity', 'region', 'style', 'barcode']) prev[f] = prev[f] ?? item[f] ?? null
      prev.popularity = Math.max(prev.popularity || 0, item.popularity || 0)
      if (item.retailers) prev.retailers = [...new Set([...(prev.retailers || []), ...item.retailers])]
      continue
    }
    seen.set(key, item)
    kept.push(item)
  }
  const kombuchaBrands = new Set(kept.filter((p) => p.cat === 'kombucha' && p.brand !== 'Marque à préciser').map((p) => norm(p.brand)))
  for (const p of kept) {
    if (p.cat === 'soft' && kombuchaBrands.has(norm(p.brand)) && !/clean soda|infusion|soda/i.test(p.name)) p.cat = 'kombucha'
  }
  return { products: kept, excluded }
}

const tokenSet = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1))
function similarity(a, b) {
  const ta = tokenSet(a)
  const tb = tokenSet(b)
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const w of ta) if (tb.has(w)) common++
  return common / Math.min(ta.size, tb.size)
}

// Applique data/barcodes.json : codes des boutiques Shopify puis d'Open Food Facts.
// Si le code existe déjà sur une autre fiche, les deux fiches sont fusionnées.
export function applyBarcodes(products, barcodes) {
  if (!barcodes) return { products, assigned: 0, fused: 0 }
  const byId = new Map(products.map((p) => [p.id, p]))
  const byCode = new Map(products.filter((p) => p.barcode).map((p) => [p.barcode, p]))
  const drop = new Set()
  let assigned = 0
  let fused = 0
  const assign = (p, code) => {
    if (!p || p.barcode || drop.has(p.id)) return
    const owner = byCode.get(code)
    if (owner && owner !== p) {
      for (const f of ['region', 'style', 'note', 'price', 'quantity', 'sourceUrl', 'abv', 'sugar', 'kcal']) owner[f] = owner[f] ?? p[f] ?? null
      owner.retailers = [...new Set([...(owner.retailers || []), ...(p.retailers || [])])]
      drop.add(p.id)
      fused++
      return
    }
    p.barcode = code
    byCode.set(code, p)
    assigned++
  }
  const candidates = products.filter((p) => !p.barcode)
  for (const s of barcodes.shops || []) {
    const t = norm(s.title)
    let match = candidates.find((p) => !p.barcode && p.rawTitle && norm(p.rawTitle) === t)
    if (!match) {
      const vb = norm(s.vendor)
      match = candidates.find((p) => {
        if (p.barcode) return false
        const pb = norm(p.brand)
        const brandOk = pb && (t.includes(pb) || (vb && (vb.includes(pb) || pb.includes(vb))))
        return brandOk && similarity(p.name, s.title) >= 0.75
      })
    }
    assign(match, s.barcode)
  }
  for (const o of barcodes.off || []) assign(byId.get(o.id), o.barcode)
  return { products: products.filter((p) => !drop.has(p.id)), assigned, fused }
}

async function main() {
  const off = await readJson(OFF, { products: [] })
  const curated = await readJson(CURATED, { products: [] })
  const retailers = await readJson(RETAILERS, { products: [] })
  const merged = merge(off.products || [], [...(curated.products || []), ...(retailers.products || [])])
  const { added, enriched } = merged
  const fin = finalize(merged.products)
  const { excluded } = fin
  const bc = applyBarcodes(fin.products, await readJson(resolve(ROOT, 'data/barcodes.json'), null))
  const products = bc.products.map(({ rawTitle, ...p }) => p)
  const out = {
    generatedAt: new Date().toISOString(),
    sources: {
      openFoodFacts: { count: (off.products || []).length, importedAt: off.generatedAt ?? null, license: 'ODbL 1.0' },
      curated: { added, enriched },
      excluded,
      barcodes: { assigned: bc.assigned, fused: bc.fused },
    },
    count: products.length,
    products,
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n')
  console.log(`Catalogue : ${products.length} produits (${(off.products || []).length} OFF, ${added} ajoutés à la main, ${enriched} fiches enrichies, ${excluded} sodas/mixers écartés, ${bc.assigned} codes-barres ajoutés, ${bc.fused} doublons fusionnés)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
