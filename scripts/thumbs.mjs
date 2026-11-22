import { createHash } from 'node:crypto'
// Nom de fichier stable de la miniature d'une photo (dérivé de son adresse).
export const thumbName = (url) => `${createHash('sha1').update(url).digest('hex').slice(0, 14)}.webp`
