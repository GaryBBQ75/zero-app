// Règles de regroupement partagées entre le pipeline du catalogue et l'app :
// une fiche = une boisson (marque + saveur), quels que soient le nom source, la taille et le contenant.

export const norm = (s) => (s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(sans alcool|alcohol free|non alcoolisee?|0[,.]0 ?%?|0 ?%|biere|brasserie|domaine|la|le|les|de|du|des)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const ABBR = { tw: 'twist', ttwist: 'twist', citr: 'citron', rhuba: 'rhubarbe', cranb: 'cranberry', ora: 'orange', mure: 'mure', myrtill: 'myrtille', citronvert: 'citron vert', blanche: 'blanc', peche: 'peche', agrumes: 'agrume', citrons: 'citron' }
const FILLER = new Set(['au', 'aux', 'jus', 'de', 'du', 'des', 'd', 'et', 'la', 'le', 'les', 'l', 'a', 'notes', 'note', 'noté', 'note', 'avec', 'saveur', 'gout', 'men', 'blik', 'bio', 'can', 'x', 'sans', 'alcool', 'alkoholfrei', 'alcohol', 'free', 'zero', '0', '00', '0 0', 'nouvelle', 'recette'])
const BEER_GENERIC = new Set(['biere', 'beer', 'blonde', 'lager', 'pils', 'pilsner', 'bier', 'cerveza', 'birra', 'premium', 'classique', 'classic'])
const BRAND_LINES = { tourtel: ['twist'] }
export function canonName(name, cat, brand) {
  let toks = norm(name).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  toks = toks.flatMap((t) => (ABBR[t] || t).split(' '))
  toks = toks.filter((t) => !FILLER.has(t) && !/^\d+$/.test(t) && !/^\d+(x\d+)?(cl|ml|l)?$/.test(t) && !/^(canette|bouteille|pack|lot|verre|bte|ble|vp|bt)$/.test(t))
  for (const w of norm(brand).split(/\s+/)) toks = toks.filter((t) => t !== w)
  for (const w of BRAND_LINES[norm(brand)] || []) toks = toks.filter((t) => t !== w)
  if (cat === 'biere' || cat === 'cidre') {
    const rest = toks.filter((t) => !BEER_GENERIC.has(t) && t !== 'cidre' && t !== 'brut')
    toks = cat === 'cidre' ? toks.filter((t) => t !== 'cidre') : rest
  }
  return [...new Set(toks)].sort().join(' ') || '_'
}
// Sépare « Tourtel Twist » en marque Tourtel + gamme Twist quand Tourtel existe déjà comme marque
export function splitBrandLine(brand, name, known) {
  const words = brand.split(/\s+/)
  if (words.length < 2) return [brand, name]
  for (let i = words.length - 1; i > 0; i--) {
    const head = words.slice(0, i).join(' ')
    if (known.has(norm(head))) {
      const line = words.slice(i).join(' ')
      return [head, norm(name).includes(norm(line)) ? name : `${capFirst(line)} ${name}`]
    }
  }
  return [brand, name]
}
const DISPLAY_ABBR = { TW: 'Twist', Ttwist: 'Twist', Citr: 'Citron', Rhuba: 'Rhubarbe', cranb: 'Cranberry', Cranb: 'Cranberry', ora: 'Orange', Myrtill: 'Myrtille', CitronVert: 'Citron vert', Peche: 'Pêche' }
export function prettyName(n, brand, rawNames = []) {
  let x = n
  if (x.includes(',')) x = x.split(',').pop().trim()
  x = x.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\b\d+\s*x\s*\d+([.,]\d+)?\b/gi, ' ').replace(/\b(MEN|blik)\b/gi, ' ').replace(/^\d+\s+(?=[A-Za-zÀ-ÿ])/, '')
  x = x.split(/\s+/).map((w) => DISPLAY_ABBR[w] || w).join(' ')
  if (brand) x = x.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), ' ')
  x = x.replace(/\s+/g, ' ').trim()
  if (/^(lager|bi[èe]re|blonde|bi[èe]re blonde|pils|beer)$/i.test(x) && rawNames.some((r) => /0[.,]0|\b00\b/.test(r))) x = '0.0'
  return capFirst(x) || n
}
export const nameQuality = (n) => (/[\u{1F300}-\u{1FAFF}]/u.test(n) ? -5 : 0) + (/\d/.test(n) ? -3 : 0) + (norm(n).split(' ').some((t) => ABBR[t] && ABBR[t] !== t) ? -4 : 0) + (/^bi[èe]re\b/i.test(n) ? -1 : 0) - n.length / 40


const brandMatch = (a, b) => {
  const x = norm(a)
  const y = norm(b)
  return !!x && !!y && (x === y || x.startsWith(y + ' ') || y.startsWith(x + ' '))
}
// Vrai si deux fiches décrivent la même boisson (seule la taille ou le contenant change).
export function sameDrink(a, b) {
  if (!brandMatch(a.brand, b.brand)) return false
  const cat = a.cat || b.cat
  if (a.cat && b.cat && a.cat !== b.cat) return false
  const [ba, na] = splitBrandLine(a.brand, a.name, new Set([norm(b.brand)]))
  const [bb, nb] = splitBrandLine(b.brand, b.name, new Set([norm(a.brand)]))
  return canonName(na, cat, ba) === canonName(nb, cat, bb)
}
