import { useMemo } from 'react'
import { CATEGORIES, fmt1, typeLabel } from './data.js'
import { CAT_COLOR, CatIcon, Photo } from './ui.jsx'

// Page Découvrir : boissons mises en avant, entrées par catégorie et sélections thématiques.

const hasPhoto = (p) => !!(p.thumb || p.image)
// Photos « catalogue » (fond neutre) des cavistes, plutôt que les photos prises en rayon
const packshot = (p) => /cdn\.shopify\.com/.test(p.image || '')
// Garde de préférence les packshots, s'il y en a assez pour remplir la ligne
const prefer = (items, n = 6) => { const best = items.filter(packshot); return best.length >= n ? best : items }

// Tirage stable sur la semaine : la une change chaque lundi, pas à chaque ouverture.
function weeklyPick(items, n, salt = '') {
  const d = new Date()
  const week = `${d.getFullYear()}-${Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 6048e5)}${salt}`
  const h = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) | 0; return x }
  return [...items].sort((a, b) => h(week + a.id) - h(week + b.id)).slice(0, n)
}

function Abv({ abv }) {
  if (abv == null) return null
  if (abv === 0) return <span className="d-abv zero">0,0 %</span>
  return <span className="d-abv">{fmt1(abv)} %</span>
}

function Rail({ title, sub, items, onOpen, onMore }) {
  if (items.length < 3) return null
  return (
    <section className="rail">
      <div className="rail-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {onMore && <button type="button" className="rail-more" onClick={onMore}>Tout voir</button>}
      </div>
      <div className="rail-track">
        {items.map((p) => (
          <button key={p.id} type="button" className="rcard" onClick={() => onOpen(p.id)}>
            <span className="rcard-img"><Photo p={p} size={40} lazy /></span>
            <span className="rcard-name">{p.name}</span>
            <span className="rcard-brand">{p.brand}</span>
            <span className="rcard-meta">
              <Abv abv={p.abv} />
              {p.score != null && <span className="d-score" style={{ background: p.lvl.color }}>{fmt1(p.score)}</span>}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function Discover({ products, onOpen, onCat, onOnly00 }) {
  const sel = useMemo(() => {
    const rich = products.filter((p) => hasPhoto(p) && p.description && p.abv != null && p.brand !== 'Marque à préciser')
    const featured = weeklyPick(prefer(rich, 5), 5, 'une')
    const taken = new Set(featured.map((p) => p.id))
    const pool = products.filter((p) => hasPhoto(p) && !taken.has(p.id) && p.brand !== 'Marque à préciser')
    const top = pool.filter((p) => p.score != null).sort((a, b) => b.score - a.score).slice(0, 10)
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c.id, products.filter((p) => p.cat === c.id).length]))
    return {
      featured,
      top,
      zero: weeklyPick(prefer(pool.filter((p) => p.abv === 0)), 10, 'zero'),
      france: weeklyPick(prefer(pool.filter((p) => p.country === 'France' && p.source !== 'off')), 10, 'fr'),
      bio: weeklyPick(prefer(pool.filter((p) => (p.labels || []).includes('bio'))), 10, 'bio'),
      wines: weeklyPick(prefer(pool.filter((p) => p.cat === 'vin' || p.cat === 'aperitif')), 10, 'vin'),
      ferment: weeklyPick(prefer(pool.filter((p) => p.cat === 'kombucha')), 10, 'kb'),
      counts,
    }
  }, [products])

  return (
    <div className="discover">
      {sel.featured.length > 0 && (
        <section className="hero" aria-label="À la une">
          <div className="hero-track">
            {sel.featured.map((p, i) => {
              const c = CAT_COLOR[p.cat] || CAT_COLOR.autre
              return (
                <button key={p.id} type="button" className="hero-card" style={{ '--hbg': c.bg, '--hfg': c.fg }} onClick={() => onOpen(p.id)}>
                  <span className="hero-text">
                    <span className="hero-kicker">{i === 0 ? 'À la une cette semaine' : typeLabel(p)}</span>
                    <span className="hero-name">{p.name}</span>
                    <span className="hero-brand">{p.brand}{p.country ? ` · ${p.country}` : ''}</span>
                    <span className="hero-desc">{p.description}</span>
                    <span className="hero-cta">Découvrir <Abv abv={p.abv} /></span>
                  </span>
                  <span className="hero-img"><Photo p={p} size={56} /></span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="tiles" aria-label="Explorer par catégorie">
        <h2 className="d-title">Explorer</h2>
        <div className="tiles-grid">
          {CATEGORIES.filter((c) => c.id !== 'all' && sel.counts[c.id] > 0).map((c) => {
            const col = CAT_COLOR[c.id] || CAT_COLOR.autre
            return (
              <button key={c.id} type="button" className="tile" style={{ background: col.bg, color: col.fg }} onClick={() => onCat(c.id)}>
                <CatIcon cat={c.id} size={26} color={col.fg} />
                <strong>{c.label}</strong>
                <small>{sel.counts[c.id]}</small>
              </button>
            )
          })}
          <button type="button" className="tile tile-zero" onClick={onOnly00}>
            <span className="tile-big">0,0</span>
            <strong>Vrai zéro</strong>
            <small>Aucune trace d&rsquo;alcool</small>
          </button>
        </div>
      </section>

      <Rail title="Les mieux notés" sub="Par la communauté zéro" items={sel.top} onOpen={onOpen} />
      <Rail title="Vrais 0,0 %" sub="Aucune trace d'alcool" items={sel.zero} onOpen={onOpen} onMore={onOnly00} />
      <Rail title="Fabriqué en France" sub="Brasseries, domaines et cidreries d'ici" items={sel.france} onOpen={onOpen} />
      <Rail title="À la place du vin" sub="Vins et apéritifs sans alcool" items={sel.wines} onOpen={onOpen} onMore={() => onCat('vin')} />
      <Rail title="Fermenté et pétillant" sub="Kombuchas et kéfirs" items={sel.ferment} onOpen={onOpen} onMore={() => onCat('kombucha')} />
      <Rail title="Bio" items={sel.bio} onOpen={onOpen} />
    </div>
  )
}
