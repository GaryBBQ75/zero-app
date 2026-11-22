/// <reference path="../pb_data/types.d.ts" />
// Au démarrage : nom de l'app, adresse publique et connexion par les réseaux sociaux,
// lus dans les variables d'environnement de Coolify. Aucun secret dans le code.
onBootstrap((e) => {
  e.next()

  const settings = e.app.settings()
  settings.meta.appName = 'zéro'
  const url = $os.getenv('PB_APP_URL')
  if (url) settings.meta.appURL = url
  e.app.save(settings)

  // Un fournisseur est activé dès que son identifiant et son secret sont renseignés.
  const providers = []
  const add = (name, idVar, secretVar) => {
    const clientId = $os.getenv(idVar)
    const clientSecret = $os.getenv(secretVar)
    if (clientId && clientSecret) providers.push({ name, clientId, clientSecret })
  }
  add('google', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
  add('facebook', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET')
  add('microsoft', 'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET')

  const users = e.app.findCollectionByNameOrId('users')
  unmarshal({
    oauth2: {
      enabled: providers.length > 0,
      providers,
      mappedFields: { name: 'name', avatarURL: 'avatar' },
    },
  }, users)
  e.app.save(users)
  console.log(`zéro : connexion sociale active pour ${providers.map((p) => p.name).join(', ') || 'aucun fournisseur'}`)
})
