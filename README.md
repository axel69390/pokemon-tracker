# Pokédex Invest

Application web (PWA) pour suivre la valeur d'une collection Pokémon TCG : cartes, cartes gradées et produits scellés.

## Fonctionnalités

- **Portefeuille** : valeur globale, plus-value, montant investi, courbe d'évolution (valeur vs investi), top performances du mois, historique des ventes.
- **Collection** : cartes en grille (2/3/4 colonnes), items regroupés par catégorie (Booster, Blister, Display, ETB, Coffret…), recherche, tri et filtres (langue, gradation, extension, état).
- **Fiche** : photo personnelle ou visuel officiel, gradation, prix d'achat, historique de valeur, **cote Cardmarket par version exacte** (1ère édition, sans ombre, illimitée…), liens vers les ventes réussies eBay, Cardmarket et Vinted.
- **Scanner** : photo → identification automatique (IA) → choix de la version dans le catalogue → ajout.
- **Catalogue** : toutes les extensions et cartes (FR / EN / JP) via TCGdex.
- **Ventes GCC** : prix moyen, médiane et dernières ventes réelles sur Graded Card Center, filtrés par numéro, langue, gradation et édition (via le serveur personnel).
- **Sets suivis** : progression carte par carte d’une extension ou d’un master set (possédées / manquantes).
- **Catalogue scellé FR** : ~1 300 produits (Display, ETB, Bundle, UPC, Tripack, Pokébox, Valisette…) avec visuels, généré par `tools/build_sealed.py`.
- **Saisie assistée** : suggestions pendant la frappe du nom (cartes FR via TCGdex, produits scellés FR).
- **Ventes** : enregistrement des ventes (prix, frais, plateforme) et calcul du résultat.
- **Données** : export JSON / CSV (Excel), restauration.

## Stockage

- **Cet appareil** : fonctionne sans serveur (données dans le navigateur).
- **Serveur personnel** : synchronisation multi-appareils, historique quotidien, photos, scanner.
  API attendue : `GET /v2/ping|data|img`, `POST /v2/save|photo|photo-delete|scan`, authentifiée par `?k=<clé>`.
  Lien de configuration en un geste : `https://…/pokemon-tracker/#connect=<url-serveur>|<clé>`.

## Technique

HTML/CSS/JS modules natifs, sans build ni dépendance. Hébergé sur GitHub Pages.

Pokémon est une marque de Nintendo / Creatures Inc. / GAME FREAK inc. Application non affiliée.
