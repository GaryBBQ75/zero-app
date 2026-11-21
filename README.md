# zéro · les boissons sans alcool notées

Prototype d'app (PWA) qui référence et note les boissons sans alcool ou très faiblement alcoolisées : « le Yuka du sans alcool ».

## Ce que fait le prototype

- **Découvrir** : recherche, filtres par catégorie, interrupteur « vrai 0,0 % », classement par note.
- **Scanner** : scan du code-barres avec la caméra (ou saisie manuelle). Le produit est récupéré sur [Open Food Facts](https://world.openfoodfacts.org). Les boissons au-dessus de 1,2 % sont refusées.
- **Fiche produit** : note sur 10, taux d'alcool réel, sucres, calories, prix, avis.
- **Noter en 10 secondes** : étoiles et mots-clés.
- **Mon carnet** : récap du mois partageable, badges, historique.

Limites du prototype : le catalogue de départ est fictif, et les notes sont enregistrées dans le navigateur (localStorage). Il n'y a pas encore de vraie communauté partagée.

## Lancer en local

```bash
npm install
npm run dev
```

## Déployer sur Coolify

1. Dans Coolify : **New Resource → Application → GitHub** (ou Public/Private repository) et choisir ce dépôt, branche `main`.
2. **Build Pack : Dockerfile** (le `Dockerfile` est à la racine).
3. **Port exposé : 80**.
4. Renseigner le domaine (ex. `https://zero.mondomaine.fr`). Coolify génère le certificat HTTPS.
5. **Deploy**.

Le HTTPS est indispensable : sans lui, le navigateur bloque la caméra pour le scan.

## Prochaines étapes

- Backend partagé pour les notes (Supabase ou PocketBase, hébergeable sur le même Coolify).
- Comptes utilisateurs et vraie note communautaire.
- Import d'un catalogue réel de boissons sans alcool depuis Open Food Facts.

## Crédits

Données produit : Open Food Facts, sous licence [ODbL](https://opendatacommons.org/licenses/odbl/1-0/).
