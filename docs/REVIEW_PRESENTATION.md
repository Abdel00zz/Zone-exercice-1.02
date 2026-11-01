# Revue d’ingénierie — questions, pagination et présentation

Revue du 25 octobre 2026. Cette note couvre le moteur de questions et sa connexion aux vues continues, à la projection et à l’impression. Les autres audits couvrent notamment le stylet, les performances de dessin, la persistance et la synchronisation.

## Constats vérifiés dans le code initial

- `computeQuestionLayout` considérait comme diapositive uniquement un parent de niveau zéro possédant des sous-questions. Une question simple et une sous-question n’étaient donc jamais des diapositives.
- « Une question par page » plaçait ses sauts de page uniquement devant les questions principales.
- Un séparateur de diapositive portait simultanément un saut de page et `no-print` : il disparaissait précisément à l’impression.
- Un parent sans texte était assimilé à un simple conteneur, même avec une image, une réponse, un corrigé ou de l’encre. Son contenu pouvait ne pas être rendu.
- Un événement clavier d’une sous-question remontait à sa question parente et pouvait faire avancer deux parcours pédagogiques.
- Le calcul des étapes ne couvrait pas les listes `enumerate` et les listes avec des spécifications `\item<+->` individuelles. Certaines étapes affichables restaient inatteignables.
- Imprimer la vue conservait seulement les fragments réellement montés à l’étape courante. Une règle CSS ne peut pas rétablir du texte supprimé par React.

## Débat : pages de parents ou uniquement les feuilles ?

Une pagination limitée aux feuilles minimise le nombre de pages, mais supprime les introductions autonomes et ne définit pas où placer la réponse ou les annotations d’un parent. Elle ne satisfait pas non plus une règle générale où les questions et sous-questions sont toutes des unités de présentation.

La décision implémentée est un parcours en préordre de chaque nœud significatif, quelle que soit sa profondeur. Un parent avec son propre énoncé reçoit une page d’introduction. Chaque sous-question reçoit ensuite sa page. Les ancêtres sont rappelés comme contexte, avec leurs numéros et leurs figures, sans copier leur zone de réponse. Les conteneurs sans texte visible, image ou réponse propre restent de la structure et ne produisent aucune page vide.

Conséquence explicite : le nombre de pages logiques peut dépasser le nombre de feuilles. Dix parents avec un énoncé et vingt questions terminales donnent trente pages logiques. Un parent entièrement silencieux ne compte pas. Un exercice sans questions donne une page d’exercice. Ce choix rend la sémantique prévisible; une future option « feuilles uniquement » devra décider explicitement du devenir des contenus propres aux parents.

Une page d’introduction ne crée pas automatiquement de zone de réponse. Une feuille en a une lorsque les zones sont activées. Un parent conserve une zone s’il possède déjà une hauteur de réponse ou un contenu propre : réponse, corrigé, aide ou encre. La présence d’une couleur ou d’un style seul ne suffit pas, car « appliquer le fond à toutes les zones » écrit ces préférences sur l’ensemble de l’arbre.

## Architecture installée

`utils/questionLayout.ts` expose `buildQuestionPagePlan` et `buildWorksheetPagePlan`. Ces fonctions pures ne lisent ni le DOM, ni React, ni le stockage. Le résultat contient l’identité de page, le nœud source, son chemin de mutation, son niveau, son index et son contexte d’ancêtres. Le même plan alimente la navigation et la pagination imprimée.

Le chemin reste l’adresse de la commande de modification. L’identité de page préfère l’identifiant auteur lorsqu’il est unique dans l’exercice. Les doublons et les fiches anciennes sans identifiants utilisent un chemin pour garantir des pages distinctes. La numérotation conserve l’index source : une sous-question isolée sur sa page ne devient pas artificiellement « a. ».

`ExerciseCard` possède deux adaptations du document : l’arbre continu et les pages logiques indépendantes. Les pages restent montées pour conserver leurs réponses et permettre d’imprimer toutes les pages; la projection masque les pages inactives. Les rappels sont en lecture seule et affichent le contexte complet, y compris les fragments qui étaient progressifs sur la page du parent.

`QuestionBeamerScope` possède uniquement la progression locale. Il consomme une flèche ou un espace seulement si une étape supplémentaire existe dans la direction demandée. Aux limites, la navigation de présentation peut prendre le relais. Les cibles interactives et les touches avec modificateurs sont exclues. Les boutons précédent/suivant de la présentation et Page précédente/Page suivante naviguent directement entre les pages.

`BeamerPresentation` utilise le cycle d’impression partagé via `useSyncExternalStore`. Les pauses, overlays et éléments de listes s’affichent en entier pendant l’impression. Un corrigé fermé reste fermé. Un corrigé déjà ouvert imprime toutes ses étapes pédagogiques; l’opération ne change pas l’étape écran mémorisée.

## Vérification automatisée

Commande : `node --test scripts/question-layout.test.mjs`.

Les dix tests couvrent : préordre, profondeur arbitraire, chemins sources, numérotation et ancêtres; absence de mutation; conteneurs silencieux; identité stable lors d’une insertion et repli sûr en cas de doublons; conservation des contenus propres au parent; réglage global du fond sans création de réponses; distinction introduction/feuille; diapositives à tous niveaux; exercices sans questions; étapes Beamer explicites et listes progressives.

`npm run typecheck` passe après les modifications. Les vérifications navigateur et PDF sont effectuées au niveau du projet pour contrôler l’intégration avec la navigation et les styles d’impression.

## Limites et travail restant

- Une page logique est une unité de contenu, pas une garantie de tenir sur une seule feuille physique. Un très long énoncé, une grande figure ou une zone de réponse très haute peut continuer sur une autre feuille. Réduire arbitrairement le texte ou couper l’encre ne serait pas acceptable. Un moteur mesurant le contenu et signalant les débordements est une étape ultérieure.
- Les fiches anciennes sans identifiants stables gardent des identités basées sur leurs chemins. Insérer ou supprimer un nœud peut donc déplacer la sélection. L’assignation et la migration systématiques d’identifiants restent à prévoir.
- Le moteur d’overlay implémente un sous-ensemble de Beamer. La composition de listes imbriquées, les compteurs `+` dans toutes les commandes et la sémantique LaTeX complète de `\pause` ne sont pas garanties. Il faut un analyseur commun et un arbre de syntaxe avant de promettre une compatibilité générale.
- Imprimer tous les fragments d’overlays signifie imprimer les variantes `\only` ensemble. C’est le choix d’une fiche complète, pas une exportation d’une feuille distincte pour chaque étape d’une animation. Cette dernière serait une fonctionnalité différente.
- Les pages restent montées et les canvas conservent leur montage différé existant. Ce mécanisme évite la perte d’état mais ne constitue pas une virtualisation complète pour des milliers de questions. Un budget mémoire et des mesures sur tablette réelle restent nécessaires.
- L’impression d’un long corrigé ouvert dépend aussi de la géométrie de sa zone. Les tests de présentation doivent vérifier les contraintes de hauteur et les éventuels défilements ou débordements de cette couche.

Les références de cette revue sont les modules du dépôt, les tests cités et les vérifications de compilation; aucune comparaison de performances avec une autre application n’est déduite de ces changements.
