// Interface language (French source → English). Screens are written in French; when English is
// selected, every rendered text node and label is translated in place (exact phrases + patterns).
// User data (card names, extensions, notes) never matches a whole UI phrase, so it is left untouched.

const KEY = (typeof window !== 'undefined' && window.APP_EDITION === 'cardvault') ? 'cv.lang' : 'pdx.lang';
export function langSetting() { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } }
export function setLang(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } }
export function lang() {
  const s = langSetting();
  if (s === 'fr' || s === 'en') return s;
  return String((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}
export const isEn = () => lang() === 'en';

const EN = {
  // Navigation & headings
  'Portefeuille': 'Portfolio', 'Collection': 'Collection', 'Catalogue': 'Catalogue', 'Scanner': 'Scanner', 'Réglages': 'Settings',
  'Invest': 'Invest', 'Cartes': 'Cards', 'Items': 'Items', 'Sets': 'Sets', 'Valeur globale': 'Total value', 'Gain': 'Gain', 'Achat': 'Cost',
  'Valeur': 'Value', 'Investi': 'Invested', 'Mes investissements': 'My investments', 'Top performances du mois': 'Top performers this month',
  'Historique des ventes': 'Sales history', 'Items vendus': 'Items sold', 'Cartes vendues': 'Cards sold', 'Résultat': 'Result',
  'Tout voir': 'See all', 'Cotes à valider': 'Prices to review', 'Mettre à jour': 'Update', 'En cours…': 'Running…',
  'Aucune variation de valeur ce mois-ci.': 'No value change this month.',
  'Mettez à jour la valeur de vos cartes pour voir leurs performances.': 'Update your card values to see their performance.',
  'Pas encore d’historique.': 'No history yet.', 'La courbe se construit jour après jour.': 'The chart builds up day by day.',
  'Hors ligne — affichage des dernières données connues.': 'Offline — showing the last known data.',
  'Votre collection est sur votre serveur ?': 'Is your collection on your own server?',
  'Collez votre lien de connexion dans les réglages.': 'Paste your connection link in Settings.', 'Connecter': 'Connect',
  'Ajoutez votre première carte ou votre premier produit scellé pour suivre la valeur de votre collection.':
    'Add your first card or sealed product to track the value of your collection.',
  'Ajouter': 'Add', 'Exporter': 'Export', 'Fermer': 'Close', 'Annuler': 'Cancel', 'Confirmation': 'Confirmation', 'Supprimer': 'Delete',
  'Retirer': 'Remove', 'Appliquer': 'Apply', 'Ignorer': 'Dismiss', 'Enregistrer': 'Save', 'Changer': 'Change', 'Associer': 'Link',
  'Utiliser': 'Use', 'Modifier': 'Edit', 'Vendre': 'Sell', 'Fiche': 'Details', 'Réessayer': 'Retry', 'Nouveau': 'New',

  // Collection
  'Rechercher une carte…': 'Search a card…', 'Rechercher un item…': 'Search an item…', 'Taille de la grille': 'Grid size', 'Filtres': 'Filters',
  'Trier et filtrer': 'Sort & filter', 'Trier par': 'Sort by', 'Affichage': 'Display', 'Par extension': 'By set', 'Liste unique': 'Single list',
  'Valeur ': 'Value', 'Plus-value €': 'Gain €', 'Plus-value %': 'Gain %', 'Ajout récent': 'Recently added', 'Nom': 'Name', 'Extension': 'Set',
  'Langue': 'Language', 'Gradation': 'Grading', 'Toutes': 'All', 'Gradées': 'Graded', 'Non gradées': 'Raw', 'État': 'Condition', 'Tous': 'All',
  'Scellés': 'Sealed', 'Ouverts': 'Opened', 'Ouvert': 'Opened', 'Scellé': 'Sealed', 'Toutes les extensions': 'All sets',
  'Réinitialiser': 'Reset', 'Aucun résultat': 'No results', 'Modifiez la recherche ou les filtres.': 'Change your search or filters.',
  'Aucune carte': 'No cards yet', 'Aucun item scellé': 'No sealed items yet',
  'Scannez ou ajoutez vos cartes pour suivre leur valeur.': 'Scan or add your cards to track their value.', 'Ajoutez vos cartes pour suivre leur valeur.': 'Add your cards to track their value.',
  'Boosters, displays, ETB, coffrets… suivez vos produits scellés.': 'Booster packs, boxes, ETBs, collections… track your sealed products.',
  'Autres cartes': 'Other cards', 'Sans extension': 'No set', 'Aucun set suivi': 'No tracked sets',
  'Suivez une extension complète pour voir votre progression carte par carte.': 'Track a whole set to see your progress card by card.',
  'Suivre une extension': 'Track a set', 'Dans le catalogue, ouvrez une extension puis « Suivre ce set ».': 'In the catalogue, open a set and tap “Track this set”.',
  'Possédées': 'Owned', 'Manquantes': 'Missing', 'Ne plus suivre ce set': 'Stop tracking this set', 'Set retiré': 'Set removed', 'Set suivi': 'Set tracked',
  'Set suivi — voir ma progression': 'Tracked set — see my progress', 'Suivre ce set': 'Track this set',

  // Detail sheet
  'Carte': 'Card', 'Item': 'Item', 'VALEUR': 'VALUE', 'Prix d’achat non renseigné': 'No purchase price', 'Valeur unitaire': 'Unit value',
  'Achat unitaire': 'Unit cost', 'Coût total': 'Total cost', 'Quantité': 'Quantity', 'Date d’achat': 'Purchase date', 'Valeur mise à jour': 'Value updated',
  'Cote': 'Price', 'Auto': 'Auto', 'Manuelle': 'Manual', 'Prix du marché': 'Market price', 'Moyenne du jour': 'Daily average',
  'Moyenne 30 jours': '30-day average', 'Dernière vente': 'Last sale', 'Évolution de la valeur': 'Value history', 'Version de la carte': 'Card version',
  'Changer de fiche': 'Change card', 'Cote du marché': 'Market price', 'Prix moyen': 'Average price', 'Tendance': 'Trend', 'Moyenne 30 j': '30-day avg',
  'Plus bas': 'Lowest', 'Médiane': 'Median', 'Fourchette': 'Range', 'Ventes': 'Sales', 'Ventes GCC': 'GCC sales', 'Cartes gradées': 'Graded cards',
  'Toutes notes': 'All grades', 'Toutes éditions': 'All editions', '1ère édition': '1st edition', 'Illimitée': 'Unlimited',
  'Ventes et annonces': 'Sales & listings', 'Ventes eBay': 'eBay sales', 'Dernières ventes réussies': 'Latest sold listings',
  'Annonces eBay': 'eBay listings', 'En cours': 'Active', 'Offres en Europe': 'European offers', 'Annonces': 'Listings', 'Offres': 'Offers',
  'Ventes réussies': 'Sold listings', 'Ventes de cartes gradées': 'Graded card sales', 'Remarque': 'Note',
  'Voir ma photo': 'Show my photo', 'Voir le visuel officiel': 'Show official artwork',
  'Cote saisie par vous : elle n’est jamais modifiée automatiquement.': 'Price entered by you: it is never changed automatically.',
  'Cote indisponible pour le moment.': 'Price not available right now.', 'Aucune cote disponible pour cette carte.': 'No price available for this card.',
  'Associez cette carte à sa fiche catalogue pour suivre automatiquement le prix de sa version exacte.':
    'Link this card to its catalogue entry to track the price of its exact version automatically.',
  'Aucune vente pour cette sélection.': 'No sales for this selection.',
  'Cote enregistrée (manuelle)': 'Price saved (manual)', 'Cote automatique : mise à jour chaque nuit': 'Automatic price: updated every night',
  'Cote manuelle': 'Manual price', 'Supprimé de la collection': 'Removed from collection', 'Valeur mise à jour ': 'Value updated',
  'Mettre en veille': 'Add to watchlist', 'En veille': 'Watching', '✓ En veille': '✓ Watching', '+ Veille': '+ Watch',

  // Form
  'Nouvelle carte': 'New card', 'Nouvel item': 'New item', 'Modifier ': 'Edit', 'Prendre une photo': 'Take a photo',
  'Choisir une image': 'Choose an image', 'Retirer ma photo': 'Remove my photo', 'Remplir depuis le catalogue': 'Fill from catalogue',
  'Choisir dans le catalogue': 'Choose from catalogue', 'Fiche catalogue associée': 'Linked catalogue entry', 'Produit du catalogue': 'Catalogue product',
  'La carte': 'The card', 'Le produit': 'The product', 'Nom *': 'Name *', 'Catégorie': 'Category', 'Numéro': 'Number', 'Année': 'Year',
  'Rareté': 'Rarity', 'Version': 'Version', 'État et gradation': 'Condition & grading', 'Note': 'Grade', 'Achat et valeur': 'Purchase & value',
  'Prix d’achat unitaire': 'Unit purchase price', 'Frais de gradation': 'Grading fees', 'Valeur actuelle unitaire': 'Current unit value',
  'Laisser vide = prix d’achat': 'Empty = purchase price', 'Emplacement, provenance…': 'Location, origin…',
  'Ajouter à ma collection': 'Add to my collection', 'Modifications enregistrées': 'Changes saved', 'Carte ajoutée': 'Card added',
  'Item ajouté': 'Item added', 'Le nom est obligatoire': 'Name is required', 'Tapez un nom : Dracaufeu…': 'Type a name: Charizard…',
  'Tapez un nom : Display 151…': 'Type a name: Booster Box 151…', 'Aucune suggestion': 'No suggestions', 'Suggestions indisponibles': 'Suggestions unavailable',
  'Carte indisponible': 'Card unavailable', 'Image illisible': 'Unreadable image',

  // Sell & sales
  'Quantité vendue': 'Quantity sold', 'Prix de vente unitaire': 'Unit sale price', 'Frais (port, commission)': 'Fees (shipping, commission)',
  'Date': 'Date', 'Plateforme': 'Platform', 'Main propre': 'In person', 'Autre': 'Other', 'Montant net': 'Net amount',
  'Enregistrer la vente': 'Save sale', 'Vente enregistrée': 'Sale saved', 'Indiquez le prix de vente': 'Enter the sale price',
  'Tout': 'All', 'Encaissé': 'Received', 'Aucune vente': 'No sales', 'Utilisez « Vendre » depuis la fiche d’une carte ou d’un item.':
    'Use “Sell” from a card or item page.', 'Vente supprimée': 'Sale deleted',

  // Catalogue
  'Produits scellés': 'Sealed products', 'Rechercher une carte (Dracaufeu, Pikachu…)': 'Search a card (Charizard, Pikachu…)',
  'Display 151, ETB Évolutions…': 'Booster box, ETB…', 'Aucune carte trouvée': 'No card found',
  'Vérifiez l’orthographe ou changez de langue.': 'Check the spelling or switch language.', 'Essayez une autre langue ou orthographe.': 'Try another language or spelling.',
  'Aucun produit': 'No products', 'Essayez un autre nom.': 'Try another name.',
  'Essayez un autre nom d’extension ou une autre catégorie.': 'Try another set name or category.', 'Catalogue indisponible': 'Catalogue unavailable',
  'Réessayez dans un instant.': 'Try again in a moment.', 'Choisir la carte': 'Choose the card', 'Nom de la carte': 'Card name',
  'Numéro (facultatif) : 4/102': 'Number (optional): 4/102', 'Tapez au moins 2 lettres.': 'Type at least 2 letters.', 'Ajouter un item': 'Add an item',
  'Rechercher : Display 151, ETB Évolutions…': 'Search: booster box, ETB…', 'Affinez la recherche pour voir plus de produits.': 'Refine your search to see more products.',
  'Impossible de charger cette carte': 'Could not load this card', 'Toutes les extensions ': 'All sets', 'PRIX MOYEN CARDMARKET': 'CARDMARKET AVERAGE',

  // Categories
  'Coffret': 'Collection box', 'Pokébox': 'Tin', 'Valisette': 'Collector chest', 'Tripack': '3-pack blister', 'Duo Pack': '2-pack',
  'Accessoire': 'Accessory', 'Deck': 'Deck', 'Display': 'Booster box', 'Bundle': 'Booster bundle', 'Booster': 'Booster pack', 'Blister': 'Blister', 'UPC': 'UPC',

  // Scanner
  'Photographier': 'Take photo', 'Nouvelle photo': 'New photo', 'Importer': 'Import', 'Cadrez la carte ou le produit, bien à plat': 'Frame the card or product, flat',
  '1. Photographiez': '1. Take a photo', 'Carte, carte gradée ou produit scellé': 'Card, graded card or sealed product',
  '2. Identification automatique': '2. Automatic identification', 'Nom, numéro, extension, langue, gradation': 'Name, number, set, language, grading',
  '3. Validez et ajoutez': '3. Confirm and add', 'Avec votre photo et la cote du marché': 'With your photo and the market price',
  'Analyse en cours…': 'Analysing…', 'Analyse impossible': 'Analysis failed', 'Saisir à la main': 'Enter manually', 'CARTE DÉTECTÉE': 'CARD DETECTED',
  'PRODUIT DÉTECTÉ': 'PRODUCT DETECTED', 'Ajouter cet item': 'Add this item', 'Choisissez la bonne version': 'Choose the right version',
  'Aucune correspondance catalogue': 'No catalogue match', 'Ajouter sans fiche catalogue': 'Add without catalogue entry', 'Ajouter une carte': 'Add a card',
  'Produit non identifié': 'Unidentified product',
  'La reconnaissance automatique utilise votre serveur personnel. Configurez-le dans les réglages, ou ajoutez vos cartes depuis le catalogue.':
    'Automatic recognition uses your personal server. Set it up in Settings, or add your cards from the catalogue.',
  'Le scanner est inclus dans CardVault Premium.': 'The scanner is included in CardVault Premium.',

  // Invest
  'Valeur en veille': 'Watchlist value', 'Plus-value potentielle': 'Potential gain', 'Attendre': 'Wait', 'Surveiller': 'Watch', 'Acheter': 'Buy', 'Garder': 'Hold', 'Monte': 'Rising', 'Baisse': 'Falling', 'Stable': 'Stable',
  'Prix bas : bon moment pour acheter': 'Low price: good time to buy', 'Rien à faire pour l’instant': 'Nothing to do for now', 'Prix bas sur 30 jours': 'Low price over 30 days', 'Mes cartes en veille': 'My watchlist',
  'Bon moment pour vendre': 'Good time to sell', 'Signes favorables, à suivre': 'Positive signs, keep watching', 'Pas le bon moment': 'Not the right time',
  'Hausses ≥ 10 %': 'Rises ≥ 10 %', 'Meilleurs moments pour vendre': 'Best times to sell', 'Aucune carte en veille': 'Nothing on your watchlist',
  'Mettez en veille les cartes et items que vous envisagez de revendre : l’appli suit leur prix chaque nuit et vous signale le bon moment.':
    'Add the cards and items you may resell: the app tracks their price every night and tells you when to sell.',
  'Choisir dans ma collection': 'Pick from my collection', 'Tendances dans ma collection': 'Trends in my collection',
  'cartes possédées, hors veille': 'owned, not on watchlist', 'PRIX DU MARCHÉ': 'MARKET PRICE', 'COTE GCC (MÉDIANE DES VENTES)': 'GCC PRICE (MEDIAN OF SALES)',
  'Prix': 'Price', 'Moyenne 30 j ': '30-day avg', 'Objectif': 'Target', 'Plus-value': 'Gain', 'Plus haut / bas 30 j': '30-day high / low',
  'Signaux': 'Signals', 'Objectif de revente': 'Resale target', 'Prix unitaire visé': 'Target unit price',
  'Quand le prix du marché atteint l’objectif, la carte passe en « Vendre ».': 'When the market price reaches the target, the card switches to “Sell”.',
  'Objectif enregistré': 'Target saved', 'Mis en veille': 'Added to watchlist', 'Retiré de la veille': 'Removed from watchlist',
  'Rechercher dans ma collection': 'Search my collection', 'Plus haut des 30 derniers jours': 'Highest in the last 30 days',
  'Les premiers points sont estimés à partir des moyennes Cardmarket ; la courbe se précise chaque nuit.':
    'The first points are estimated from Cardmarket averages; the chart gets more precise every night.',
  'Vente': 'Sale',

  // Settings
  'Stockage des données': 'Data storage', 'Sur cet appareil': 'On this device', 'Connecté': 'Connected', 'Hors ligne': 'Offline',
  'Appareil': 'Device', 'Serveur': 'Server', 'Lien de connexion': 'Connection link', 'Collez ici le lien de connexion reçu': 'Paste the connection link here',
  'Adresse du serveur': 'Server address', 'Clé d’accès': 'Access key', 'Clé fournie par votre serveur': 'Key provided by your server',
  'Enregistrer et tester': 'Save and test',
  'Le serveur synchronise la collection entre vos appareils, conserve l’historique quotidien de la valeur et active le scanner.':
    'The server syncs your collection across devices, keeps the daily value history and enables the scanner.',
  'Les données sont enregistrées dans ce navigateur uniquement. Exportez-les régulièrement ou connectez un serveur personnel pour les synchroniser.':
    'Your data is stored on this device only. Export it regularly to keep a backup.',
  'Mes données': 'My data', 'Sauvegarde complète': 'Full backup', 'Fichier JSON (cartes, items, ventes, sets, historique)': 'JSON file (cards, items, sales, sets, history)',
  'Export tableur': 'Spreadsheet export', 'Fichier CSV compatible Excel': 'Excel-compatible CSV file', 'Restaurer une sauvegarde': 'Restore a backup',
  'Remplace la collection actuelle': 'Replaces the current collection', 'Sauvegarde restaurée': 'Backup restored', 'Restaurer': 'Restore', 'À propos': 'About',
  'Serveur connecté': 'Server connected', 'Clé d’accès refusée': 'Access key refused', 'Lien de connexion invalide': 'Invalid connection link',
  'Serveur injoignable': 'Server unreachable', 'Le serveur ne répond pas': 'Server not responding', 'Automatique': 'Automatic', 'Français': 'Français', 'English': 'English',
  'Collection modifiée depuis un autre appareil : données rechargées': 'Collection changed on another device: data reloaded',
  'Stockage de l’appareil plein : passez en mode serveur ou exportez vos données': 'Device storage full: export your data',
  'La mise à jour prend plus de temps que prévu': 'The update is taking longer than expected',
  'Mise à jour des cotes lancée (environ 1 minute)': 'Price update started (about 1 minute)', 'Ce fichier n’est pas une sauvegarde Pokédex Invest': 'This file is not a valid backup',
  'Le suivi des prix et les alertes de revente sont inclus dans CardVault Premium.': 'Price tracking and resale alerts are included in CardVault Premium.',
  'Gérer dans Google Play › Abonnements': 'Manage in Google Play › Subscriptions', '2,99 € / mois ou 24,90 € / an': '€2.99 / month or €24.90 / year',
  'CardVault Premium : 2,99 € / mois': 'CardVault Premium: €2.99 / month', 'Ce fichier n’est pas une sauvegarde valide': 'This file is not a valid backup',
  'Mise à jour des cotes…': 'Updating prices…', 'jamais': 'never', '1A': '1Y',
  'Une pastille apparaît sur l’onglet Invest dès qu’une carte ou un item de votre collection (achetée, hors communes et peu communes, d’une valeur d’au moins 1 €) prend au moins 10 % en 7 jours.':
    'A badge appears on the Invest tab as soon as a card or item in your collection (bought, not common or uncommon, worth at least €1) rises by 10 % or more in 7 days.',
  'Signaux calculés chaque nuit à partir du prix du marché (Cardmarket, GCC, TCGplayer) et de votre prix d’achat. Ce ne sont pas des conseils financiers.':
    'Signals are computed from the market price and your purchase price. This is not financial advice.', 'Suivre ce set ': 'Track this set',
};

// Phrases containing numbers, amounts or dates.
const RULES = [
  [/^Cartes · (\d+)$/, 'Cards · $1'], [/^Items · (\d+)$/, 'Items · $1'], [/^Sets · (\d+)$/, 'Sets · $1'], [/^Tout · (\d+)$/, 'All · $1'],
  [/^(\d+) extensions?$/, (m) => `${m[1]} set${m[1] === '1' ? '' : 's'}`],
  [/^(\d+) cartes?$/, (m) => `${m[1]} card${m[1] === '1' ? '' : 's'}`], [/^(\d+) items?$/, (m) => `${m[1]} item${m[1] === '1' ? '' : 's'}`],
  [/^(\d+) ventes?$/, (m) => `${m[1]} sale${m[1] === '1' ? '' : 's'}`], [/^(\d+) relevés?$/, (m) => `${m[1]} reading${m[1] === '1' ? '' : 's'}`],
  [/^(\d+) jours? relevés?$/, (m) => `${m[1]} day${m[1] === '1' ? '' : 's'} recorded`],
  [/^\/ (\d+) cartes$/, '/ $1 cards'], [/^(\d+) manquantes?$/, '$1 missing'], [/^Possédées · (\d+)$/, 'Owned · $1'], [/^Manquantes · (\d+)$/, 'Missing · $1'],
  [/^(\d+) extensions? · (\d+) cartes?$/, (m) => `${m[1]} set${m[1] === '1' ? '' : 's'} · ${m[2]} card${m[2] === '1' ? '' : 's'}`],
  [/^Dépensé (.+)$/, 'Spent $1'], [/^Manquantes (\d+)$/, 'Missing $1'], [/^Dépensé$/, 'Spent'],
  [/^Prix moyen · 12 mois$/, 'Average · 12 months'], [/^Relevé du (.+)\.$/, 'Recorded on $1.'],
  [/^VALEUR · (\d+) EXEMPLAIRES$/, 'VALUE · $1 COPIES'], [/^n° (.+)$/, 'no. $1'],
  [/^Cotes mises à jour :$/, 'Prices updated:'], [/^(.+) · (\d+) cartes?$/, (m) => `${m[1]} · ${m[2]} card${m[2] === '1' ? '' : 's'}`],
  [/^Mise à jour automatique chaque nuit(.*)\.$/, 'Updated automatically every night$1.'],
  [/^Cotes à jour : (\d+) cartes?(.*)$/, (m) => `Prices updated: ${m[1]} card${m[1] === '1' ? '' : 's'}${m[2].replace(/(\d+) à valider/, '$1 to review')}`],
  [/^Ventes réalisées sur Graded Card Center(.*)$/, 'Sales completed on Graded Card Center$1'],
  [/^Aucune vente de cette carte sur GCC(.*)\.$/, 'No GCC sales for this card$1.'],
  [/^Supprimer « (.+) » de votre collection \?$/, 'Remove “$1” from your collection?'],
  [/^Vendre « (.+) »$/, 'Sell “$1”'], [/^Objectif atteint \((.+)\)$/, 'Target reached ($1)'],
  [/^Au-dessus de sa moyenne 30 j \((.+)\)$/, 'Above its 30-day average ($1)'], [/^Sous sa moyenne 30 j \((.+)\)$/, 'Below its 30-day average ($1)'],
  [/^En hausse sur 7 jours \((.+)\)$/, 'Up over 7 days ($1)'], [/^En baisse sur 7 jours \((.+)\)$/, 'Down over 7 days ($1)'],
  [/^Plus-value de (.+) sur l’achat$/, 'Gain of $1 on cost'], [/^(.+) → (.+) en 7 jours(.*)$/, (m) => `${m[1]} → ${m[2]} in 7 days${m[3].replace(' · en veille', ' · watching')}`],
  [/^Essai gratuit : (\d+) jours? restants?$/, (m) => `Free trial: ${m[1]} day${m[1] === '1' ? '' : 's'} left`],
  [/^Le (\d+) (.+)$/, 'On $1 $2'],
  [/^(\d+) cartes · (\d+) items · (\d+) ventes · (\d+) jours d’historique$/, '$1 cards · $2 items · $3 sales · $4 days of history'], [/^Bienvenue dans (.+)$/, 'Welcome to $1'],
];

const cache = new Map();
export function tr(text) {
  if (!isEn() || !text) return text;
  const raw = String(text);
  const trimmed = raw.trim();
  if (!trimmed || !/[A-Za-zÀ-ÿ]/.test(trimmed)) return text;
  if (cache.has(trimmed)) return raw.replace(trimmed, cache.get(trimmed));
  let out = EN[trimmed];
  if (out == null) {
    for (const [re, rep] of RULES) {
      const m = trimmed.match(re);
      if (m) { out = typeof rep === 'function' ? rep(m) : trimmed.replace(re, rep); break; }
    }
  }
  if (out == null) out = trimmed;
  cache.set(trimmed, out);
  return raw.replace(trimmed, out);
}

const ATTRS = ['placeholder', 'title', 'aria-label'];
function translateNode(node) {
  if (node.nodeType === 3) {
    const v = node.nodeValue;
    const t = tr(v);
    if (t !== v) node.nodeValue = t;
    return;
  }
  if (node.nodeType !== 1 || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.closest?.('[data-no-tr]')) return;
  ATTRS.forEach((a) => { const v = node.getAttribute(a); if (v) { const t = tr(v); if (t !== v) node.setAttribute(a, t); } });
  node.childNodes.forEach(translateNode);
}

// Keeps the whole interface translated as screens, sheets and toasts render.
export function startAutoTranslate() {
  document.documentElement.lang = lang();
  if (!isEn()) return;
  translateNode(document.body);
  new MutationObserver((muts) => {
    muts.forEach((m) => {
      if (m.type === 'characterData') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
      if (m.type === 'attributes') translateNode(m.target);
    });
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const titleObs = new MutationObserver(() => { const t = tr(document.title.split(' · ')[0]); if (!document.title.startsWith(t)) document.title = document.title.replace(/^[^·]+/, t + ' '); });
  const titleEl = document.querySelector('title'); if (titleEl) titleObs.observe(titleEl, { childList: true });
}
