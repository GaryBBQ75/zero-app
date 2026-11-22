# Base de données de zéro (PocketBase)

Comptes, notes et avis, boissons proposées. Déployée sur Coolify comme une application à part, à partir de ce dossier.

## Coolify
- Source : dépôt `GaryBBQ75/zero-app`, branche `main`, **Base Directory `/backend`**, build pack Dockerfile, port **8090**.
- Stockage persistant : monter un volume sur `/pb/pb_data` (sinon tout est perdu à chaque déploiement).
- Variables d'environnement (à saisir dans Coolify, jamais dans le code) :
  - `PB_APP_URL` : adresse publique de la base, par exemple `https://api.zero.exemple`
  - `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD` : compte administrateur (tableau de bord sur `/_/`)
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` : connexion Google
  - facultatif : `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`

## Connexion Google
Dans Google Cloud Console, créer un identifiant OAuth « Application Web » avec comme URI de redirection autorisée :
`<PB_APP_URL>/api/oauth2-redirect`
