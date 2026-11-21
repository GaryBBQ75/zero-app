# Base de données de zéro

La base est en deux couches.

1. **Le catalogue** (les boissons) vient d'Open Food Facts. Il est importé chaque semaine par GitHub Actions dans `public/data/products.json`. Aucun serveur n'est nécessaire.
2. **La communauté** (comptes, notes, avis, ajouts de produits) a besoin d'un vrai backend. Choix proposé : **PocketBase**, installable en un clic sur Coolify (un seul conteneur, base SQLite, authentification et API incluses).

## 1. Catalogue (Open Food Facts)

- Script : `scripts/import-off.mjs`
- Lancement : automatique chaque lundi, ou à la main dans GitHub, onglet **Actions → Import du catalogue Open Food Facts → Run workflow**.
- Filtre : boissons vendues en France, dans les catégories sans alcool d'OFF (bières, vins, spiritueux, apéritifs, kombuchas…). Tout produit au-dessus de **1,2 %** est écarté.
- Format d'un produit :

| Champ | Type | Exemple |
|---|---|---|
| `id` | texte | `off-3080216052892` |
| `barcode` | texte | `3080216052892` |
| `name` | texte | `Blonde 0,0 %` |
| `brand` | texte | `Marque` |
| `cat` | `biere` · `vin` · `aperitif` · `spiritueux` · `soft` | `biere` |
| `abv` | nombre ou `null` | `0` |
| `sugar` | g / 100 ml ou `null` | `2.1` |
| `kcal` | kcal / 100 ml ou `null` | `18` |
| `quantity` | texte ou `null` | `33 cl` |
| `image` | URL ou `null` | image OFF |
| `popularity` | nombre de scans OFF | `1250` |

Licence ODbL : citer Open Food Facts (déjà fait dans l'app). Si on enrichit leurs données produit (taux d'alcool corrigé, photo), ces corrections doivent être reversées sous la même licence, le mieux étant de les renvoyer directement à OFF. Les notes et avis de la communauté restent à nous.

## 2. Communauté (PocketBase)

### `users` (collection d'authentification, fournie par PocketBase)

| Champ | Type | Notes |
|---|---|---|
| `email` | email | connexion par lien magique ou mot de passe |
| `pseudo` | texte, 2 à 24 caractères, unique | affiché sur les avis |
| `avatar` | fichier, optionnel | |
| `profil` | sélection : `curieux`, `sans_alcool`, `sport`, `conduite`, `autre` | optionnel, sert aux recommandations ; ne jamais demander de donnée de santé |

### `products` (produits ajoutés ou corrigés par la communauté)

Le catalogue OFF reste la source principale. Cette collection sert aux produits absents d'OFF et aux infos propres à zéro.

| Champ | Type | Notes |
|---|---|---|
| `barcode` | texte, unique | clé de jointure avec le catalogue |
| `name`, `brand` | texte | |
| `cat` | sélection (mêmes valeurs que le catalogue) | |
| `abv` | nombre, 0 à 1,2 | contrôle côté serveur |
| `photo` | fichier | |
| `status` | sélection : `en_attente`, `valide`, `refuse` | modération avant affichage |
| `created_by` | relation → `users` | |

### `ratings` (le cœur de l'app)

| Champ | Type | Notes |
|---|---|---|
| `user` | relation → `users`, obligatoire | |
| `barcode` | texte, obligatoire | même clé que le catalogue |
| `stars` | nombre entier, 1 à 5 | |
| `tags` | sélection multiple : `gout_original`, `peu_sucre`, `trop_sucre`, `rafraichissant`, `fade`, `a_racheter` | |
| `comment` | texte, 0 à 280 caractères | optionnel |
| `context` | sélection, optionnel : `apero`, `repas`, `soiree`, `sport` | |

Index unique sur (`user`, `barcode`) : une seule note par personne et par produit, modifiable.

### `product_scores` (vue calculée, lecture seule)

Vue SQL PocketBase qui agrège `ratings` :

```sql
SELECT
  barcode AS id,
  COUNT(*) AS count,
  ROUND(AVG(stars) * 2, 1) AS score10
FROM ratings
GROUP BY barcode
```

L'app lit cette vue pour afficher la note sur 10 et le nombre d'avis. Tant qu'un produit a moins de 3 avis, l'app affiche « Pas encore assez d'avis » plutôt qu'une note fragile.

### `reports` (signalements)

| Champ | Type | Notes |
|---|---|---|
| `user` | relation → `users` | |
| `target_type` | sélection : `rating`, `product` | |
| `target_id` | texte | |
| `reason` | sélection : `contient_alcool`, `infos_fausses`, `avis_abusif`, `autre` | |
| `status` | sélection : `ouvert`, `traite` | |

### Règles d'accès (API rules PocketBase)

| Collection | Lire | Créer | Modifier / supprimer |
|---|---|---|---|
| `ratings` | tout le monde | utilisateur connecté, `user = @request.auth.id` | l'auteur seulement |
| `product_scores` | tout le monde | personne | personne |
| `products` | `status = "valide"` ou l'auteur | utilisateur connecté | admin |
| `reports` | admin | utilisateur connecté | admin |

## Ordre de mise en place

1. Lancer l'import du catalogue (GitHub Actions).
2. Installer PocketBase sur Coolify (service en un clic), avec un domaine du type `api.zero.mondomaine.fr`.
3. Créer les collections ci-dessus dans l'admin PocketBase.
4. Brancher l'app : connexion, envoi des notes, lecture de `product_scores`. Les notes déjà stockées sur le téléphone sont envoyées à la première connexion.
