# Audit des canvas, zones de réponse, stylets et impression

Date : 25 octobre 2026.

Complément : la réarchitecture suivante corrige aussi la synchronisation des canvas montés et sépare le modèle d'encre des caches DOM. L'état courant est détaillé dans [l'architecture cible](ARCHITECTURE_CIBLE.md).

## Résultat

Le projet possède déjà un moteur d'encre web évolué. Plusieurs défauts de liaison entre les zones, les événements du stylet et l'impression ont été corrigés pendant cet audit. La compilation web et les essais automatisés dans Edge passent. La sensation physique au S-Pen et l'impression native Android restent à valider sur tablette ; aucun nouvel APK n'a été construit.

## Architecture observée

```text
App : données des fiches, configuration, impression
  ExerciseCard / QuestionList : héritage des réglages et mises à jour
    AnswerSpace : hauteur, couleur, réglure SVG, corrigé
      DrawingCanvas : pointeurs, dessin 2D, outils et sélection
        inkEngine : pression, filtre One Euro, simplification, formes
        renderUtils : perfect-freehand, profils de plumes, images
        CanvasTextLayer : texte et formules dans le DOM

FloatingToolbar → toolStore : préférences communes aux zones
FloatingToolbar → canvasRegistry : actions sur la zone active
FloatingToolbar → App : fond appliqué à toute la fiche

worksheetPrint → montage synchrone des zones hors écran
              → bitmap indépendant haute résolution + texte dans un SVG
              → CSS A4 / window.print / pont Android PrintManager
```

`components/DrawingCanvas.tsx` est un réexport du composant situé dans `components/canvas/` ; il ne contient pas un deuxième moteur.

Les questions terminales reçoivent une zone lorsque `showCanvas` est actif. Les questions contenant des sous-questions délèguent leurs zones aux sous-questions. Les zones d'énoncé disposent aussi de leurs réglages et traits propres. Les réglages locaux priment sur les valeurs de la fiche.

## Corrections réalisées

| Défaut constaté | Correction |
| --- | --- |
| Un deuxième pointeur pouvait modifier ou terminer un geste existant | Le canvas suit le `pointerId` du geste et ignore les autres pointeurs. |
| La position du relâchement n'était pas conservée | Le dernier point est ajouté sans injecter la pression nulle de levée ; les formes et surligneurs droits traitent aussi leur point final. |
| Annulation ou perte de capture pouvait laisser un geste actif | Le geste est finalisé sur annulation et perte de capture, sans ajouter de coordonnées artificielles. |
| Le réglage `penOnly` était stocké mais inutilisé | Option reliée aux événements et affichée dans la barre ; le doigt peut défiler en mode stylet uniquement. |
| Le rejet de paume bloquait systématiquement toute écriture tactile | Les grandes surfaces et contacts récents après stylet sont filtrés lorsque le rejet est activé ; l'écriture tactile fonctionne lorsque les options l'autorisent. |
| Tous les traits étaient rejoués pendant chaque déplacement | Cache temporaire de l'encre déjà écrite pendant le geste ; le trait courant reste peint à chaque image. |
| Une stabilisation à zéro continuait de filtrer les coordonnées | Zéro laisse passer les échantillons sans filtrage. |
| L'encre sombre par défaut était presque invisible sur l'ardoise | Adaptation de contraste des encres très claires/sombres selon le papier, sans changer la couleur sauvegardée ; surligneurs exclus. |
| Une activation de zone changeait la largeur de bordure et pouvait redimensionner les traits | Bordure de largeur constante et mise en évidence par anneau. |
| « Appliquer à toutes » ne touchait que les canvas déjà montés | Mise à jour des données de toute la fiche : énoncés, questions et sous-questions, même hors écran. |
| Les zones montées juste avant impression pouvaient manquer l'événement de préparation | Montage React synchrone, puis événement distinct de préparation des canvas, commun au bouton et à Ctrl+P. |
| Le changement de largeur A4 étirait les bitmaps, transformant les cercles en ellipses | Bitmap d'impression séparé, intégré avec le texte dans un SVG dont le rapport d'aspect est conservé. |
| Le retour de l'impression et une animation de largeur pouvaient modifier les coordonnées | L'impression ne redimensionne plus le canvas écran ; suppression de la transition de largeur de la fiche. |
| Des lignes au bord des tuiles SVG disparaissaient du PDF | Suppression du débordement des motifs et déplacement des lignes principales à l'origine des tuiles. |
| Une annotation claire pouvait disparaître sur le papier blanc | Conversion des encres de craie connues vers une encre sombre pour l'impression, quel que soit le fond écran. |
| Une sélection et ses commandes pouvaient apparaître à l'impression | Le bitmap d'impression ne contient que les annotations ; l'interface de sélection est masquée. |
| Des images sauvegardées pouvaient être relues avec un cache DOM `{}` inutilisable | Recréation des éléments image et exclusion du cache DOM des nouveaux traits transmis à la sauvegarde. |
| Des images n'étaient pas encore décodées lors de la capture | Préchargement des images du canvas ; le bouton d'impression attend leur préparation ainsi que les polices et images du document. |
| Le pont Android ne signalait pas la fin d'un travail | Délégation du `PrintDocumentAdapter`, notification JavaScript dans `onFinish` et nettoyage en cas d'échec. |

## Rendu des réglures

| Style | Écran | Impression A4 |
| --- | --- | --- |
| Ardoise | Fond sombre par défaut, lignes horizontales | Papier blanc, lignes espacées de 5 mm |
| Seyès | Trois interlignes entre les lignes principales | Interlignes de 2 mm, lignes principales et verticales de 8 mm |
| Quadrillage | Carrés | Carrés de 5 mm |
| Points | Réseau de points | Pas de 5 mm |
| Vierge | Sans réglure | Papier blanc sans réglure |

Les couleurs de fond écran restent personnalisables indépendamment du motif. L'impression utilise une palette claire commune, un cadre fin et les réglures SVG. Les espacements physiques supposent une impression à 100 % ; un réglage d'échelle dans le dialogue système les modifie.

L'encre imprimée est un bitmap à 3,5 pixels par pixel CSS, soit environ 336 ppp avant ajustement à la largeur disponible. Le SVG réduit uniformément les annotations et le texte si nécessaire ; il n'agrandit pas la hauteur de la zone. Une annotation peut donc changer de position par rapport aux réglures physiques si la largeur papier diffère de celle de l'écran. Les traits sauvegardés restent inchangés. Le bitmap d'impression est libéré au retour à l'écran.

## Écriture proche de Noteshelf ou Samsung Notes

Présent dans le code : pression matérielle déclarée pour les pointeurs stylet, courbes de pression, inclinaison utilisée pour le crayon, filtre One Euro, événements coalescés avec repli, dessin cadencé par `requestAnimationFrame`, profils bille/plume/feutre/crayon, simplification tenant compte de la pression et reconnaissance de formes après maintien.

La correction du cache évite de rejouer l'historique d'encre pendant chaque mouvement. Le contrôle automatisé mesure huit remplissages pour huit images de déplacement sur une zone déjà écrite. Ce résultat vérifie le chemin de rendu, pas une latence physique en millisecondes.

Il n'y a actuellement ni surface d'encre native Android, ni prédiction de mouvement, ni mesure de latence réelle. L'audit ne permet donc pas d'affirmer une équivalence avec Samsung Notes ou Noteshelf.

Pour aller plus loin sur Android, une piste à prototyper est une surface native fondée sur AndroidX Ink, reliée aux zones via Capacitor et capable d'exporter vers le même modèle de données. Android documente des outils d'encrage et des mécanismes de rendu à faible latence ; leur intégration nécessiterait un chantier distinct et des mesures sur le matériel cible. Voir [AndroidX Ink](https://developer.android.com/jetpack/androidx/releases/ink) et [fonctions avancées des stylets Android](https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/advanced-stylus-features).

## Limites encore présentes

1. **Validation matérielle** : pression, rejet de paume, bouton gomme, défilement tactile et sortie du dialogue d'impression Android doivent être essayés avec un vrai stylet. Java/JDK et SDK Android n'ont pas été trouvés dans l'environnement courant ; la modification Java n'a pas été compilée.
2. **Très grandes zones** : la hauteur maximale de 1600 px peut dépasser une page A4. La zone possède `break-inside: avoid` et du contenu absolu ; aucune pagination interne des annotations n'est implémentée.
3. **Redimensionnement écran** : le comportement historique adapte uniquement les abscisses lors d'une variation de largeur. Cela peut déformer une figure à l'écran. Un repère de document stable, commun aux traits, textes, images, sélection et impression, serait préférable.
4. **Annuler/rétablir** : l'historique couvre principalement les ajouts et gommages. Les modifications de sélection, déplacements, duplications et éditions de texte ne forment pas encore un historique complet d'opérations.
5. **Données externes** : `initialStrokes` initialise la référence au montage. Une modification externe des traits pendant que la même zone reste montée n'est pas synchronisée explicitement avec cette référence.
6. **Corrigés longs** : le corrigé est superposé dans un conteneur de hauteur fixe avec débordement masqué. Son estimation de hauteur n'est pas une mesure réelle du texte composé ; une solution longue peut être tronquée.
7. **Images distantes et Ctrl+P** : le bouton peut attendre le chargement des ressources ; un événement natif `beforeprint` ne permet pas de garantir une attente asynchrone du navigateur. Les images déjà chargées et les images intégrées sont le cas le plus fiable. Une image distante sans autorisation CORS peut également empêcher l'export du canvas.
8. **Dépendances réseau** : Tailwind et plusieurs polices proviennent de CDN dans `index.html`. Le rendu totalement hors ligne, surtout au premier lancement, mérite un audit distinct.

## Vérifications effectuées

- `npm run typecheck` : réussi.
- `npm run build` : réussi. Avertissements Rollup sur des commentaires de Zod et sur la taille du bundle principal ; aucune erreur bloquante.
- `scripts/check-canvas.mjs` dans Edge sans interface : fiche de 20 zones, cinq réglures, zones hors écran, texte mathématique, image intégrée, contacts concurrents, fin de trait, annulation, mode tactile, cache d'encre, stabilisation zéro, deux allers-retours en impression, conservation exacte des données, application du fond à toutes les zones et bouton d'impression avec restauration du titre.
- PDF A4 de sept pages rendu avec Poppler : contrôle visuel des cinq réglures, des cercles, du contraste et du texte. Il s'agit d'une fiche technique de test.
- Aucun test sur une imprimante physique, aucune compilation ni installation d'un APK.

### Rejouer les contrôles navigateur

Le script utilise Playwright comme dépendance de test facultative. Il ne l'ajoute pas aux dépendances de l'application.

```powershell
npm install --no-save --package-lock=false playwright
npm run dev -- --host 127.0.0.1
```

Dans un deuxième terminal :

```powershell
node scripts/check-canvas.mjs
```

Le script sélectionne Edge sous Windows lorsqu'il est présent. Sinon, installer Chromium pour Playwright ou renseigner `BROWSER_EXECUTABLE`. Les variables facultatives `CANVAS_AUDIT_URL`, `CANVAS_AUDIT_OUTPUT` et `PLAYWRIGHT_MODULE` permettent de choisir le serveur, le dossier de sortie et un module Playwright déjà installé. Les essais utilisent un profil de navigateur temporaire et une fiche synthétique ; ils ne modifient pas les fiches du navigateur de l'utilisateur.

Références des événements web : [PointerEvent et événements coalescés](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents), [identifiant du pointeur](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerId), [préparation avant impression](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeprint_event).
