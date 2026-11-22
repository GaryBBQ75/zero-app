import { sameDrink } from './grouping.js'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { fetchByBarcode } from './off.js'
import Product from './Product.jsx'
import { CAT_COLOR, Photo } from './ui.jsx'
import {
  CATEGORIES, CAT_LABEL, RATING_TAGS, SEED, MAX_ABV,
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
  home: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
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
  const [ratings, setRatings] = useState(() => load('zero.ratings', {}))
  const [scanned, setScanned] = useState(() => load('zero.scanned', {}))
  const [links, setLinks] = useState(() => load('zero.links', {}))

  useEffect(() => save('zero.ratings', ratings), [ratings])
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
    const { score, count } = communityScore(p, ratings[p.id])
    return { ...p, score, count, lvl: level(score) }
  }, [ratings])

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return Object.values(all)
      .filter((p) => cat === 'all' || p.cat === cat)
      .filter((p) => !only00 || p.abv === 0)
      .filter((p) => !needle || `${p.name} ${p.brand}`.toLowerCase().includes(needle))
      .map(withScore)
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.popularity ?? 0) - (a.popularity ?? 0))
  }, [all, cat, only00, q, withScore])

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
    if (links[code] && all[links[code]]) { setCurrentId(links[code]); return }
    const known = Object.values(all).find((p) => p.barcode === code || (p.barcodes || []).includes(code))
    if (known) { setCurrentId(known.id); return }
    setScanBusy(true)
    try {
      const p = await fetchByBarcode(code)
      if (!p) { setScanError('Produit inconnu. Il pourra être ajouté par la communauté.'); return }
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

  const goTab = (t) => { setTab(t); setCurrentId(null); setScanError('') }
  const openRating = () => { setStars(0); setPicked([]); setRatingOpen(true) }
  const togglePick = (t) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const submit = () => {
    if (!stars || !current) return
    setRatings((r) => ({ ...r, [current.id]: { stars, tags: picked, date: Date.now() } }))
    setRatingOpen(false)
    setToast('Merci ! Ta note est ajoutée à ton carnet.')
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
      <main className="main">
        {tab === 'home' && (
          <section className="page">
            <header className="top">
              <div className="logo">zéro<span>.</span></div>
            </header>
            <div>
              <h1 className="h1">Qu&rsquo;est-ce qu&rsquo;on boit ce soir ?</h1>
              <p className="lead">Les boissons sans alcool, notées par ceux qui les boivent.</p>
            </div>
            <div className="search">
              {Icon.search}
              <label htmlFor="q" className="sr">Rechercher une boisson</label>
              <input id="q" type="search" placeholder="Une bière, un vin, une marque…" value={q} onChange={(e) => { setQ(e.target.value); setShown(40) }} />
            </div>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button key={c.id} type="button" className={cat === c.id ? 'chip on' : 'chip'} aria-pressed={cat === c.id} onClick={() => { setCat(c.id); setShown(40) }}>{c.label}</button>
              ))}
            </div>
            <button type="button" className="toggle" aria-pressed={only00} onClick={() => { setOnly00((v) => !v); setShown(40) }}>
              <span>
                <strong>Uniquement « vrai 0,0 % »</strong>
                <small>Sans alcool peut aller jusqu&rsquo;à 1,2 % en France</small>
              </span>
              <span className={only00 ? 'switch on' : 'switch'}><span /></span>
            </button>
            <div className="section-head">
              <h2>{isDemo ? 'Le top de la communauté' : 'Les boissons sans alcool'}</h2>
              <span>{list.length} boisson{list.length > 1 ? 's' : ''}</span>
            </div>
            <div className="list">
              {list.slice(0, shown).map((p) => (
                <button key={p.id} type="button" className="card" onClick={() => setCurrentId(p.id)}>
                  <Visual p={p} />
                  <span className="card-body">
                    <span className="card-name">{p.name}</span>
                    <span className="card-sub">{p.brand} · {CAT_LABEL[p.cat]}</span>
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
                <button type="button" className="more" onClick={() => setShown((n) => n + 40)}>Voir plus de boissons</button>
              )}
              {list.length === 0 && <div className="empty">Aucune boisson ne correspond. Scanne-la pour l&rsquo;ajouter !</div>}
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
          </Suspense>
        )}

        {tab === 'carnet' && (
          <section className="page">
            <h1 className="h1">Mon carnet</h1>
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

      <nav className="tabbar">
        <button type="button" className={tab === 'home' ? 'tab on' : 'tab'} onClick={() => goTab('home')}>{Icon.home}Découvrir</button>
        <button type="button" className="tab-scan" aria-label="Scanner une boisson" onClick={() => goTab('scan')}>{Icon.scan}</button>
        <button type="button" className={tab === 'carnet' ? 'tab on' : 'tab'} onClick={() => goTab('carnet')}>{Icon.book}Mon carnet</button>
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

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
