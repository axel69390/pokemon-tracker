# CardVault — publier sur Google Play

Application : https://axel69390.github.io/pokemon-tracker/cardvault/
Identifiant Android (à garder à vie) : `io.github.axel69390.cardvault`
Abonnements : `cardvault_monthly` (2,99 €/mois) · `cardvault_yearly` (24,99 €/an). Essai de 14 jours géré dans l'appli (pas besoin d'essai Google).

## 1. Compte développeur (une fois)
1. https://play.google.com/console → créer un compte **personnel** → payer 25 $ → vérifier l'identité (pièce d'identité + téléphone).
2. **Paramètres → Profil de paiement** : créer le profil marchand (obligatoire pour vendre un abonnement).

## 2. Fabriquer l'appli Android (5 min, sur PC)
1. Aller sur https://www.pwabuilder.com, coller l'adresse de l'appli ci-dessus → **Package For Stores** → **Android** → **Generate Package** → **All settings** :
   - Package ID : `io.github.axel69390.cardvault`
   - App name : `CardVault – TCG Collection & Invest` · Launcher name : `CardVault`
   - Version : `1.0.0` (version code `1`)
   - Signing key : **Create new** (nom : Axel, organisation : CardVault)
   - Cocher **Google Play Billing** (si l'option apparaît)
2. Télécharger le zip. Il contient : le fichier **`.aab`** (à envoyer sur Google Play), le **`signing.keystore`** + ses mots de passe, et **`assetlinks.json`**.
   ⚠️ Garder le keystore et ses mots de passe **en lieu sûr** : sans eux, impossible de publier une mise à jour.

## 3. Relier l'appli au site (pour l'affichage plein écran)
Android vérifie que le site autorise l'appli via `https://axel69390.github.io/.well-known/assetlinks.json`.
1. Sur GitHub, créer un dépôt public nommé exactement **`axel69390.github.io`**.
2. Y ajouter le fichier `assetlinks.json` du zip dans un dossier **`.well-known`**, et un fichier vide nommé **`.nojekyll`** à la racine.
3. Après la mise en ligne sur Google Play, ajouter aussi l'empreinte « App signing key » fournie par Google (Play Console → Configuration → Intégrité de l'appli) dans ce même fichier.
(Ou donner l'accès de ton jeton GitHub à ce dépôt et je m'en occupe.)

## 4. Créer l'appli dans la Play Console
1. **Créer une application** : CardVault · Application · Gratuite (avec achats intégrés).
2. **Fiche du store** : textes ci-dessous, icône 512 px (`cardvault/icon-512.png`), 2 à 8 captures d'écran du téléphone.
3. **Règles de confidentialité** : `https://axel69390.github.io/pokemon-tracker/cardvault/privacy.html`
4. **Sécurité des données** : aucune donnée collectée ni partagée (tout reste sur l'appareil) ; achats via Google Play.
5. **Classification du contenu** : questionnaire → tout public.
6. **Monétiser → Abonnements** : créer `cardvault_monthly` (forfait de base mensuel, 2,99 €, renouvellement auto) et `cardvault_yearly` (forfait annuel, 24,99 €). Pas d'essai gratuit côté Google.

## 5. Test fermé (obligatoire pour un nouveau compte personnel)
1. **Tests → Test fermé** → créer une piste → envoyer le `.aab`.
2. Ajouter **au moins 12 testeurs** (adresses Gmail ou un groupe Google) qui acceptent l'invitation et **gardent l'appli installée 14 jours**.
3. Ajouter ces testeurs dans **Paramètres → Tests de licence** : leurs achats d'abonnement sont alors gratuits (tests).
4. Après 14 jours : **Demander l'accès à la production**.

⚠️ Avant de tester un achat : Google rembourse automatiquement les abonnements qui ne sont pas « confirmés » (acquittés) par un serveur. Préviens-moi quand le compte est créé : je branche la confirmation sur ton serveur (il faudra créer un compte de service Google, je te guiderai).

---

## Textes de la fiche du store

**Titre (30 car.)** : CardVault – TCG Collection
**Description courte FR (80 car.)** : Suivez la valeur de vos cartes et produits scellés, avec cotes et alertes de revente.
**Short description EN** : Track the value of your cards and sealed products, with prices and resale alerts.

**Description complète FR**
CardVault est l'appli des collectionneurs de cartes à collectionner qui veulent savoir ce que vaut vraiment leur collection.

• Votre collection en un coup d'œil : cartes (brutes ou gradées PSA, PCA, CGC…) et produits scellés (displays, ETB, coffrets, blisters…), rangés par série et par extension.
• Catalogue intégré : ajoutez une carte en tapant son nom, avec visuel officiel, numéro et rareté.
• Cotes Cardmarket de la version exacte (1ère édition, reverse, full art…), mises à jour chaque jour : moyenne du jour, moyenne 30 jours et tendance.
• Portefeuille : valeur totale, plus-value, courbe d'évolution et meilleures performances du mois.
• Invest : mettez des cartes en veille, fixez un objectif de revente et recevez une alerte quand une carte prend 10 % ou plus.
• Ventes : enregistrez vos ventes et suivez votre résultat.
• Sets : suivez votre progression carte par carte.
• Vos données restent sur votre téléphone. Export CSV et sauvegarde complète.

14 jours d'essai gratuit, puis CardVault Premium à 2,99 €/mois ou 24,99 €/an, résiliable à tout moment.
CardVault n'est ni affilié ni approuvé par Nintendo, Creatures, GAME FREAK ou The Pokémon Company.

**Full description EN**
CardVault is the app for trading card collectors who want to know what their collection is really worth.

• Your whole collection at a glance: cards (raw or graded PSA, PCA, CGC…) and sealed products (booster boxes, ETBs, collections, blisters…), organised by series and set.
• Built-in catalogue: add a card by typing its name, with official artwork, number and rarity.
• Cardmarket prices for the exact version (1st edition, reverse, full art…), updated daily: daily average, 30-day average and trend.
• Portfolio: total value, gain, value chart and top performers of the month.
• Invest: add cards to your watchlist, set a resale target and get alerted when a card rises by 10 % or more.
• Sales: record your sales and track your results.
• Sets: track your progress card by card.
• Your data stays on your phone. CSV export and full backup.

14-day free trial, then CardVault Premium at €2.99/month or €24.99/year, cancel anytime.
CardVault is not affiliated with or endorsed by Nintendo, Creatures, GAME FREAK or The Pokémon Company.
