# Réglages et qualité du PDF

26 octobre 2026.

## Branchements corrigés

La hauteur minimale servait seulement de valeur de secours : une hauteur propre à une question prenait toujours la priorité. `domain/answerSpaceHeight.ts` définit maintenant un vrai plancher commun, appliqué dans `AnswerSpace`, aux questions, sous-questions et énoncés, au clavier comme à la souris. Le défaut affiché de 120 px est effectif. Les valeurs sont bornées entre 40 et 1600 px.

Augmenter le minimum ne réécrit pas les hauteurs individuelles : une zone de 500 px reste à 500 px avec un minimum de 300 px. Une hauteur individuelle de 80 px reste enregistrée et peut réapparaître si le minimum redescend. Le canvas reçoit la hauteur réellement affichée.

Une annotation, un corrigé ou une aide d'énoncé suffit maintenant à rendre sa zone visible, sans exiger `statementAnswerHeight`.

L'aperçu et les zones partagent `AnswerSpacePaper.tsx` : palettes et réglures ne divergent plus. Les fonds personnalisés restent prioritaires ; la case « Appliquer ce style et cette couleur à toutes les zones » remplace explicitement ces choix lors de l'enregistrement, à toute profondeur. Le minimum de hauteur s'applique toujours à toutes les zones.

`showSolutions`, auparavant conservé dans les données sans effet, est branché et accessible dans la configuration. Il définit l'ouverture initiale des aides ; le bouton de chaque zone reste autonome ensuite. Désactiver cette option referme les aides. L'impression conserve leur état courant.

Enregistrer la fiche n'ajoute plus automatiquement une année calculée qui masquerait l'année de la configuration générale. Un champ vide rétablit cet héritage. Les descriptions de pagination et de diaporama mentionnent maintenant les sous-questions réellement prises en charge.

## Rendu PDF

Deux conversions dégradaient les zones : le moteur exportait l'encre en PNG, et Chromium convertissait les motifs SVG répétés des réglures en petites images dans le PDF. Le grain du crayon subissait la même conversion.

- Le canvas haute densité reste réservé à l'écriture à l'écran.
- `components/canvas/printSvg.ts` enregistre en SVG les commandes du même `drawStroke` que le canvas. Les courbes de pression de perfect-freehand sont partagées, ainsi que toutes les formes, flèches, pointillés et surligneurs.
- Les réglures imprimées utilisent des lignes explicites. Les points sont regroupés dans un chemin vectoriel. Les espacements restent ceux du papier : 5 mm pour ardoise/grille/points, 2 et 8 mm pour Seyès.
- Le grain du crayon utilise des éléments vectoriels découpés dans son contour. Sa densité est bornée pour les anciennes annotations géantes. Les bords peuvent être plus nets que la texture filtrée de l'écran.
- Le texte et les formules restent du DOM et des glyphes natifs ; le texte de canvas est sélectionnable dans le PDF de contrôle.
- Les images importées conservent leur source et leur résolution. Une photo déjà floue n'est pas recréée artificiellement.
- La gomme pixel utilise des masques ordonnés : elle efface l'encre antérieure, pas les traits ajoutés ensuite ni le papier. Le moteur PDF du navigateur peut composer ces masques en images ; le contrôle « zéro image » couvre une fiche sans gomme pixel ni photographie.
- Les géométries temporaires sont libérées après impression. Le document enregistré n'est pas transformé par l'export.

## Validation

- `npm test` : 35 tests, dont minimum réel, conservation des grandes zones et bornes des données invalides.
- `npm run test:settings` : contrôles réels de la modale, enregistrement et rechargement, minimum avec hauteurs existantes, plusieurs profondeurs, poignée souris/clavier, bitmap de l'écran, fonds, aperçu, masquage sans perte d'encre, corrigés, thème, héritage de l'année, pagination, diaporama et bouton Imprimer.
- `npm run test:vector-print` : 26 comparaisons canvas/SVG couvrent six stylos, toutes les formes, les tirets/points, les surligneurs et l'ordre gomme/nouveaux traits. Une vraie fiche est exportée en PDF. Avec `PDF_PYTHON`, le contrôle inspecte aussi les ressources imbriquées des formulaires et motifs : aucune image bitmap sur cette fiche, y compris pour les réglures et le crayon ; texte de canvas sélectionnable.
- `npm run test:canvas`, `test:presentation` et `test:print` : conservation des essais de dessin, imports d'images, zones hors écran, répétition de l'impression, pages imbriquées, formules et reprise après erreur.
- `npm run build` : vérification TypeScript et construction de production.
- Sur le build servi par `preview` : `test:settings` et `test:print` réussis ; `test:offline` réussi avec un profil neuf, domaines externes bloqués et 231 fichiers précachés.

Le PDF témoin est rendu avec Poppler et examiné visuellement. Ces contrôles ne remplacent pas un essai sur imprimante physique, WebView Android ou stylet matériel. La migration vers des coordonnées indépendantes de la largeur d'écran, la pagination des zones de plus d'une page et l'export par lots restent décrits dans l'architecture cible.
