import { useMemo, useState } from 'react'
import { CAT_LABEL, DEMO_REVIEWS, fmt1, starText } from './data.js'
import { CAT_COLOR, CatIcon, Photo, RowIcon, TONE } from './ui.jsx'

const fr = (n, d = 1) => Number(n).toFixed(d).replace('.', ',')

// Les lignes « à la Yuka » : une valeur, un mot simple, une pastille de couleur.
function buildRows(p) {
  const good = []
  const watch = []
  const missing = []

  if (p.abv == null) missing.push('Taux d’alcool')
  else if (p.abv === 0) good.push({ icon: 'alcool', label: 'Alcool', text: 'Vrai 0,0 %', value: '0,0 %', tone: 'good' })
  else if (p.abv <= 0.5) watch.push({ icon: 'alcool', label: 'Alcool', text: 'Traces d’alcool', value: `${fr(p.abv)} %`, tone: 'mid' })
  else watch.push({ icon: 'alcool', label: 'Alcool', text: 'Faible teneur', value: `${fr(p.abv)} %`, tone: 'bad' })

  if (p.sugar == null) missing.push('Sucres')
  else {
    const row = { icon: 'sucre', label: 'Sucres', value: `${fr(p.sugar)} g`, unit: '/100 ml' }
    if (p.sugar < 2.5) good.push({ ...row, text: 'Peu sucré', tone: 'good' })
    else if (p.sugar <= 6) watch.push({ ...row, text: 'Modérément sucré', tone: 'mid' })
    else watch.push({ ...row, text: 'Très sucré', tone: 'bad' })
  }

  if (p.kcal == null) missing.push('Calories')
  else {
    const row = { icon: 'kcal', label: 'Calories', value: `${Math.round(p.kcal)} kcal`, unit: '/100 ml' }
    if (p.kcal < 20) good.push({ ...row, text: 'Léger', tone: 'good' })
    else if (p.kcal <= 40) watch.push({ ...row, text: 'Modéré', tone: 'mid' })
    else watch.push({ ...row, text: 'Calorique', tone: 'bad' })
  }

  const labels = p.labels || []
  if (labels.includes('bio')) good.push({ icon: 'bio', label: 'Bio', text: 'Agriculture biologique', tone: 'good' })
  if (labels.includes('vegan')) good.push({ icon: 'vegan', label: 'Vegan', text: 'Sans produit animal', tone: 'good' })
  if (labels.includes('sans gluten')) good.push({ icon: 'gluten', label: 'Sans gluten', text: 'Convient aux intolérants', tone: 'good' })

  return { good, watch, missing }
}

function Row({ r }) {
  const t = TONE[r.tone]
  return (
    <li className="prow">
      <span className="prow-icon" style={{ background: t.bg }}><RowIcon name={r.icon} color={t.fg} /></span>
      <span className="prow-body">
        <strong>{r.label}</strong>
        <small>{r.text}</small>
      </span>
      {r.value && <span className="prow-value">{r.value}{r.unit && <small>{r.unit}</small>}</span>}
      <span className="prow-dot" style={{ background: t.dot }} />
    </li>
  )
}

const containerIcon = (c) => (c === 'Canette' ? 'canette' : c === 'Pack' ? 'pack' : c === 'Fût' ? 'fut' : 'bouteille')

export default function Product({ p, rating, onBack, onRate, onOpen, similar }) {
  const [moreDesc, setMoreDesc] = useState(false)
  const [showIngr, setShowIngr] = useState(false)
  const rows = useMemo(() => buildRows(p), [p])
  const formats = (p.formats || []).filter((f) => f.quantity || f.container)
  const c = CAT_COLOR[p.cat] || CAT_COLOR.autre
  const shops = Object.entries(p.shopUrls || {})
  const otherRetailers = (p.retailers || []).filter((r) => !(p.shopUrls || {})[r])

  return (
    <div className="product">
      <div className="pv-top" style={{ background: c.bg }}>
        <button type="button" className="round" aria-label="Retour" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="pv-photo">
          <Photo p={p} size={72} alt={`${p.brand} ${p.name}`} />
        </div>
      </div>

      <div className="pv-body">
        <div className="pv-id">
          <span className="chip-cat" style={{ background: c.bg, color: c.fg }}><CatIcon cat={p.cat} size={16} />{CAT_LABEL[p.cat]}</span>
          <h1>{p.name}</h1>
          <p className="pv-brand">{p.brand}{p.country && <> · <RowIcon name="pays" size={15} color="#6B7280" /> {p.country}</>}</p>
          {(p.labels || []).length > 0 && (
            <div className="plabels">
              {p.labels.includes('bio') && <span className="plabel bio"><RowIcon name="bio" size={16} color="#166534" />Bio</span>}
              {p.labels.includes('sans gluten') && <span className="plabel gf"><RowIcon name="gluten" size={16} color="#92400E" />Sans gluten</span>}
              {p.labels.includes('vegan') && <span className="plabel vegan"><RowIcon name="vegan" size={16} color="#065F46" />Vegan</span>}
            </div>
          )}
        </div>

        <div className="score-card">
          {p.score != null ? (
            <span className="score-big" style={{ background: p.lvl.color }}><strong>{fmt1(p.score)}</strong><small>/10</small></span>
          ) : (
            <span className="score-big empty" aria-hidden="true">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" /></svg>
            </span>
          )}
          <div>
            <strong style={{ color: p.score == null ? 'var(--ink)' : p.lvl.color }}>{p.score == null ? 'Nouveau sur zéro' : p.lvl.label}</strong>
            <span>{p.count ? `Note de la communauté · ${p.count} avis` : 'Donne ton avis en premier'}</span>
          </div>
        </div>

        {rows.good.length > 0 && (
          <section className="psec">
            <h2>Points forts</h2>
            <ul className="prows">{rows.good.map((r) => <Row key={r.label} r={r} />)}</ul>
          </section>
        )}
        {rows.watch.length > 0 && (
          <section className="psec">
            <h2>À savoir</h2>
            <ul className="prows">{rows.watch.map((r) => <Row key={r.label} r={r} />)}</ul>
          </section>
        )}
        {rows.missing.length > 0 && (
          <p className="pmissing"><RowIcon name="info" size={16} color="#6B7280" /> Non communiqué : {rows.missing.join(', ').toLowerCase()}</p>
        )}

        {formats.length > 0 && (
          <section className="psec">
            <h2>{formats.length > 1 ? `Existe en ${formats.length} formats` : 'Format'}</h2>
            <div className="pformats">
              {formats.map((f) => (
                <span key={`${f.quantity}-${f.container}`} className="pformat">
                  <RowIcon name={containerIcon(f.container)} size={22} color="var(--accent-dark)" />
                  <span><strong>{f.quantity || 'Taille ?'}</strong><small>{f.container || 'Contenant non précisé'}</small></span>
                </span>
              ))}
            </div>
          </section>
        )}

        {(p.style || p.region || p.price) && (
          <section className="psec">
            <h2>Caractéristiques</h2>
            <div className="pgrid">
              {p.style && <div><small>Style</small><strong>{p.style}</strong></div>}
              {p.region && <div><small>Origine</small><strong>{p.region}</strong></div>}
              {p.price && <div><small>Prix indicatif</small><strong>{p.price}</strong></div>}
            </div>
          </section>
        )}

        {p.description && (
          <section className="psec">
            <h2>Description</h2>
            <p className={moreDesc ? 'pdesc open' : 'pdesc'}>{p.description}</p>
            {p.description.length > 220 && (
              <button type="button" className="plink" onClick={() => setMoreDesc((v) => !v)}>{moreDesc ? 'Réduire' : 'Lire la suite'}</button>
            )}
          </section>
        )}

        {p.ingredients && (
          <section className="psec">
            <button type="button" className="pfold" aria-expanded={showIngr} onClick={() => setShowIngr((v) => !v)}>
              <h2>Ingrédients</h2><span>{showIngr ? '−' : '+'}</span>
            </button>
            {showIngr && <p className="pdesc open">{p.ingredients}</p>}
          </section>
        )}

        {(shops.length > 0 || otherRetailers.length > 0) && (
          <section className="psec">
            <h2>Où l’acheter</h2>
            <div className="pshops">
              {shops.map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer" className="pshop"><RowIcon name="boutique" size={18} color="var(--accent)" />{name}</a>
              ))}
              {otherRetailers.map((name) => <span key={name} className="pshop"><RowIcon name="boutique" size={18} color="var(--accent)" />{name}</span>)}
            </div>
          </section>
        )}

        {rating && (
          <div className="review mine">
            <span><strong>Ma note</strong><span className="stars">{starText(rating.stars)}</span></span>
            {rating.tags.length > 0 && <span>{rating.tags.join(' · ')}</span>}
          </div>
        )}
        {p.demo && DEMO_REVIEWS.map((r) => (
          <div key={r.who} className="review">
            <span><strong>{r.who}</strong><span className="stars" aria-label={`${r.stars} sur 5`}>{starText(r.stars)}</span></span>
            <span>{r.text}</span>
          </div>
        ))}

        {similar.length > 0 && (
          <section className="psec">
            <h2>Dans le même esprit</h2>
            <div className="psimilar">
              {similar.map((s) => (
                <button key={s.id} type="button" className="psim" onClick={() => onOpen(s.id)}>
                  <span className="psim-img" style={{ background: (CAT_COLOR[s.cat] || CAT_COLOR.autre).bg }}>
                    <Photo p={s} size={32} lazy />
                  </span>
                  <strong>{s.name}</strong>
                  <small>{s.brand}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <p className="credit">
          {p.source === 'off' ? 'Données produit : Open Food Facts (licence ODbL).' : 'Fiche zéro, à compléter par la communauté.'}
          {p.sourceUrl && <> <a href={p.sourceUrl} target="_blank" rel="noreferrer">Source</a></>}
        </p>
      </div>

      <div className="cta">
        <button type="button" className="btn-primary" onClick={onRate}>{rating ? 'Modifier ma note' : 'Noter en 10 secondes'}</button>
      </div>
    </div>
  )
}
