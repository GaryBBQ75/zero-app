// Recherche d'un produit par code-barres dans Open Food Facts.
// Licence ODbL : les données doivent être attribuées à Open Food Facts.

const FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'categories_tags',
  'nutriments',
  'image_front_small_url',
].join(',')

function guessCategory(tags = []) {
  const t = tags.join(' ')
  if (t.includes('beer') || t.includes('biere')) return 'biere'
  if (t.includes('wine') || t.includes('vin')) return 'vin'
  if (t.includes('spirit') || t.includes('gin') || t.includes('rum')) return 'spiritueux'
  if (t.includes('aperitif') || t.includes('cocktail')) return 'aperitif'
  if (t.includes('beverage') || t.includes('boisson') || t.includes('soda')) return 'soft'
  return 'autre'
}

export async function fetchByBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('network')
  const data = await res.json()
  if (data.status !== 1 || !data.product) return null
  const p = data.product
  const n = p.nutriments || {}
  const abv = n.alcohol_100g ?? n.alcohol ?? null
  return {
    id: `off-${p.code || code}`,
    barcode: p.code || code,
    name: p.product_name_fr || p.product_name || 'Produit sans nom',
    brand: (p.brands || '').split(',')[0].trim() || 'Marque inconnue',
    cat: guessCategory(p.categories_tags),
    abv: abv == null ? null : Number(abv),
    sugar: n.sugars_100g ?? null,
    kcal: n['energy-kcal_100g'] ?? null,
    price: null,
    image: p.image_front_small_url || null,
    baseScore: null,
    baseCount: 0,
    tags: [],
    source: 'off',
  }
}
