import { useState } from 'react'
// Pictos et couleurs partagés : catégories et lignes de la fiche produit.

export const CAT_COLOR = {
  biere: { bg: '#FEF3C7', fg: '#B45309' },
  vin: { bg: '#FCE7F3', fg: '#9D174D' },
  cidre: { bg: '#FEF9C3', fg: '#A16207' },
  aperitif: { bg: '#FFEDD5', fg: '#C2410C' },
  spiritueux: { bg: '#E0F2FE', fg: '#0369A1' },
  kombucha: { bg: '#ECFCCB', fg: '#4D7C0F' },
  soft: { bg: '#DCFCE7', fg: '#047857' },
  autre: { bg: '#F3F4F6', fg: '#374151' },
}

const PATHS = {
  biere: <><path d="M6 8h9v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" /><path d="M6 8c0-2 1.5-3 3-3 .8-1.2 2-2 3.5-2S15 4 15 6v2" /><path d="M9.5 12v5M12.5 12v5" /></>,
  vin: <><path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0z" /><path d="M12 12.5V20M8.5 21h7" /><path d="M8.3 7h7.4" /></>,
  cidre: <><path d="M12 7c-2.5-2-7-1-7 4 0 4.5 3 9 5 9 1 0 1.5-.6 2-.6s1 .6 2 .6c2 0 5-4.5 5-9 0-5-4.5-6-7-4z" /><path d="M12 7c0-2 1-3.5 3-4" /></>,
  aperitif: <><path d="M4 4h16l-8 9z" /><path d="M12 13v7M8 21h8" /><circle cx="16.5" cy="6.5" r="1.5" /></>,
  spiritueux: <><path d="M10 2h4v4l2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9l2-3z" /><path d="M8 13h8" /></>,
  kombucha: <><path d="M8 3h8M9 3v4l-4 6v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6l-4-6V3" /><circle cx="10" cy="16" r="1" /><circle cx="14" cy="14" r="1" /><circle cx="13" cy="18" r=".8" /></>,
  soft: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M7 7h10M7 17h10" /><path d="M12 10v4" /></>,
  autre: <><circle cx="12" cy="12" r="8" /></>,
}

export function CatIcon({ cat, size = 24, color }) {
  const c = color || (CAT_COLOR[cat] || CAT_COLOR.autre).fg
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[cat] || PATHS.autre}
    </svg>
  )
}

const ROW = {
  alcool: <><path d="M9 3h6l-1 5a3 3 0 0 1-4 0z" /><path d="M12 11v9M9 21h6" /><path d="M4 4l16 16" /></>,
  sucre: <><rect x="5" y="9" width="8" height="8" rx="1" /><rect x="11" y="5" width="8" height="8" rx="1" /></>,
  kcal: <><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2.5 2 3 0-3 .5-6 1-8.5z" /></>,
  bio: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z" /><path d="M5 19l7-7" /></>,
  vegan: <><path d="M7 4l5 16 5-16" /><path d="M12 20c0-5 2-8 6-10" /></>,
  gluten: <><path d="M12 21V8" /><path d="M12 8c-2 0-4-2-4-5 2 0 4 2 4 5zM12 8c2 0 4-2 4-5-2 0-4 2-4 5zM12 13c-2 0-4-2-4-4 2 0 4 1.5 4 4zM12 13c2 0 4-2 4-4-2 0-4 1.5-4 4z" /><path d="M4 4l16 16" /></>,
  pays: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  style: <><path d="M4 7h16M4 12h10M4 17h13" /></>,
  boutique: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9h16v2a3 3 0 0 1-5.3 2 3 3 0 0 1-5.4 0A3 3 0 0 1 4 11z" /><path d="M5 13v7h14v-7" /></>,
  canette: <><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M7 7h10M7 17h10" /></>,
  bouteille: <><path d="M10 2h4v4c0 1 3 2 3 6v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8c0-4 3-5 3-6z" /><path d="M7 13h10" /></>,
  pack: <><rect x="3" y="9" width="18" height="11" rx="2" /><path d="M7 9V5h10v4M9 9v11M15 9v11" /></>,
  fut: <><ellipse cx="12" cy="5" rx="7" ry="2.5" /><path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
}

export function RowIcon({ name, color = '#374151', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ROW[name] || ROW.info}
    </svg>
  )
}

export const TONE = {
  good: { dot: '#16A34A', bg: '#DCFCE7', fg: '#166534' },
  mid: { dot: '#F59E0B', bg: '#FEF3C7', fg: '#92400E' },
  bad: { dot: '#DC2626', bg: '#FEE2E2', fg: '#991B1B' },
  none: { dot: '#9CA3AF', bg: '#F3F4F6', fg: '#4B5563' },
}

// Photo produit : la miniature hébergée par l'app si elle existe, sinon la photo d'origine.
// Si l'image ne charge pas, on affiche le picto de la catégorie.
export function Photo({ p, size, alt = '', lazy = false }) {
  const [failed, setFailed] = useState(false)
  const src = p.thumb ? (p.thumb.startsWith("data:") ? p.thumb : `${import.meta.env.BASE_URL}${p.thumb}`) : p.image
  if (!src || failed) return <CatIcon cat={p.cat} size={size} />
  return <img src={src} alt={alt} loading={lazy ? 'lazy' : undefined} onError={() => setFailed(true)} />
}
