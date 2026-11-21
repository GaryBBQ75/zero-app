// Catalogue de démonstration : produits, notes et avis fictifs.
// Les produits scannés viennent d'Open Food Facts (voir off.js).

export const CATEGORIES = [
  { id: 'all', label: 'Tout' },
  { id: 'biere', label: 'Bières' },
  { id: 'vin', label: 'Vins' },
  { id: 'cidre', label: 'Cidres' },
  { id: 'aperitif', label: 'Apéritifs' },
  { id: 'spiritueux', label: 'Spiritueux' },
  { id: 'kombucha', label: 'Kombuchas & kéfirs' },
  { id: 'soft', label: 'Softs' },
]

export const CAT_LABEL = {
  biere: 'Bière',
  vin: 'Vin',
  cidre: 'Cidre',
  aperitif: 'Apéritif',
  spiritueux: 'Spiritueux',
  kombucha: 'Kombucha / kéfir',
  soft: 'Soft',
  autre: 'Boisson',
}

export const CAT_TINT = {
  biere: '#FEF3C7',
  vin: '#FCE7F3',
  cidre: '#FEF9C3',
  aperitif: '#FFEDD5',
  spiritueux: '#E0F2FE',
  kombucha: '#ECFCCB',
  soft: '#DCFCE7',
  autre: '#F3F4F6',
}

export const RATING_TAGS = [
  'Goût proche de l’original',
  'Peu sucré',
  'Trop sucré',
  'Rafraîchissant',
  'Fade',
  'À racheter',
]

export const SEED = [
  { id: 'demo-1', name: 'Blonde Légère', brand: 'Brasserie du Nord', cat: 'biere', abv: 0, sugar: 2.1, kcal: 18, price: '1,60 €', baseScore: 8.6, baseCount: 214, tags: ['Goût bière', 'Peu sucré', 'Désaltérant'] },
  { id: 'demo-2', name: 'Spritz Zéro', brand: 'Apéro Zéro', cat: 'aperitif', abv: 0, sugar: 6.8, kcal: 32, price: '7,90 €', baseScore: 8.1, baseCount: 132, tags: ['Amertume réussie', 'Festif', 'Un peu sucré'] },
  { id: 'demo-3', name: 'Kombucha Gingembre', brand: 'Ferment & Co', cat: 'soft', abv: 0.5, sugar: 3.4, kcal: 15, price: '3,20 €', baseScore: 8.3, baseCount: 88, tags: ['Piquant', 'Peu sucré', 'Rafraîchissant'] },
  { id: 'demo-4', name: 'IPA Sans Alcool', brand: 'Houblon & Co', cat: 'biere', abv: 0.4, sugar: 1.9, kcal: 21, price: '2,40 €', baseScore: 7.9, baseCount: 167, tags: ['Très houblonnée', 'Goût proche de l’original'] },
  { id: 'demo-5', name: 'Rosé Désalcoolisé', brand: 'Domaine des Vents', cat: 'vin', abv: 0, sugar: 4.5, kcal: 20, price: '6,50 €', baseScore: 7.2, baseCount: 96, tags: ['Fruité', 'Un peu court'] },
  { id: 'demo-6', name: 'Gin Botanique 0 %', brand: 'Jardin Distillé', cat: 'spiritueux', abv: 0, sugar: 0, kcal: 1, price: '24,90 €', baseScore: 6.2, baseCount: 54, tags: ['À couper au tonic', 'Cher'] },
  { id: 'demo-7', name: 'Effervescent Blanc', brand: 'Maison Perle', cat: 'vin', abv: 0.5, sugar: 7.9, kcal: 34, price: '8,90 €', baseScore: 5.4, baseCount: 71, tags: ['Trop sucré', 'Bulles fines'] },
]

export const DEMO_REVIEWS = [
  { who: 'Camille', stars: 5, text: 'Bluffant, à l’aveugle je n’aurais pas fait la différence.' },
  { who: 'Mehdi', stars: 4, text: 'Parfait pour l’apéro quand je conduis.' },
]

// Seuil légal français de la mention « sans alcool » pour la bière.
export const MAX_ABV = 1.2

export const fmt1 = (n) => (n == null ? '?' : Number(n).toFixed(1).replace('.', ','))

export function level(score) {
  if (score == null) return { label: 'Pas encore noté', color: '#6B7280' }
  if (score >= 8) return { label: 'Excellent', color: '#0F766E' }
  if (score >= 6.5) return { label: 'Bon', color: '#A16207' }
  if (score >= 5) return { label: 'Moyen', color: '#C2410C' }
  return { label: 'Décevant', color: '#B42318' }
}

// Note communautaire sur 10 : base de démo + notes locales (1 à 5 étoiles -> x2).
export function communityScore(product, myRating) {
  let total = (product.baseScore ?? 0) * (product.baseCount ?? 0)
  let count = product.baseCount ?? 0
  if (myRating) {
    total += myRating.stars * 2
    count += 1
  }
  return { score: count ? total / count : null, count }
}

export const starText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)
