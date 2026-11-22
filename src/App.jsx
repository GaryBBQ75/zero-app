import { sameDrink } from './grouping.js'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchByBarcode } from './off.js'
import Product from './Product.jsx'
import Discover from './Discover.jsx'
import AddDrink from './AddDrink.jsx'
import { authProviders, avatarUrl, currentUser, fetchMyRatings, fetchScores, onAuthChange, saveRating, signIn, signOut, submitDrink, submissionPhotoUrl } from './backend.js'
import { CAT_COLOR, Photo } from './ui.jsx'
import {
  CATEGORIES, typeLabel, RATING_TAGS, SEED, MAX_ABV,
  fmt1, level, communityScore, starText,
} from './data.js'

// Retrouve une fiche existante (sans code-barres) correspondant au produit scanné : même marque, nom proche.
// Une boisson scannée qui existe déjà sous un autre format est rattachée à sa fiche
// (mêmes règles que le catalogue : src/grouping.js).
function findSame(products, scanned) {
  if (!scanned.brand || !scanned.name) return null
  return products.find((p) => p.id !== scanned.id && sameDrink(p, scanned)) || null
}

const Scanner = lazy(() => import('./Scanner.jsx'))

const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* stockage indisponible */ }
}

const Icon = {
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>,
  compass: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>,
  scan: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 9v6M11 9v6M14 9v6M17 9v6" /></svg>,
  book: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 9h6M9 13h4" /></svg>,
  back: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  info: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>,
  badge: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="6" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" /></svg>,
  starSmall: <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" /></svg>,
  star: <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" /></svg>,
}

function Visual({ p }) {
  const c = CAT_COLOR[p.cat] || CAT_COLOR.autre
  return (
    <span className="visual" style={{ background: p.thumb ? '#fff' : c.bg }}>
      <Photo p={p} size={28} lazy />
    </span>
  )
}

function AbvPill({ abv }) {
  if (abv == null) return null
  const zero = abv === 0
  return <span className={zero ? 'pill pill-zero' : 'pill pill-low'}>{fmt1(abv)} %</span>
}

const PROVIDER_ICON = {
  google: <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>,
  facebook: <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v2.9h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>,
}

function Account({ user, providers, busy, onConnect, onSignOut }) {
  if (user) {
    const img = avatarUrl(user)
    return (
      <div className="account on">
        <span className="account-avatar">{img ? <img src={img} alt="" /> : (user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
        <span className="account-text">
          <strong>{user.name || user.email}</strong>
          <small>Tes notes sont sauvegardées et comptent dans les scores.</small>
        </span>
        <button type="button" className="account-out" onClick={onSignOut}>Se déconnecter</button>
      </div>
    )
  }
  return (
    <div className="account">
      <strong>Garde tes notes et partage-les</strong>
      <small>Un compte en un geste : tes dégustations sont sauvegardées et aident la communauté à trouver les meilleures boissons.</small>
      {providers.length > 0 ? (
        <div className="account-btns">
          {providers.map((p) => (
            <button key={p.name} type="button" className="btn-oauth" disabled={busy} onClick={() => onConnect(p.name)}>
              {PROVIDER_ICON[p.name]}Continuer avec {p.label}
            </button>
          ))}
        </div>
      ) : (
        <small className="account-soon">La connexion arrive très bientôt.</small>
      )}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('home')
  const [cat, setCat] = useState('all')
  const [only00, setOnly00] = useState(false)
  const [q, setQ] = useState('')
  const [currentId, setCurrentId] = useState(null)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [stars, setStars] = useState(0)
  const [picked, setPicked] = useState([])
  const [toast, setToast] = useState('')
  const [scanBusy, setScanBusy] = useState(false)
  const [scanError, setScanError] = useState('')
  const [adding, setAdding] = useState(null) // { barcode, name } quand la fiche d'ajout est ouverte
  const [unknownCode, setUnknownCode] = useState('')
  const [ratings, setRatings] = useState(() => load('zero.ratings', {}))
  const [scanned, setScanned] = useState(() => load('zero.scanned', {}))
  const [links, setLinks] = useState(() => load('zero.links', {}))

  useEffect(() => save('zero.ratings', ratings), [ratings])

  // Compte et notes partagées (base PocketBase)
  const [user, setUser] = useState(() => currentUser())
  const [providers, setProviders] = useState([])
  const [scores, setScores] = useState({})
  const [signingIn, setSigningIn] = useState(false)
  const refreshScores = useCallback(() => { fetchScores().then(setScores).catch(() => {}) }, [])
  useEffect(() => {
    authProviders().then(setProviders)
    refreshScores()
    return onAuthChange(setUser)
  }, [refreshScores])

  // À la connexion : on récupère les notes en ligne et on envoie celles faites sur ce téléphone
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    let stop = false
    ;(async () => {
      try {
        const remote = await fetchMyRatings(userId)
        const local = load('zero.ratings', {})
        const merged = { ...remote }
        for (const [id, r] of Object.entries(local)) {
          const online = remote[id]
          if (online && online.date >= (r.date || 0)) continue
          const rec = await saveRating(userId, id, r, online?.recordId)
          merged[id] = { ...r, recordId: rec.id }
        }
        if (!stop) { setRatings(merged); refreshScores() }
      } catch { /* hors ligne : on réessaiera à la prochaine connexion */ }
    })()
    return () => { stop = true }
  }, [userId, refreshScores])

  const connect = async (provider) => {
    setSigningIn(true)
    try {
      await signIn(provider)
      setToast('Bienvenue ! Tes notes sont maintenant sauvegardées.')
    } catch {
      setToast('Connexion annulée.')
    } finally {
      setSigningIn(false)
    }
  }
  useEffect(() => save('zero.scanned', scanned), [scanned])
  useEffect(() => save('zero.links', links), [links])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const [catalogue, setCatalogue] = useState([])
  const [shown, setShown] = useState(40)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/products.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.products)) setCatalogue(d.products) })
      .catch(() => { /* pas de catalogue : on garde la démo */ })
  }, [])

  const all = useMemo(() => {
    const byId = {}
    const base = catalogue.length ? catalogue : SEED
    base.forEach((p) => { byId[p.id] = { tags: [], ...p } })
    Object.values(scanned).forEach((p) => { byId[p.id] = { tags: [], ...p } })
    return byId
  }, [scanned, catalogue])
  const isDemo = catalogue.length === 0

  const withScore = useCallback((p) => {
    const mine = ratings[p.id]
    const { score, count } = communityScore(p, mine, scores[p.id], !!(user && mine?.recordId))
    return { ...p, score, count, lvl: level(score) }
  }, [ratings, scores, user])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.values(all)
      .filter((p) => cat === 'all' || p.cat === cat)
      .filter((p) => !only00 || p.abv === 0)
      .filter((p) => !needle || `${p.name} ${p.brand}`.toLowerCase().includes(needle))
      .map(withScore)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.popularity ?? 0) - (a.popularity ?? 0))
  }, [all, cat, only00, q, withScore])

  const scored = useMemo(() => Object.values(all).map(withScore), [all, withScore])
  const browsing = cat !== 'all' || only00 || q.trim() !== ''
  const mainRef = useRef(null)
  // Défilement infini : 40 boissons de plus dès qu'on approche du bas de la liste
  const sentinelRef = useRef(null)
  const hasMore = list.length > shown
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + 40)
    }, { root: mainRef.current, rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, shown, tab])
  const toTop = () => { if (mainRef.current) mainRef.current.scrollTop = 0 }
  const pickCat = (id) => { setCat(id); setShown(40); toTop() }
  const resetBrowse = () => { setCat('all'); setOnly00(false); setQ(''); setShown(40); toTop() }

  const current = currentId && all[currentId]
    ? { ...withScore(all[currentId]), demo: isDemo && all[currentId].source !== 'off' }
    : null
  const similar = useMemo(() => {
    const base = currentId && all[currentId]
    if (!base) return []
    return Object.values(all)
      .filter((p) => p.id !== base.id && p.cat === base.cat && p.brand !== base.brand)
      .map(withScore)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.thumb || b.image ? 1 : 0) - (a.thumb || a.image ? 1 : 0) || (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 8)
  }, [currentId, all, withScore])
  const logged = Object.entries(ratings)
    .filter(([id]) => all[id])
    .sort((a, b) => b[1].date - a[1].date)
    .map(([id, r]) => ({ ...all[id], my: r }))
  const monthCount = logged.filter((l) => new Date(l.my.date).getMonth() === new Date().getMonth()).length

  const onCode = useCallback(async (code) => {
    setScanError('')
    setUnknownCode('')
    if (links[code] && all[links[code]]) { setCurrentId(links[code]); return }
    const known = Object.values(all).find((p) => p.barcode === code || (p.barcodes || []).includes(code))
    if (known) { setCurrentId(known.id); return }
    setScanBusy(true)
    try {
      const p = await fetchByBarcode(code)
      if (!p) { setUnknownCode(code); return }
      if (p.abv != null && p.abv > MAX_ABV) {
        setScanError(`${p.name} contient ${fmt1(p.abv)} % d’alcool : il n’a pas sa place ici.`)
        return
      }
      const existing = findSame(Object.values(all), p)
      if (existing) {
        setLinks((l) => ({ ...l, [code]: existing.id }))
        setCurrentId(existing.id)
        return
      }
      setScanned((s) => ({ ...s, [p.id]: p }))
      setCurrentId(p.id)
    } catch {
      setScanError('Impossible de joindre la base produits. Vérifie ta connexion.')
    } finally {
      setScanBusy(false)
    }
  }, [all, links])

  const goTab = (t) => { setTab(t); setCurrentId(null); setScanError(''); setUnknownCode('') }

  // Boisson proposée : elle rejoint tout de suite le téléphone (et peut être notée), la base la garde pour validation
  const addDrink = async (fields) => {
    const rec = await submitDrink(user.id, fields)
    const p = {
      id: `sub-${rec.id}`, source: 'community', brand: fields.brand, name: fields.name, cat: fields.cat,
      abv: fields.abv, barcode: fields.barcode || null, barcodes: fields.barcode ? [fields.barcode] : [],
      image: submissionPhotoUrl(rec), formats: [], tags: [], pending: true,
    }
    setScanned((s) => ({ ...s, [p.id]: p }))
    if (fields.barcode) setLinks((l) => ({ ...l, [fields.barcode]: p.id }))
    setAdding(null)
    setUnknownCode('')
    setCurrentId(p.id)
    setToast('Merci ! Ta boisson est proposée. Tu peux déjà la noter.')
  }
  const openTwin = (p, code) => {
    if (code) setLinks((l) => ({ ...l, [code]: p.id }))
    setAdding(null)
    setUnknownCode('')
    setCurrentId(p.id)
  }
  const openRating = () => { setStars(0); setPicked([]); setRatingOpen(true) }
  const togglePick = (t) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const submit = () => {
    if (!stars || !current) return
    const id = current.id
    const rating = { stars, tags: picked, date: Date.now() }
    const prev = ratings[id]
    setRatings((r) => ({ ...r, [id]: { ...rating, recordId: prev?.recordId } }))
    setRatingOpen(false)
    if (user) {
      setToast('Merci ! Ta note compte dans le score de la communauté.')
      saveRating(user.id, id, rating, prev?.recordId)
        .then((rec) => { setRatings((r) => ({ ...r, [id]: { ...r[id], recordId: rec.id } })); refreshScores() })
        .catch(() => setToast('Note gardée sur ton téléphone, envoi à la prochaine connexion.'))
    } else {
      setToast('Merci ! Ta note est dans ton carnet.')
    }
  }

  const badges = [
    { name: 'Pionnier', desc: '1re note', got: logged.length >= 1 },
    { name: 'Explorateur', desc: `${Math.min(logged.length, 10)} / 10 boissons`, got: logged.length >= 10 },
    { name: 'Dry January', desc: '31 jours, 31 découvertes', got: false },
  ]

  const share = async () => {
    const text = `Ce mois-ci j’ai découvert ${monthCount} boisson${monthCount > 1 ? 's' : ''} sans alcool avec zéro.`
    try {
      if (navigator.share) await navigator.share({ text })
      else { await navigator.clipboard.writeText(text); setToast('Récap copié !') }
    } catch { /* partage annulé */ }
  }

  return (
    <div className="app">
      <main className="main" ref={mainRef}>
        {tab === 'home' && (
          <section className="page">
            <header className="top">
              <div className="logo">zéro<span>.</span></div>
              <span className="top-sub">Le guide du sans alcool</span>
            </header>
            <div className="search">
              {Icon.search}
              <label htmlFor="q" className="sr">Rechercher une boisson</label>
              <input id="q" type="search" placeholder="Une bière, un vin, une marque…" value={q} onChange={(e) => { setQ(e.target.value); setShown(40) }} />
            </div>
            {browsing ? (
              <>
                <button type="button" className="back-link" onClick={resetBrowse}>{Icon.back}Découvrir</button>
                <div className="chips">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip'} aria-pressed={cat === c.id} onClick={() => pickCat(c.id)}>{c.label}</button>
                  ))}
                </div>
                <button type="button" className="toggle" aria-pressed={only00} onClick={() => { setOnly00((v) => !v); setShown(40) }}>
                  <span>
                    <strong>Uniquement « vrai 0,0 % »</strong>
                    <small>Sans alcool peut aller jusqu&rsquo;à 1,2 % en France</small>
                  </span>
                  <span className={only00 ? 'switch on' : 'switch'}><span /></span>
                </button>
              </>
            ) : (
              <Discover products={scored} onOpen={setCurrentId} onCat={pickCat} onOnly00={() => { setOnly00(true); setShown(40); toTop() }} />
            )}
            <div className="section-head">
              <h2>{browsing ? (cat !== 'all' ? CATEGORIES.find((c) => c.id === cat)?.label : only00 ? 'Vrais 0,0 %' : 'Résultats') : 'Tout le catalogue'}</h2>
              <span>{list.length} boisson{list.length > 1 ? 's' : ''}</span>
            </div>
            <div className="list">
              {list.slice(0, shown).map((p) => (
                <button key={p.id} type="button" className="card" onClick={() => setCurrentId(p.id)}>
                  <Visual p={p} />
                  <span className="card-body">
                    <span className="card-name">{p.name}</span>
                    <span className="card-sub">{p.brand} · {typeLabel(p)}</span>
                    <span className="card-meta">
                      <AbvPill abv={p.abv} />
                      {(p.labels || []).includes('bio') && <span className="pill pill-bio">Bio</span>}
                      {(p.labels || []).includes('sans gluten') && <span className="pill pill-gf">Sans gluten</span>}
                      <span>{p.count ? `${p.count} avis` : 'Nouveau'}</span>
                    </span>
                  </span>
                  {p.score != null && (
                    <span className="score-col">
                      <span className="score" style={{ background: p.lvl.color }}>{fmt1(p.score)}</span>
                      <span className="score-label">{p.lvl.label}</span>
                    </span>
                  )}
                </button>
              ))}
              {list.length > shown && (
                <div ref={sentinelRef} className="more-loader" aria-hidden="true"><span /><span /><span /></div>
              )}
              {list.length === 0 && <div className="empty">Aucune boisson ne correspond.</div>}
              {browsing && list.length <= shown && (
                <button type="button" className="add-cta" onClick={() => setAdding({ name: q.trim() })}>
                  <strong>Tu ne trouves pas ta boisson ?</strong>
                  <small>Ajoute-la en 30 secondes</small>
                </button>
              )}
            </div>
            <p className="credit">
              {isDemo
                ? 'Catalogue de démonstration : produits et notes fictifs.'
                : 'Données produit : Open Food Facts (licence ODbL). Notes : communauté zéro.'}
            </p>
          </section>
        )}

        {tab === 'scan' && (
          <Suspense fallback={<div className="scan"><p className="scan-info">Ouverture de la caméra…</p></div>}>
            <Scanner onCode={onCode} busy={scanBusy} error={scanError} />
            {unknownCode && (
              <div className="unknown">
                <strong>On ne connaît pas encore cette boisson</strong>
                <small>Code {unknownCode}. Ajoute-la en 30 secondes, toute la communauté en profitera.</small>
                <button type="button" className="btn-primary" onClick={() => setAdding({ barcode: unknownCode })}>Ajouter cette boisson</button>
              </div>
            )}
          </Suspense>
        )}

        {tab === 'carnet' && (
          <section className="page">
            <h1 className="h1">Mon carnet</h1>
            <Account user={user} providers={providers} busy={signingIn} onConnect={connect} onSignOut={signOut} />
            <div className="recap">
              <span>Ce mois-ci</span>
              <strong>{monthCount}</strong>
              <span className="recap-label">boisson{monthCount > 1 ? 's' : ''} sans alcool découverte{monthCount > 1 ? 's' : ''}</span>
              <button type="button" className="btn-light" onClick={share}>Partager mon récap</button>
            </div>
            <h2 className="h2">Mes badges</h2>
            <div className="badges">
              {badges.map((b) => (
                <div key={b.name} className={b.got ? 'badge got' : 'badge'}>
                  <span className="badge-icon">{Icon.badge}</span>
                  <strong>{b.name}</strong>
                  <small>{b.desc}</small>
                </div>
              ))}
            </div>
            <h2 className="h2">Mes dégustations</h2>
            <div className="list">
              {logged.map((l) => (
                <button key={l.id} type="button" className="card small" onClick={() => setCurrentId(l.id)}>
                  <Visual p={l} />
                  <span className="card-body">
                    <span className="card-name">{l.name}</span>
                    <span className="card-sub">{l.brand}</span>
                  </span>
                  <span className="stars" aria-label={`${l.my.stars} sur 5`}>{starText(l.my.stars)}</span>
                </button>
              ))}
              {logged.length === 0 && <div className="empty">Note ta première boisson pour remplir ton carnet.</div>}
            </div>
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="Navigation principale">
        <button type="button" className={tab === 'home' ? 'tab on' : 'tab'} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => { if (tab === 'home') resetBrowse(); goTab('home') }}>
          <span className="tab-ico">{Icon.compass}</span>Découvrir
        </button>
        <button type="button" className={tab === 'scan' ? 'tab-scan on' : 'tab-scan'} aria-current={tab === 'scan' ? 'page' : undefined} onClick={() => goTab('scan')}>
          <span className="tab-scan-ico">{Icon.scan}</span>Scanner
        </button>
        <button type="button" className={tab === 'carnet' ? 'tab on' : 'tab'} aria-current={tab === 'carnet' ? 'page' : undefined} onClick={() => goTab('carnet')}>
          <span className="tab-ico">{Icon.book}</span>Mon carnet
        </button>
      </nav>

      {current && (
        <Product
          p={current}
          rating={ratings[current.id]}
          similar={similar}
          onBack={() => setCurrentId(null)}
          onRate={openRating}
          onOpen={(id) => setCurrentId(id)}
        />
      )}

      {ratingOpen && (
        <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) setRatingOpen(false) }}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="rate-title">
            <div className="sheet-head">
              <h2 id="rate-title">Tu en as pensé quoi ?</h2>
              <button type="button" className="round grey" aria-label="Fermer" onClick={() => setRatingOpen(false)}>{Icon.close}</button>
            </div>
            <div className="star-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} étoile${n > 1 ? 's' : ''}`} aria-pressed={n <= stars} style={{ color: n <= stars ? '#F59E0B' : '#D1D5DB' }} onClick={() => setStars(n)}>{Icon.star}</button>
              ))}
            </div>
            <div className="tag-choices">
              {RATING_TAGS.map((t) => (
                <button key={t} type="button" className={picked.includes(t) ? 'chip on accent' : 'chip'} aria-pressed={picked.includes(t)} onClick={() => togglePick(t)}>{t}</button>
              ))}
            </div>
            <button type="button" className="btn-primary" disabled={!stars} onClick={submit}>Publier ma note</button>
          </div>
        </div>
      )}

      {adding && (
        <AddDrink initial={adding} products={Object.values(all)} user={user} providers={providers} onConnect={connect} onSubmit={addDrink} onOpen={openTwin} onClose={() => setAdding(null)} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
