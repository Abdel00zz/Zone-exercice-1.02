# Bouton Imprimer et MathJax

25 octobre 2026.

Les messages « Tracking Prevention » venaient des ressources MathJax chargées depuis jsDelivr. Ils ne prouvaient pas à eux seuls un échec d'impression. Le code présentait cependant aussi des attentes sans limite sur les polices et images, et n'attendait pas la composition asynchrone des formules.

## Corrections

- Moteur MathJax 4.1.3 et police SVG standard New Computer Modern servis depuis la même origine que l'application, en développement, production et dans le build Capacitor.
- Composant combiné `tex-svg.js` ; suppression du chargement explicite redondant des extensions AMS et textmacros déjà incluses. Les extensions supplémentaires sont locales.
- Dépendances MathJax déclarées et versions figées. Les fichiers navigateur sont ajoutés au build par `build/mathjaxAssets.ts`, puis au manifeste hors connexion.
- Impression après initialisation et vidage de la file de composition MathJax.
- Délai de chargement borné par étape. Les polices web décoratives peuvent utiliser leur police de secours après 2,5 secondes ; une image bloquée déclenche une erreur après 8 secondes. L'état occupé et le titre du document sont restaurés, et un nouvel essai est possible.
- Message « Préparation de l'impression » pendant l'attente ; l'ancienne erreur est effacée lors d'un nouvel essai.

Les polices mathématiques spécialisées sélectionnées explicitement restent soumises à leurs ressources propres. La correction locale couvre le moteur et sa police standard ; elle ne remplace pas toutes les familles de polices proposées par l'application.

## Vérification

- `npm test` : 33 tests réussis.
- `npm run build` : TypeScript et construction de production réussis.
- `npm run test:print` : bouton réel dans Edge, domaines externes bloqués, formule nécessitant une extension MathJax, attente des SVG avant impression ; police dont la promesse ne se résout jamais ; image bloquée, erreur finie et nouvel essai réussi. Le dialogue est simulé dans ce test pour contrôler précisément le moment de son appel.
- `npm run test:offline` : nouveau profil, installation puis redémarrage sans réseau avec les ressources locales précachées.

Les contrôles ne portent pas sur une imprimante physique ni sur un nouvel APK installé. Après déploiement du build web, fermer les anciens onglets puis rouvrir l'application permet au nouveau service worker de s'activer.

Références : [héberger MathJax localement](https://docs.mathjax.org/en/latest/web/hosting.html), [composants combinés](https://docs.mathjax.org/en/v4.0/web/components/combined.html).

## Complément du 26 octobre : deuxième impression et en-tête

Le verrou `pending` ne se libérait qu'à la réception de `worksheet-finish-print`. Une intégration qui rend la main sans émettre `afterprint` laissait ce verrou actif : les clics suivants étaient ignorés. Le cas a été reproduit dans `test:print` avant correction.

Le retour de `window.print()` remet maintenant l'état à zéro lorsque le navigateur n'est plus en média d'impression. La fermeture est aussi suivie par le changement de média, le retour du focus après une perte de focus et l'événement natif Android. Les événements tardifs de fin sont ignorés pendant la préparation suivante ; une fermeture répétée reste sans effet. La protection contre les doubles clics est conservée pendant la préparation et un dialogue natif actif.

Le nettoyage différé d'un canvas vérifie qu'une nouvelle préparation n'a pas commencé avant de supprimer sa couche SVG. Cela évite de vider la deuxième exportation avec le nettoyage de la première.

L'en-tête contient uniquement le chapitre et la date en haut à droite. Classe, nom utilisateur, année scolaire, filets, losanges et ombres du titre ont été retirés de l'en-tête. Les métadonnées de classement restent enregistrées. Éditer le titre visible modifie le chapitre et conserve le nom propre de la fiche.

`test:print` vérifie plusieurs tentatives sans `afterprint`, le rejet des doubles appels, les retours par média/focus et la notification native simulée, un événement tardif pendant l'attente des polices, l'erreur d'image et la reprise, ainsi que l'édition du chapitre. `test:canvas` couvre deux préparations consécutives avant la frame de nettoyage. Ces simulations ne constituent pas un essai sur appareil Android physique.
