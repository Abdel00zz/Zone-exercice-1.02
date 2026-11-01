# Audit technique — modèle, imports, persistance et synchronisation

Date : 25 octobre 2026. Audit du code local, sans connexion à une base de production ni exposition de secrets.

## Défauts observés et corrections réalisées

| Priorité | Preuve avant modification | Conséquence | Correction |
| --- | --- | --- | --- |
| P1 | `hooks/useCloudSync.ts` fusionnait `questions[i]` et `subquestions[i]`. | Insérer ou réordonner une question attachait une réponse manuscrite à une autre question. | Fusion pure dans `domain/worksheetSync.ts`, par identité auteur si disponible, sinon signature de contenu unique dans la fratrie. Aucun appariement arbitraire par index. |
| P1 | `mergeCloudWorksheets` retournait seulement `remote.map(...)`. | Une réception pouvait supprimer les fiches exclusivement locales. | Les fiches locales absentes du snapshot distant restent dans la bibliothèque, avec leurs métadonnées. |
| P1 | Une suppression auteur, un changement de texte legacy ou deux questions identiques ne permettent pas toujours de retrouver la destination d'une annotation. | Risque de perte ou de mauvaise attribution des traits. | Copie locale de récupération du document précédent lorsqu'une annotation ne possède aucun destinataire sûr ; identité déterministe et déduplication lors des réceptions suivantes. |
| P1 | Le compteur de version restait partagé entre codes ; les `fetch` continuaient après changement de rôle/code. | Une nouvelle session pouvait sembler inchangée ou recevoir une ancienne réponse. | Invalidation immédiate, `AbortController`, contrôle de génération jusque dans la mise à jour fonctionnelle React, remise à zéro de version, déduplication des appels et envoi différé des modifications apparues pendant un envoi. |
| P1 | L'API push contrôlait seulement `Array.isArray` ; le client consommait directement `data.worksheets`. | Un payload invalide pouvait entrer dans le magasin de documents. | Validation Zod commune aux frontières réseau et API ; vérification des structures récursives, points, champs texte, préférences et identifiants de fiches/exercices dupliqués. |
| P1 | `normalizeWorksheetJson` ne normalisait pas les questions ; plusieurs voies d'import contournaient la validation visuelle. | `text` absent, styles legacy, hauteurs chaînes et traits invalides atteignaient le rendu. | Pipeline unique de validation et de normalisation récursive, utilisé par le Dashboard, l'éditeur et les fichiers importés. Une sauvegarde entière est validée avant le callback de restauration. |
| P1 | Le normaliseur conservait la clé legacy `exercise` et la préférait au tableau canonique `exercises`. | Réimporter une fiche modifiée pouvait rétablir un ancien exercice resté dans l'alias. | Priorité au tableau canonique et suppression des arbres racine redondants dans le résultat normalisé. |
| P1 | `flush()` effaçait le snapshot en attente avant que `localStorage.setItem` ait réussi. | Après dépassement de quota, aucun réessai du snapshot n'était possible sans nouvelle modification. | Snapshot conservé tant que l'écriture principale échoue ; réessai sur modification, retour du focus et événements de cycle de vie ; événement d'erreur exploitable par l'interface. |
| P1 | L'événement `storage` remplaçait l'état même lorsqu'un brouillon local attendait sa sauvegarde. | Un autre onglet pouvait effacer les derniers traits non sauvegardés. | Conservation de l'état local dirty et signalement de conflit. Ce garde-fou ne constitue pas un protocole de collaboration multi-onglets. |
| P2 | Taille réseau mesurée en caractères, cookie mal encodé non intercepté, format du jeton accepté avec suffixe superflu. | Taille Unicode sous-estimée ; exceptions évitables dans l'authentification. | Limite en octets UTF-8, `Cache-Control: no-store` sur pull, refus des versions invalides, parsing défensif des cookies et format complet du jeton vérifié. |

## Arbitrages discutés entre les ingénieurs

- **Monolithe modulaire léger.** Le domaine doit contenir des fonctions pures testables ; React orchestre l'interface ; les adaptateurs gèrent stockage, réseau et export. Déployer des microservices à ce stade ajouterait de la complexité sans résoudre les pertes de données locales.
- **Identités stables sans migration aveugle.** `QuestionPart.id` devient optionnel. Les IDs d'auteur importés sont conservés. Des UUID aléatoires ne sont pas inventés indépendamment sur chaque appareil pour les mêmes anciennes questions : ils ne permettraient pas de les reconnaître ensuite.
- **Annotations ambiguës conservées.** Lorsque l'identité manque, une copie de récupération visible dans la bibliothèque vaut mieux qu'une attribution au mauvais exercice ou la disparition des réponses. Les copies peuvent augmenter l'espace occupé ; leur suppression reste une décision explicite de l'utilisateur.
- **Pas de bascule immédiate vers IndexedDB.** Il faut d'abord définir une migration versionnée qui peut reprendre après interruption, conserver l'ancienne source jusqu'à vérification et rendre un export de secours possible. Le correctif actuel maintient le format de sauvegarde historique.

## Architecture cible et étapes encore nécessaires

1. Séparer le **document auteur** (`WorksheetDocument`, IDs stables), les **annotations de l'élève** (`NotebookAnnotations`, indexées par ID de zone) et l'**état d'interface**. Aujourd'hui les traits et la structure pédagogique partagent toujours le même objet.
2. Introduire un dépôt local transactionnel et versionné : IndexedDB pour documents et journaux, blobs pour images/encre volumineuse, état d'écriture consultable par l'interface, restauration après interruption. La sérialisation actuelle de la bibliothèque complète reste synchrone et coûteuse.
3. Remplacer le snapshot global cloud par des révisions par document, un contrôle de concurrence serveur, des tombstones de suppression et une politique de résolution explicite. Deux sources différentes peuvent encore écraser la même session côté serveur ; les verrous ajoutés concernent un seul hook/appareil.
4. Remplacer l'accès par mot de passe partagé et code à six caractères par des utilisateurs, propriétaires de canaux, rôles, autorisations par document et limites de requêtes. Le mécanisme actuel convient à une diffusion contrôlée, pas à un service public multi-tenant.
5. Ajouter tests réseau avec Redis réel ou isolé, tests de coupure/timeout, tests de reprise Android et mesure des quotas sur appareils réels. Les APIs ont été contrôlées statiquement ; aucun environnement de production n'a été contacté.

La lecture initiale de `localStorage` reste générique : un JSON syntaxiquement valide ne garantit pas à lui seul le modèle métier. Le choix d'une validation/migration au chargement doit préserver les snapshots anciens et rendre leur récupération possible. Les garde-fous ajoutés ne sont pas une garantie contre une fermeture brutale du processus avant toute écriture durable.

## Vérifications reproductibles

`node --test scripts/check-data-sync.mjs` : 14 tests passent. Ils couvrent réordonnancement et insertion, sous-questions avec IDs, effacement volontaire, ambiguïté legacy et récupération, suppression de sous-question/exercice, fiches privées, payload invalide, normalisation legacy sans mutation et réimport, restauration atomique, révocation de session, quota local et réessai, conflit entre onglets, cookie/jeton mal formé.

`npm run typecheck` : réussi après les modifications de cette tranche. Les tests de hook de persistance utilisent un environnement React/DOM simulé pour isoler les erreurs de quota ; ils ne remplacent pas une mesure sur Android ni un essai de stockage physique plein.
