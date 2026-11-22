// Lien avec la base de zéro (PocketBase sur Coolify) : comptes, connexion Google, notes partagées.
import PocketBase from 'pocketbase'

export const PB_URL = import.meta.env.VITE_PB_URL || 'https://zero-api.57.129.170.196.sslip.io'
export const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

export const currentUser = () => (pb.authStore.isValid ? pb.authStore.record : null)
export const onAuthChange = (fn) => pb.authStore.onChange(() => fn(currentUser()))

// Fournisseurs actifs côté base (Google, Facebook…) : le bouton n'apparaît que s'ils sont prêts
export async function authProviders() {
  try {
    const m = await pb.collection('users').listAuthMethods()
    return m.oauth2?.enabled ? m.oauth2.providers.map((p) => ({ name: p.name, label: p.displayName })) : []
  } catch {
    return []
  }
}

export const signIn = (provider) => pb.collection('users').authWithOAuth2({ provider })
export const signOut = () => pb.authStore.clear()

export const avatarUrl = (u) => (u?.avatar ? pb.files.getURL(u, u.avatar, { thumb: '100x100' }) : null)

// Score de chaque boisson : { [id]: { average (1 à 5), count } }
export async function fetchScores() {
  const rows = await pb.collection('product_scores').getFullList({ batch: 1000 })
  return Object.fromEntries(rows.map((r) => [r.id, { average: r.average, count: r.count }]))
}

// Mes notes en ligne : { [id]: { stars, tags, comment, date, recordId } }
export async function fetchMyRatings(userId) {
  const rows = await pb.collection('ratings').getFullList({ filter: pb.filter('user = {:u}', { u: userId }), batch: 1000 })
  return Object.fromEntries(rows.map((r) => [r.product, {
    stars: r.stars, tags: r.tags || [], comment: r.comment || '', date: Date.parse(r.updated) || Date.now(), recordId: r.id,
  }]))
}

// Crée ou met à jour ma note d'une boisson
export async function saveRating(userId, product, { stars, tags = [], comment = '' }, recordId) {
  const body = { stars, tags, comment }
  if (recordId) {
    try { return await pb.collection('ratings').update(recordId, body) } catch { /* supprimée entre-temps : on recrée */ }
  }
  try {
    return await pb.collection('ratings').create({ ...body, user: userId, product })
  } catch {
    const existing = await pb.collection('ratings').getFirstListItem(pb.filter('user = {:u} && product = {:p}', { u: userId, p: product }))
    return pb.collection('ratings').update(existing.id, body)
  }
}
