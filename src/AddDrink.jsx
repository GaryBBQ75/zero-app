import { useMemo, useState } from 'react'
import { CATEGORIES } from './data.js'
import { CAT_COLOR, CatIcon } from './ui.jsx'
import { sameDrink } from './grouping.js'

// Fiche « Ajouter une boisson » : quand un code-barres est inconnu, ou qu'une recherche ne donne rien.
const ABV_CHOICES = [
  { v: 0, label: '0,0 %' },
  { v: 0.4, label: 'Moins de 0,5 %' },
  { v: 1.2, label: 'Jusqu’à 1,2 %' },
  { v: null, label: 'Je ne sais pas' },
]

export default function AddDrink({ initial, products, user, providers, onConnect, onSubmit, onOpen, onClose }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '')
  const [brand, setBrand] = useState(initial?.brand || '')
  const [name, setName] = useState(initial?.name || '')
  const [cat, setCat] = useState('')
  const [abv, setAbv] = useState(undefined)
  const [photo, setPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand).filter((b) => b && b !== 'Marque à préciser'))].sort((a, b) => a.localeCompare(b, 'fr')), [products])
  // La boisson existe peut-être déjà sous un autre format
  const twin = useMemo(() => (brand.trim() && name.trim() ? products.find((p) => sameDrink(p, { brand, name, cat: cat || undefined })) : null), [brand, name, cat, products])
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  const ready = brand.trim() && name.trim() && cat && abv !== undefined

  const send = async (e) => {
    e.preventDefault()
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      await onSubmit({ barcode: barcode.replace(/\D/g, ''), brand: brand.trim(), name: name.trim(), cat, abv, photo })
    } catch {
      setError('L’envoi n’a pas marché. Vérifie ta connexion et réessaie.')
      setBusy(false)
    }
  }

  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="sheet add" role="dialog" aria-modal="true" aria-labelledby="add-title" onSubmit={send}>
        <div className="sheet-head">
          <h2 id="add-title">Ajouter une boisson</h2>
          <button type="button" className="round grey" aria-label="Fermer" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {!user ? (
          <div className="add-login">
            <p>Connecte-toi pour proposer une boisson : elle rejoint ton carnet et tu peux la noter tout de suite.</p>
            {providers.length > 0
              ? providers.map((p) => <button key={p.name} type="button" className="btn-oauth" onClick={() => onConnect(p.name)}>Continuer avec {p.label}</button>)
              : <small className="account-soon">La connexion arrive très bientôt.</small>}
          </div>
        ) : (
          <>
            <label className="add-photo">
              {preview ? <img src={preview} alt="Ta photo de la boisson" /> : (
                <span className="add-photo-empty">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
                  Prendre la bouteille en photo
                </span>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
            </label>

            <div className="field">
              <label htmlFor="add-brand">Marque</label>
              <input id="add-brand" list="add-brands" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Heineken, Tourtel, Kombucha Remedy…" autoComplete="off" required />
              <datalist id="add-brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="add-name">Nom de la boisson</label>
              <input id="add-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Blonde 0.0, Twist Citron…" required />
            </div>

            <div className="field">
              <span className="field-label">Catégorie</span>
              <div className="add-cats">
                {CATEGORIES.filter((c) => c.id !== 'all').map((c) => {
                  const col = CAT_COLOR[c.id] || CAT_COLOR.autre
                  const on = cat === c.id
                  return (
                    <button key={c.id} type="button" className={on ? 'add-cat on' : 'add-cat'} aria-pressed={on} style={on ? { background: col.bg, color: col.fg, borderColor: col.fg } : undefined} onClick={() => setCat(c.id)}>
                      <CatIcon cat={c.id} size={18} color={on ? col.fg : '#6b7280'} />{c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="field">
              <span className="field-label">Taux d’alcool indiqué sur l’étiquette</span>
              <div className="chips wrap">
                {ABV_CHOICES.map((a) => (
                  <button key={a.label} type="button" className={abv === a.v ? 'chip on' : 'chip'} aria-pressed={abv === a.v} onClick={() => setAbv(a.v)}>{a.label}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="add-ean">Code-barres <small>(facultatif)</small></label>
              <input id="add-ean" inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="3 123456 789012" />
            </div>

            {twin && (
              <button type="button" className="add-twin" onClick={() => onOpen(twin, barcode.replace(/\D/g, ''))}>
                <strong>Elle existe peut-être déjà : {twin.brand} {twin.name}</strong>
                <small>C’est la même boisson dans un autre format ? Touche ici pour l’ouvrir.</small>
              </button>
            )}
            {error && <p className="scan-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary" disabled={!ready || busy}>{busy ? 'Envoi…' : 'Proposer cette boisson'}</button>
            <small className="add-note">Elle apparaît tout de suite dans ton carnet, et dans le catalogue après une rapide vérification.</small>
          </>
        )}
      </form>
    </div>
  )
}
