// Télécharge une miniature légère (240 px, WebP) de chaque photo produit dans public/img/.
// Les photos sont ainsi servies par l'app elle-même : plus rapide, et rien ne dépend des sites sources.
// Lancé par GitHub Actions (.github/workflows/images.yml). Nécessite sharp.
import { readFile, writeFile, access } from 'node:fs/promises'
import sharp from 'sharp'
import { thumbName } from './thumbs.mjs'

const products = JSON.parse(await readFile('public/data/products.json', 'utf8')).products
const todo = []
for (const p of products) {
  if (!p.image) continue
  const file = `public/img/${thumbName(p.image)}`
  try { await access(file) } catch { todo.push({ url: p.image, file }) }
}
const unique = [...new Map(todo.map((t) => [t.file, t])).values()]
console.log(`${unique.length} miniatures à créer`)

const sized = (url) => (url.includes('cdn.shopify.com') ? `${url}${url.includes('?') ? '&' : '?'}width=400` : url)
let ok = 0
let ko = 0
async function one({ url, file }) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(sized(url), { headers: { 'User-Agent': 'zero-app/1.0 (catalogue boissons sans alcool)' }, signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new Error(res.status)
      const buf = Buffer.from(await res.arrayBuffer())
      const out = await sharp(buf).rotate().resize(240, 240, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer()
      await writeFile(file, out)
      ok++
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    }
  }
  ko++
}
const queue = [...unique]
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await one(queue.shift()) }))
console.log(`Miniatures : ${ok} créées, ${ko} en échec`)
