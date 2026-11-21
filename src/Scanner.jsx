import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
]

export default function Scanner({ onCode, busy, error }) {
  const [camError, setCamError] = useState('')
  const [manual, setManual] = useState('')
  const scannerRef = useRef(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode('reader', { formatsToSupport: FORMATS, verbose: false })
    scannerRef.current = scanner
    let started = false
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 150 } },
        (text) => {
          if (doneRef.current) return
          doneRef.current = true
          onCode(text)
          setTimeout(() => { doneRef.current = false }, 2500)
        },
        () => {},
      )
      .then(() => { started = true })
      .catch(() => setCamError('Caméra indisponible. Autorise l’accès ou saisis le code-barres.'))
    return () => {
      if (started) scanner.stop().then(() => scanner.clear()).catch(() => {})
    }
  }, [onCode])

  const submitManual = (e) => {
    e.preventDefault()
    const code = manual.replace(/\D/g, '')
    if (code.length >= 8) onCode(code)
  }

  return (
    <div className="scan">
      <p className="scan-title">Vise le code-barres de la bouteille</p>
      <div className="scan-frame">
        <div id="reader" />
      </div>
      {busy && <p className="scan-info">Recherche du produit…</p>}
      {(error || camError) && <p className="scan-error" role="alert">{error || camError}</p>}
      <form className="scan-manual" onSubmit={submitManual}>
        <label htmlFor="ean">Ou saisis le code-barres</label>
        <div className="row">
          <input id="ean" inputMode="numeric" placeholder="3 123456 789012" value={manual} onChange={(e) => setManual(e.target.value)} />
          <button type="submit" className="btn-light">OK</button>
        </div>
      </form>
    </div>
  )
}
