/// <reference path="../pb_data/types.d.ts" />
// Schéma de zéro : notes et avis, score de chaque boisson, boissons proposées par la communauté.
migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const own = "@request.auth.id != '' && user = @request.auth.id"

  // Une note par personne et par boisson (l'identifiant de la fiche du catalogue)
  const ratings = new Collection({
    type: 'base',
    name: 'ratings',
    listRule: '',
    viewRule: '',
    createRule: own,
    updateRule: own + ' && @request.body.user:isset = false',
    deleteRule: own,
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: true },
      { name: 'product', type: 'text', required: true, max: 120 },
      { name: 'stars', type: 'number', required: true, min: 1, max: 5, onlyInt: true },
      { name: 'tags', type: 'json', maxSize: 2000 },
      { name: 'comment', type: 'text', max: 1000 },
      { name: 'created', type: 'autodate', onCreate: true },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_ratings_user_product ON ratings (user, product)',
      'CREATE INDEX idx_ratings_product ON ratings (product)',
    ],
  })
  app.save(ratings)

  // Score communautaire calculé à la volée
  const scores = new Collection({
    type: 'view',
    name: 'product_scores',
    listRule: '',
    viewRule: '',
    viewQuery: 'SELECT product AS id, ROUND(AVG(stars), 2) AS average, COUNT(*) AS count FROM ratings GROUP BY product',
  })
  app.save(scores)

  // Boisson scannée qui n'est pas encore dans le catalogue
  const submissions = new Collection({
    type: 'base',
    name: 'submissions',
    listRule: own,
    viewRule: own,
    createRule: own,
    updateRule: null,
    deleteRule: own,
    fields: [
      { name: 'user', type: 'relation', collectionId: users.id, required: true, maxSelect: 1, cascadeDelete: false },
      { name: 'barcode', type: 'text', max: 20 },
      { name: 'brand', type: 'text', required: true, max: 120 },
      { name: 'name', type: 'text', required: true, max: 160 },
      { name: 'cat', type: 'select', maxSelect: 1, values: ['biere', 'vin', 'cidre', 'aperitif', 'spiritueux', 'kombucha', 'soft', 'autre'] },
      { name: 'abv', type: 'number', min: 0, max: 1.2 },
      { name: 'photo', type: 'file', maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] },
      { name: 'status', type: 'select', maxSelect: 1, values: ['nouveau', 'accepte', 'refuse'] },
      { name: 'created', type: 'autodate', onCreate: true },
    ],
  })
  app.save(submissions)
}, (app) => {
  for (const name of ['submissions', 'product_scores', 'ratings']) {
    try { app.delete(app.findCollectionByNameOrId(name)) } catch { /* déjà absente */ }
  }
})
