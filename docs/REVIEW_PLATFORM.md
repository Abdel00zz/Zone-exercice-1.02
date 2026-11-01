# Revue plateforme, performances et qualité

25 octobre 2026. Revue du code local, compilation web et essais Edge sans interface. Ce rapport ne certifie ni la compilation Android ni le ressenti physique du stylet.

## Décisions de la revue d'ingénierie

L'objectif « grande application, version légère » impose une limite de mémoire et une sauvegarde fiable avant d'ajouter des fonctions. Nous retenons un monolithe modulaire React/TypeScript, avec un domaine indépendant du DOM, des fonctionnalités séparées et des adaptateurs de stockage, impression et Android. Des microservices, un changement de framework ou une réécriture totale en une fois ajouteraient des frontières et des migrations sans résoudre les défauts observés. Ces options sont écartées à ce stade.

Une projection de pages indépendante des données est préférable à la duplication des questions. Les pages dérivées doivent conserver les chemins source afin que la sous-question reste éditable et que ses annotations restent uniques. Cette orientation du chantier présentation est approuvée.

**Réserve de l'ingénieur performance :** masquer les pages avec `display: none` conserve les composants, les arbres mathématiques et les effets React. Cela garantit actuellement que les pages restent disponibles pour l'impression, mais ne constitue pas une virtualisation. Il faut dissocier la disponibilité du document et le nombre de surfaces de rendu vivantes.

## Corrections livrées sur la plateforme

- Tailwind est compilé localement par PostCSS au développement et à la construction. Le script CDN et le compilateur CSS exécuté dans le navigateur sont supprimés. Le thème existant est repris dans `tailwind.config.cjs`, y compris les couleurs et polices. La détection inclut les nouveaux dossiers `features`, `domain` et `platform`.
- Le service worker est produit par `build/offlineShell.ts` sans bibliothèque supplémentaire. Son cache est lié à une empreinte des fichiers construits, des fichiers publics et du modèle HTML. Les modules différés, CSS, polices KaTeX et images locales sont précachés avant activation.
- Une mise à jour attend la fermeture des pages encore contrôlées par l'ancienne version. L'activation immédiate automatique a été supprimée afin de ne pas remplacer le cache sous une page encore ouverte.
- Le HTML de secours reste celui installé avec les modules de son cache. Une simple navigation réseau ne remplace plus seulement ce HTML par une version dont les modules pourraient manquer hors connexion.
- Les API restent hors cache. Les réponses réseau 401 sont conservées lors d'une navigation en ligne. Le hors connexion constitue toujours un accès à la copie déjà installée sur cet appareil, conformément au fonctionnement local existant.
- Le test Edge a révélé un piège réel : le serveur de prévisualisation ajoute `Vary: Origin`; les modules `crossorigin` ne retrouvaient pas la réponse installée sans en-tête Origin. La correspondance ignore cette variation uniquement pour les fichiers statiques connus du manifeste local. Les ressources distantes conservent leurs règles de variation.

## Vérifications reproductibles

`npm run build` inclut le contrôle TypeScript. Après construction, démarrer `npm run preview -- --host 127.0.0.1 --port 4173`, puis lancer `npm run test:offline` avec Playwright disponible. Le script réutilise Edge lorsqu'il est installé sous Windows et accepte `BROWSER_EXECUTABLE`, `PLAYWRIGHT_MODULE` et `OFFLINE_AUDIT_URL`.

L'essai utilise un profil neuf, bloque tous les domaines externes dès la première ouverture et attend l'installation du service worker. Il contrôle les utilitaires CSS, les fichiers précachés et un module de configuration jamais ouvert. Il ferme la page, coupe le réseau, relance l'application et contrôle à nouveau CSS, module différé et absence de mise en cache des API. Résultat constaté : **réussi**, 110 fichiers précachés lors du premier essai validé. Le nombre change avec les constructions.

L'essai prouve le fonctionnement du socle local après installation. Il ne prouve pas un premier accès web sans aucune connexion, ni le rendu de toutes les polices MathJax externes. Le CDN de MathJax et la feuille Google Fonts restent des dépendances pour les options correspondantes. Les polices de secours système et le moteur KaTeX embarqué permettent l'usage courant avec les CDN bloqués; MathJax signale encore un échec de téléchargement lorsqu'il est indisponible.

## Limites à traiter avant une montée en charge

| Constat | Conséquence | Décision proposée |
| --- | --- | --- |
| Le bundle principal dépasse 800 Ko brut pendant cette revue. | Le tableau de bord charge aussi une grande partie de l'éditeur et du moteur mathématique. | Séparer les points d'entrée tableau de bord, éditeur et impression; mesurer le premier affichage sur une tablette cible avant de fixer les budgets. |
| `WorksheetThumbnail` parcourt les questions et sous-questions avec `MathText`, même lorsque l'aperçu est coupé par son cadre. | Le coût de la galerie augmente avec le nombre et la taille des fiches. | Générer un aperçu statique par révision de fiche; rendre seulement les cartes proches du viewport. Conserver une voie de régénération pour éviter les miniatures obsolètes. |
| `MathJaxContext` englobe tout le tableau de bord et charge le CDN alors que KaTeX assure le rendu standard. | Requête externe et erreurs réseau possibles sans besoin de MathJax. | Charger MathJax seulement lorsqu'une police ou une formule nécessite ce moteur; embarquer les ressources du mode hors connexion promis au produit. |
| `AnswerSpace` monte son canvas une fois proche de l'écran, puis ne le démonte plus. | Naviguer sur 100 pages finit par conserver les surfaces des 100 pages. | Cache borné des surfaces active et voisines; historique et traits conservés dans le modèle avant toute éviction. Ne pas détruire l'état local tant que l'historique et les textes en cours n'ont pas été remontés. |
| L'impression force le montage de toutes les zones et crée les bitmaps en parallèle. | Un bitmap de 800 × 1600 CSS px à l'échelle 3,5 représente environ 60 Mio RGBA, avant sérialisation PNG et autres surfaces. Ce calcul est une estimation, pas une mesure mémoire. | Export par pages ou lots bornés, libération des surfaces après chaque lot et annulation possible. Préserver le moteur de document indépendant du viewport. |
| L'API générique `getBeamerMaxStep(unknown)` parcourt récursivement toutes les propriétés reçues. Les appels actuels transmettent toutefois des objets filtrés `{text, answer, solution, guidance}`. | Risque potentiel si un futur appel transmet la question entière; aucun parcours des traits d'encre n'est confirmé dans ces appels. | Conserver les projections filtrées et typer ce contrat pour prévenir une régression; ne pas présenter cette piste comme un problème de performance mesuré. |
| Les coordonnées des annotations restent dépendantes de la largeur écran. | Les proportions et l'alignement avec les réglures peuvent diverger écran/papier. | Repère document stable et transformation unique écran/impression, utilisé aussi par les images, sélections et textes. |
| Très grandes zones non paginées et corrigés à hauteur fixe. | Débordement ou troncature possibles malgré une impression techniquement déclenchée. | Mesure du contenu composé, règles de rupture et séparation entre zone logique et fragments papier. |
| `capacitor.config.json` autorise toutes les navigations et le contenu mixte. | Surface de navigation Android plus large que le besoin d'un éditeur local. | Inventorier les URL réellement nécessaires, puis limiter les origines et ouvrir les liens externes hors de la WebView. Ne pas changer ces options avant les essais Android. |
| Plusieurs fichiers de verrouillage coexistent et des clés de signature Android sont présentes dans l'arborescence. | Reproductibilité et contrôle des secrets à clarifier avant une distribution. | Choisir npm et son verrouillage pour la CI; exclure et externaliser les clés après inventaire, sans supprimer les seules copies existantes. |

L'évaluation mémoire n'est pas un résultat de benchmark. Un scénario cible doit mesurer temps d'ouverture, DOM, mémoire JS et surfaces graphiques pour 100 fiches et une fiche de 100 questions, puis une impression représentative. Une évolution ne doit pas annoncer une parité Word, Photoshop, Duolingo ou Samsung Notes sur la seule base d'une compilation.

## Dépendances et qualité

`npm audit` au moment de cette revue rapporte 8 groupes de vulnérabilités : 1 haut et 7 modérés. Aucun correctif forcé ni migration majeure n'a été appliqué.

- Le groupe haut se situe dans `better-react-mathjax → mathjax-full@3.2.2 → speech-rule-engine@4.1.4 → @xmldom/xmldom@0.9.10`. Cette branche est présente dans les dépendances installées; le composant web charge MathJax 4 depuis son CDN. La présence du paquet ne démontre pas que le parseur XML vulnérable est exécuté dans le bundle livré. Il faut vérifier l'exposition et supprimer ou mettre à jour cette branche de compatibilité sans casser les types/rendus.
- Des groupes modérés concernent les outils Capacitor/iOS (`@capacitor/cli → xcode → uuid`). Ils relèvent principalement de la chaîne de construction, pas d'un endpoint web utilisateur.
- Tailwind 3 utilise `postcss-selector-parser@6.1.5` directement et via `postcss-nested`. L'audit rapporte une complexité quadratique de parsing pour les versions antérieures à 7.1.6. Ici le CSS et la configuration sont des sources de construction contrôlées; ce parseur n'est plus livré comme compilateur dans le navigateur. Une mise à jour compatible ou un passage préparé à Tailwind 4 reste à faire. Un remplacement forcé du parseur majeur n'a pas été introduit sans validation de compatibilité.

Les tests doivent être orientés vers les risques : migration des données, conflit de synchronisation, chemins de sous-questions, navigation et retour sur annotations, impression exhaustive et redémarrage hors connexion. Ajouter des tests qui recopient les détails JSX ne remplace pas ces garanties.
