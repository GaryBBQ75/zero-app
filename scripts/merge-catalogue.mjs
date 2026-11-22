#!/usr/bin/env node
// Fusionne les deux sources du catalogue en public/data/products.json :
// - data/off-products.json : import Open Food Facts (scripts/import-off.mjs)
// - data/curated-products.json : produits ajoutés à la main (artisans, domaines, marques absentes d'OFF)
// Un produit curé déjà présent dans OFF (même marque, nom proche) n'est pas dupliqué :
// il complète la fiche OFF (région, style, source) au lieu de créer un doublon.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { thumbName } from './thumbs.mjs'
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

export { norm } from '../src/grouping.js'
import { norm, canonName, splitBrandLine, prettyName, nameQuality } from '../src/grouping.js'

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

// ---------- Formats : contenance et contenant ----------
export function normQty(text) {
  if (!text) return null
  const t = String(text).replace(',', '.').toLowerCase()
  const pack = t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(cl|ml|l)\b/)
  const one = pack ? null : t.match(/(\d+(?:\.\d+)?)\s*(cl|ml|l)\b/)
  const toCl = (v, u) => (u === 'ml' ? v / 10 : u === 'l' ? v * 100 : v)
  const fmt = (cl) => (cl >= 100 ? `${String(cl / 100).replace('.', ',')} L` : `${String(Math.round(cl * 10) / 10).replace('.', ',')} cl`)
  if (pack) return `${pack[1]} × ${fmt(toCl(Number(pack[2]), pack[3]))}`
  if (one) {
    const cl = toCl(Number(one[1]), one[2])
    if (cl < 5 || cl > 600) return null
    return fmt(cl)
  }
  return null
}
export function detectContainer(text) {
  const t = ` ${(text || '').toLowerCase()} `
  if (/\b(can|cans|canette|canettes|boîte|boite|bte|slim|aluminium)\b/.test(t)) return 'Canette'
  if (/\b(f[uû]t|keg)\b/.test(t)) return 'Fût'
  // Le carton d'un pack (étui) n'est pas le contenant : on regarde d'abord la bouteille
  if (/glass|verre|\bvp\b|\bvr\b|glass-bottle/.test(t)) return 'Bouteille en verre'
  if (/\b(pet|plastique|plastic)\b|plastic-bottle/.test(t)) return 'Bouteille plastique'
  if (/\b(bouteille|btl|bottle|magnum|demi-bouteille)\b/.test(t)) return 'Bouteille'
  if (/\b(brique|tetra|tetra-?pak)\b/.test(t)) return 'Brique'
  return null
}
const fmtKey = (f) => `${f.quantity || ''}|${f.container || ''}`
function addFormat(item, f) {
  if (!f || (!f.quantity && !f.container && !f.barcode)) return
  item.formats = item.formats || []
  const same = item.formats.find((x) => fmtKey(x) === fmtKey(f))
  if (same) {
    if (f.barcode && !same.barcode) same.barcode = f.barcode
    return
  }
  // un format sans contenant ou sans taille est fusionné avec un format plus précis
  const looser = item.formats.find((x) => (!x.container || !f.container) && x.quantity && x.quantity === f.quantity)
  if (looser) {
    looser.container = looser.container || f.container
    looser.barcode = looser.barcode || f.barcode
    return
  }
  item.formats.push(f)
}
const qtyRank = (q) => {
  const m = (q || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(cl|l)/i)
  return m ? Number(m[1]) * (/l$/i.test(m[2]) && !/cl/i.test(m[2]) ? 100 : 1) : 9999
}

const RX_KOMBUCHA = /kom ?b?u?t?cha|kombuch|kambucha|k[ée]fir|kefir|k[ée]fruit|kamat[ée]/i
const RX_CIDRE = /\b(cidre|cider|poir[ée])\b/i
const RX_EXCLUDE = /ginger ?beer|ginger ?ale|\btonic\b|\bcola\b|limonade|orangeade|schweppes|orangina|ice ?tea|th[ée] glac[ée]|\bjus de (pomme|raisin|fruits?|orange|poire)\b|\bnectar\b|\bsirop\b|eau (min[ée]rale|gazeuse|p[ée]tillante)|\bsoda\b/i
const RX_EXCLUDE_EXTRA = /green tea|th[ée] vert menthe|\bmat[ée]\b(?! ?k)/i
const RX_KEEP_SODA = /pr[ée]biotique|fibres|clean soda|kombucha|k[ée]fir/i

// ---------- Regroupement : une fiche par liquide (marque + saveur), quels que soient le nom source et le format ----------
export function finalize(products) {
  const kept = []
  const seen = new Map()
  const known = new Set(products.map((p) => (p.brand || '').trim()).filter((b) => b && !/^[\d%.,\s°]+$/.test(b) && !/^marque/i.test(b)).map(norm))
  let excluded = 0
  for (const p of products) {
    const text = `${p.name} ${p.brand} ${p.style || ''}`
    if ((RX_EXCLUDE.test(text) || RX_EXCLUDE_EXTRA.test(text)) && !RX_KEEP_SODA.test(text)) { excluded++; continue }
    let brand = cleanBrand(p.brand, p.name, known)
    let rawName = p.name
    ;[brand, rawName] = splitBrandLine(brand, rawName, known)
    let cat = p.cat
    if (RX_KOMBUCHA.test(text)) cat = 'kombucha'
    else if (RX_CIDRE.test(text)) cat = 'cidre'
    let name = cleanName(rawName, brand) || p.style || CAT_DEFAULT[cat] || 'Boisson'
    if (norm(name) === norm(brand) || norm(name) === '') name = p.style || CAT_DEFAULT[cat] || 'Boisson'
    const rawText = `${p.name} ${p.quantity || ''} ${p.packaging || ''} ${p.rawTitle || ''}`
    const format = { quantity: normQty(p.quantity) || normQty(rawText), container: detectContainer(rawText), barcode: p.barcode || null }
    const item = { ...p, brand, name, cat, formats: [], barcodes: p.barcode ? [p.barcode] : [] }
    addFormat(item, format)
    const key = `${norm(brand)}|${canonName(name, cat, brand)}|${cat}`
    const prev = seen.get(key)
    if (prev) {
      addFormat(prev, format)
      if (p.barcode) prev.barcodes = [...new Set([...prev.barcodes, p.barcode])]
      for (const f of ['ingredients', 'description', 'origin', 'country']) prev[f] = prev[f] ?? item[f] ?? null
      prev.labels = [...new Set([...(prev.labels || []), ...(item.labels || [])])]
      for (const f of ['abv', 'sugar', 'kcal', 'image', 'price', 'quantity', 'region', 'style', 'barcode']) prev[f] = prev[f] ?? item[f] ?? null
      if (nameQuality(item.name) > nameQuality(prev.name)) prev.name = item.name
      prev.rawNames.push(p.name)
      prev.popularity = Math.max(prev.popularity || 0, item.popularity || 0)
      if (item.retailers) prev.retailers = [...new Set([...(prev.retailers || []), ...item.retailers])]
      continue
    }
    item.rawNames = [p.name]
    seen.set(key, item)
    kept.push(item)
  }
  const kombuchaBrands = new Set(kept.filter((p) => p.cat === 'kombucha' && p.brand !== 'Marque à préciser').map((p) => norm(p.brand)))
  for (const p of kept) {
    if (p.cat === 'soft' && kombuchaBrands.has(norm(p.brand)) && !/clean soda|infusion|soda/i.test(p.name)) p.cat = 'kombucha'
  }
  for (const p of kept) { p.name = prettyName(p.name, p.brand, p.rawNames); delete p.rawNames }
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

// ---------- Enrichissement : pays, labels, taux d'alcool tirés des textes ----------
const COUNTRIES = [
  ['France', /\bfran(ce|çais|caise)\b|bretagne|normandie|alsace|provence|bordeaux|gironde|loire|occitanie|languedoc|paris|lyon|lille|nantes|corse|savoie|drôme|gers|charente|bourgogne|champagne|jura|beaujolais|hauts-de-france|grand est/i],
  ['Belgique', /belgi/i], ['Allemagne', /allemagne|german|deutsch/i], ['Royaume-Uni', /royaume-uni|angleterre|écosse|ecosse|scotland|england|\buk\b|london|londres/i],
  ['Espagne', /espagn|spain/i], ['Italie', /itali/i], ['Pays-Bas', /pays-bas|hollande|netherlands|néerland/i], ['Danemark', /danemark|danois|denmark/i],
  ['Autriche', /autrich|austria/i], ['Estonie', /estoni/i], ['États-Unis', /états-unis|etats-unis|usa|américain/i], ['Mexique', /mexique|mexic/i], ['Suisse', /suisse|switzerland/i],
]
export function countryFrom(...texts) {
  const t = texts.filter(Boolean).join(' ')
  if (!t) return null
  const ctx = t.match(/(origine|pays|provenance|brass[ée]e?s? (en|à)|produite? (en|à)|made in|élaboré(e)? (en|à)|fabriqu[ée]e? (en|à))\s*:?\s*([^.\n,;]{2,40})/i)
  const zone = ctx ? ctx[6] : t
  for (const [name, rx] of COUNTRIES) if (rx.test(zone)) return name
  if (ctx) return null
  for (const [name, rx] of COUNTRIES) if (rx.test(t)) return name
  return null
}
export function abvFrom(...texts) {
  const t = texts.filter(Boolean).join(' ').replace(/,/g, '.')
  const m = t.match(/(<|moins de|inférieur à)?\s*(\d(?:\.\d{1,2})?)\s*%\s*(vol|d'alcool|alc|alcool)?/i)
  if (!m) return null
  const v = Number(m[2])
  if (Number.isNaN(v) || v > 1.2) return null
  return v
}
export function labelsFrom(...texts) {
  const t = texts.filter(Boolean).join(' ')
  const out = []
  if (/\bbio\b|biologique|organic|\bab\b/i.test(t)) out.push('bio')
  if (/vegan|végan|végétalien/i.test(t)) out.push('vegan')
  if (/sans gluten|gluten[- ]free|no-gluten/i.test(t)) out.push('sans gluten')
  return out
}
const priceTxt = (n) => (n ? `${n.toFixed(2).replace('.', ',')} €` : null)

// Applique data/barcodes.json : codes des boutiques Shopify puis d'Open Food Facts.
// Si le code existe déjà sur une autre fiche, les deux fiches sont fusionnées.
export function applyBarcodes(products, barcodes) {
  if (!barcodes) return { products, assigned: 0, fused: 0 }
  const byId = new Map(products.map((p) => [p.id, p]))
  const byCode = new Map()
  for (const p of products) for (const c of [p.barcode, ...(p.barcodes || [])].filter(Boolean)) byCode.set(c, p)
  const drop = new Set()
  let assigned = 0
  let fused = 0
  const assign = (p, code) => {
    if (!p || drop.has(p.id) || (p.barcodes || []).includes(code)) return
    const owner = byCode.get(code)
    if (owner && owner !== p) {
      for (const f of ['region', 'style', 'note', 'price', 'quantity', 'sourceUrl', 'abv', 'sugar', 'kcal']) owner[f] = owner[f] ?? p[f] ?? null
      owner.retailers = [...new Set([...(owner.retailers || []), ...(p.retailers || [])])]
      for (const f of p.formats || []) addFormat(owner, f)
      drop.add(p.id)
      fused++
      return
    }
    p.barcode = p.barcode || code
    p.barcodes = [...new Set([...(p.barcodes || []), code])]
    byCode.set(code, p)
    assigned++
  }
  const candidates = products
  for (const s of barcodes.shops || []) {
    const t = norm(s.title)
    let match = candidates.find((p) => p.rawTitle && norm(p.rawTitle) === t)
    if (!match) {
      const vb = norm(s.vendor)
      match = candidates.find((p) => {
        const pb = norm(p.brand)
        const brandOk = pb && (t.includes(pb) || (vb && (vb.includes(pb) || pb.includes(vb))))
        return brandOk && similarity(p.name, s.title) >= 0.75
      })
    }
    if (match && !drop.has(match.id)) {
      match.description = match.description || s.description || null
      match.image = match.image || s.image || null
      match.price = match.price || priceTxt(s.price)
      if (match.abv == null) match.abv = abvFrom(s.title, (s.tags || []).join(' '), s.description)
      match.labels = [...new Set([...(match.labels || []), ...labelsFrom(s.title, (s.tags || []).join(' '), s.description)])]
      match.country = match.country || countryFrom(s.description)
      match.shopUrls = { ...(match.shopUrls || {}), [s.shop]: s.url }
      match.retailers = [...new Set([...(match.retailers || []), s.shop])]
    }
    if (match && !drop.has(match.id)) addFormat(match, { quantity: normQty(s.title), container: detectContainer(`${s.title} ${(s.tags || []).join(' ')}`), barcode: s.barcode || null })
    if (s.barcode) assign(match, s.barcode)
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
  const products = bc.products.map((p) => {
    const { rawTitle: _rawTitle, ...rest } = p
    rest.labels = [...new Set([...(rest.labels || []), ...labelsFrom(rest.name, rest.note, rest.style)])]
    rest.country = rest.country || countryFrom(rest.origin) || countryFrom(rest.region) || (rest.region ? 'France' : null)
    if (rest.abv == null) rest.abv = abvFrom(rest.name)
    rest.formats = (rest.formats || [])
      .map((f) => (['biere', 'soft', 'kombucha'].includes(rest.cat) && qtyRank(f.quantity) > 100 && qtyRank(f.quantity) < 9999 && !/×/.test(f.quantity || '')
        ? { ...f, container: 'Pack' }
        : f))
      .sort((a, b) => qtyRank(a.quantity) - qtyRank(b.quantity))
    rest.barcodes = [...new Set([rest.barcode, ...(rest.barcodes || [])].filter(Boolean))]
    delete rest.packaging
    // Miniature hébergée par l'app (créée par scripts/fetch-images.mjs)
    if (rest.image && existsSync(resolve(ROOT, 'public/img', thumbName(rest.image)))) rest.thumb = `img/${thumbName(rest.image)}`
    else delete rest.thumb
    return rest
  })
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
