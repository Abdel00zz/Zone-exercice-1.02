# Guide robot - Transformer un PDF en JSON

Ce document définit le contrat de production pour un robot qui lit un PDF
d'exercices et génère un JSON fidèle au schéma décrit ici.

## 0. Règle absolue avant toute génération

Le robot ne doit jamais commencer à écrire le JSON dès l'extraction du texte.
Il doit d'abord terminer une phase d'analyse complète du PDF.

Avant de produire la première clé JSON, il doit obligatoirement :

1. rendre toutes les pages concernées en images lisibles ;
2. inspecter visuellement chaque image de page ;
3. comparer les images avec le texte extrait ou l'OCR ;
4. comprendre la structure globale du document ;
5. reconstruire la hiérarchie exacte des chapitres, exercices, questions et
   sous-questions ;
6. repérer les contenus qui continuent sur la page suivante ;
7. associer correctement chaque figure, tableau, remarque source et donnée à
   l'exercice concerné ;
8. séparer clairement les énoncés des corrigés éventuels ;
9. dresser une liste des ambiguïtés à résoudre avant la conversion.

Cette phase est une condition de démarrage. Si une formule, une valeur, une
figure ou un rattachement hiérarchique reste incertain, le robot doit suspendre
la finalisation du JSON et demander une vérification humaine.

### Fidélité maximale au contenu source

Le PDF est la source de vérité. Le robot doit conserver au maximum :

- le sens exact des consignes ;
- l'ordre des exercices et des questions ;
- la numérotation et les niveaux de sous-questions ;
- les hypothèses, domaines, intervalles, unités et notations ;
- les formules, exposants, indices, fractions et symboles ;
- les tableaux, figures et légendes utiles ;
- les dépendances entre une question et les précédentes.

Le robot peut corriger uniquement les artefacts certains d'extraction, comme un
mot coupé par un retour de ligne ou un espace doublé. Il ne doit pas reformuler
une consigne, simplifier une expression, corriger silencieusement une erreur
mathématique supposée ou modifier le niveau de difficulté.

### Remarques strictement hors du JSON

Le JSON final doit contenir uniquement la fiche fidèle et ses champs prévus.
Il ne doit jamais contenir :

- une remarque du robot ;
- une note OCR ;
- un avertissement du type `énoncé probablement incorrect` ;
- une justification de correction ;
- un commentaire sur une page illisible ;
- une clé inventée comme `warning`, `note_robot` ou `uncertainty`.

Toutes les observations doivent être placées dans un fichier séparé, par
exemple `rapport_conversion.md`. Ce rapport peut citer l'exercice, la question,
la page du PDF et la nature du doute, mais rien de ce rapport ne doit être copié
dans le JSON importable.

## 1. Objectif du robot

Le robot doit :

1. analyser toutes les pages utiles du PDF ;
2. reconstruire la hiérarchie chapitre, exercices, questions et sous-questions ;
3. convertir proprement les mathématiques en LaTeX compatible MathJax ;
4. conserver les figures indispensables ;
5. ajouter des aides progressives courtes et pédagogiques dans le JSON ;
6. ne jamais préremplir une réponse dans les champs de contenu ;
7. produire un JSON syntaxiquement valide et conforme au schéma ci-dessous.

Le robot ne doit pas inventer une valeur illisible. En cas de doute, il doit
signaler l'incertitude dans `rapport_conversion.md` et attendre sa résolution
avant de finaliser le JSON.

## 2. Pipeline recommandé pour le PDF

### 2.1 Inspection initiale

Avant l'extraction, relever :

- le nombre de pages ;
- les pages contenant réellement des exercices ;
- la présence d'une couche texte ou d'un scan ;
- la langue et le niveau scolaire ;
- les titres, numéros, tableaux, figures et encadrés ;
- les corrigés éventuels, qui ne doivent pas être mélangés aux questions.

La sortie de cette inspection est un plan hiérarchique temporaire, par exemple :

```text
Chapitre
├─ Exercice 1 - titre
│  ├─ Énoncé commun
│  ├─ Question 1
│  │  ├─ a
│  │  └─ b
│  └─ Question 2
└─ Exercice 2 - titre
```

Le robot valide ce plan contre les images des pages avant de le traduire en
objets `exercises`, `questions` et `subquestions`.

### 2.2 Double lecture obligatoire

Utiliser deux lectures complémentaires :

- extraction textuelle pour récupérer rapidement les paragraphes ;
- rendu visuel page par page pour contrôler l'ordre, les exposants, les
  fractions, les symboles et la position des figures.

Pour un PDF scanné, appliquer un OCR, puis comparer le résultat avec l'image de
la page. L'OCR seul n'est pas une preuve de fidélité.

### 2.3 Unité d'extraction

Traiter chaque exercice comme une unité indivisible :

- numéro et titre ;
- énoncé commun ;
- données ou figure communes ;
- questions numérotées ;
- sous-questions a, b, c ;
- remarques ou hypothèses associées.

Ne pas rattacher une ligne à l'exercice suivant uniquement parce qu'elle se
trouve en bas de page. Utiliser la mise en page et la continuité grammaticale.

### 2.4 Nettoyage du texte

- supprimer les en-têtes, pieds de page et numéros de page répétés ;
- réunir les mots coupés en fin de ligne ;
- conserver les accents et la ponctuation ;
- supprimer les doubles espaces ;
- ne pas ajouter de saut de ligne sans valeur pédagogique ;
- normaliser les guillemets et apostrophes ;
- conserver les unités et les conditions de domaine.

## 3. Structure JSON racine

```json
{
  "chapter": "Titre de la fiche",
  "version": "1.0",
  "settings": {},
  "exercises": []
}
```

| Champ | Type | Obligatoire | Rôle |
|---|---|---:|---|
| `chapter` | chaîne | oui | nom principal de la fiche |
| `version` | chaîne | non | version du contenu produit |
| `settings` | objet | non | comportement et apparence globale |
| `exercises` | tableau | oui | liste ordonnée des exercices |

Le JSON importé correspond directement au contenu de la fiche. Il ne faut pas
l'envelopper dans un objet `worksheet`, `data` ou `content`.

## 4. Paramètres globaux

```json
{
  "settings": {
    "showCanvas": true,
    "showSolutions": false,
    "presentationMode": true,
    "oneQuestionPerPage": false,
    "answerSpaceMinHeight": 240,
    "answerSpaceStyle": "grid",
    "answerSpaceColor": "white",
    "className": "Tronc commun scientifique",
    "schoolYear": "2026-2027"
  }
}
```

| Paramètre | Type | Valeurs | Recommandation |
|---|---|---|---|
| `showCanvas` | booléen | `true`, `false` | active ou désactive la zone de travail |
| `showSolutions` | booléen | `true`, `false` | toujours `false` pour un élève |
| `presentationMode` | booléen | `true`, `false` | `true` si des overlays Beamer sont utilisés |
| `oneQuestionPerPage` | booléen | `true`, `false` | isole chaque question dans la pagination |
| `answerSpaceMinHeight` | nombre | pixels | entre `180` et `360` selon le travail attendu |
| `answerSpaceStyle` | chaîne | `seyes`, `slate`, `grid`, `dotted`, `blank` | `grid` en mathématiques |
| `answerSpaceColor` | chaîne | `black`, `green`, `blue`, `white`, `cream` | `white` ou `cream` |
| `className` | chaîne | libre | niveau lu dans le PDF ou fourni par l'utilisateur |
| `schoolYear` | chaîne | libre | format conseillé `AAAA-AAAA` |
| `logoDataUrl` | chaîne | Data URL | seulement si un logo doit être intégré |

## 5. Objet exercice

```json
{
  "id": "z_division_01",
  "title": "Division euclidienne",
  "statement": "Dans $\\mathbb{Z}$, effectuer les calculs demandés.",
  "questions": []
}
```

| Champ | Type | Obligatoire | Rôle |
|---|---|---:|---|
| `id` | chaîne | oui | identifiant unique, stable et sans espace |
| `title` | chaîne | oui | titre court de l'exercice |
| `statement` | chaîne | oui | consigne ou données communes ; `""` si absent |
| `questions` | tableau | oui | questions dans l'ordre du PDF |
| `image` | objet | non | figure commune à l'exercice |
| `statementAnswerHeight` | nombre | non | hauteur de la zone associée à l'énoncé |
| `statementAnswerStyle` | chaîne | non | style local de cette zone |
| `statementAnswerColor` | chaîne | non | couleur locale de cette zone |
| `statementStrokes` | tableau | non | contenu graphique initial ; vide par défaut |

### Règles pour `id`

- uniquement lettres minuscules ASCII, chiffres et `_` ;
- commencer par le thème : `arith_pgcd_01` ;
- ne jamais réutiliser le même identifiant dans une fiche ;
- ne pas utiliser le numéro de page comme seul identifiant.

## 6. Objet question

```json
{
  "text": "Calculer $\\operatorname{PGCD}(252,105)$.",
  "answerHeight": 280,
  "guidance": {}
}
```

| Champ | Type | Obligatoire | Rôle |
|---|---|---:|---|
| `text` | chaîne | oui | question fidèle au PDF |
| `subquestions` | tableau | non | sous-questions récursives |
| `answerHeight` | nombre | non | hauteur locale en pixels |
| `answerStyle` | chaîne | non | `seyes`, `slate`, `grid`, `dotted`, `blank` |
| `answerColor` | chaîne | non | `black`, `green`, `blue`, `white`, `cream` |
| `image` | objet | non | figure propre à la question |
| `guidance` | objet | non | aide progressive affichée sur demande |
| `answer` | chaîne | non | réponse ; à omettre en mode aide |
| `solution` | chaîne | non | corrigé ; à omettre en mode aide |
| `strokes` | tableau | non | traits ou textes préremplis ; omettre normalement |

### Sous-questions

```json
{
  "text": "On considère $a=252$ et $b=105$.",
  "subquestions": [
    { "text": "Effectuer la première division euclidienne." },
    { "text": "Poursuivre jusqu'au reste nul." }
  ]
}
```

Chaque question possède son propre objet `guidance`. Le robot ne doit jamais
fusionner les aides de deux questions.

### Numéro chapeau : `1.  a.  b.`

Quand le PDF présente un numéro suivi immédiatement de sous-questions, sans
énoncé propre, laisser `text` vide. Le numéro est alors aligné sur la première
sous-question, comme à l'impression du sujet :

```json
{
  "text": "",
  "subquestions": [
    { "text": "Calculer $g(1)$ et $h(1)$." },
    { "text": "Résoudre dans $]0,+\\infty[$ l'équation $$g(x)=0.$$" }
  ]
}
```

rendu :

```
1.   a. Calculer g(1) et h(1).
     b. Résoudre dans ]0,+∞[ l'équation
                    g(x) = 0.
```

Si le numéro porte une donnée commune (« On désigne par $\varphi$ la restriction
de $f$ … »), renseigner `text` : la donnée occupe alors sa ligne et les
sous-questions s'indentent en dessous.

### Profondeur et numérotation

| Niveau | Étiquette |
|---:|---|
| 0 | `1.` `2.` `3.` |
| 1 | `a.` `b.` `c.` |
| 2 | `i.` `ii.` `iii.` |
| 3 | `α.` `β.` `γ.` |
| 4 et au-delà | `•` |

Rester à deux niveaux quand le PDF n'en demande pas davantage.

### Formule centrée à l'intérieur d'une question

Une question peut enchaîner texte, formule centrée puis reprise du texte. Placer
simplement la formule entre `$$ … $$` :

```json
{ "text": "Vérifier que $$\\lim_{x\\to0^+}f(x)=+\\infty,$$ puis interpréter géométriquement ce résultat." }
```

## 7. Aide progressive pédagogique

### Contrat recommandé

Pour une fiche destinée à l'élève, utiliser :

```json
{
  "guidance": {
    "recall": "\\textbf{Euclide} : remplacer $(a,b)$ par $(b,r)$.",
    "hints": [
      "\\textbf{Départ} : diviser le plus grand entier par le plus petit.",
      "\\textbf{Arrêt} : le dernier reste non nul est le PGCD."
    ]
  }
}
```

Cette structure définit trois niveaux d'aide ordonnés :

1. rappel de cours ;
2. première décision stratégique ;
3. contrôle ou étape suivante.

### Règles de rédaction de l'aide

Un indice est **direct, ciblé et clair**. Il dit quoi faire maintenant, sur quel
objet précis, en une seule opération exécutable.

**Direct**

- commencer par un verbe d'action à l'impératif : `Substitue`, `Isole`,
  `Dérive`, `Pose`, `Divise`, `Compare`, `Conclus` ;
- proscrire les formules d'attente : « essaie de », « pense à », « n'oublie pas
  que », « tu peux commencer par », « il faudrait » ;
- aucune question rhétorique adressée à l'élève.

**Ciblé**

- nommer l'objet exact : la fonction, l'intervalle, la variable, le théorème ;
- une seule opération par fragment, applicable immédiatement ;
- écrire l'expression concernée en LaTeX plutôt que de la décrire en mots.

**Clair**

- au plus douze mots hors formule ;
- un mot-clé en gras au début de chaque fragment avec `\\textbf{...}` ;
- le fragment tient sur une ligne, sans saut de ligne manuel ;
- ne pas inclure les labels `Consigne`, `Rappel` ou `Indice` dans les chaînes.

**Structure**

- `recall` cite la propriété utile, pas tout le chapitre ;
- premier indice : l'opération de départ ;
- second indice : la poursuite ou le contrôle ;
- chaque fragment est la suite logique du précédent ;
- deux indices par question par défaut, trois au maximum ;
- ne jamais donner le résultat numérique final ni recopier une solution.

| À éviter | À écrire |
|---|---|
| « Pense à utiliser la dérivée du quotient. » | `\\textbf{Applique} : dérive $\\dfrac{\\ln x}{x}$ avec $u=\\ln x$ et $v=x$.` |
| « Observe quelle courbe est située sous l'autre. » | `\\textbf{Sur $]0,1[$} : dis laquelle des deux courbes est en dessous à gauche de $x=1$.` |
| « Utilise le théorème des valeurs intermédiaires. » | `\\textbf{Pose} : introduis $F(x)=f(x)-x$ sur $\\left[\\dfrac{3}{2},2\\right]$.` |

Les champs techniques acceptés sont `instruction`, `recall`, `hints` et
`answer`. Pour le mode pédagogique demandé, le robot doit utiliser uniquement
`recall` et `hints`, et omettre `answer`.

### Test anti-réponse

Avant livraison, vérifier que :

- `guidance.answer` est absent ;
- `question.answer` est absent ;
- `question.solution` est absent ;
- aucun indice ne contient la valeur finale recherchée ;
- le tableau `strokes` est absent ou vide.

## 8. Mathématiques et échappement JSON

### Formule en ligne

```json
{ "text": "Calculer $x^2-5x+6$." }
```

### Formule centrée

```json
{ "text": "$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$" }
```

Dans une chaîne JSON, chaque antislash LaTeX doit être doublé :

| LaTeX voulu | JSON à écrire |
|---|---|
| `\frac{a}{b}` | `"\\frac{a}{b}"` |
| `\sqrt{x}` | `"\\sqrt{x}"` |
| `\mathbb{Z}` | `"\\mathbb{Z}"` |
| `\operatorname{PGCD}` | `"\\operatorname{PGCD}"` |
| `\textbf{Mot}` | `"\\textbf{Mot}"` |

Commandes mathématiques courantes :

- ensembles : `\\mathbb{N}`, `\\mathbb{Z}`, `\\mathbb{Q}`, `\\mathbb{R}` ;
- relations : `\\le`, `\\ge`, `\\ne`, `\\in`, `\\mid`, `\\equiv` ;
- calcul : `\\frac{}{} `, `\\sqrt{}`, `\\times`, `\\sum`, `\\prod` ;
- logique : `\\forall`, `\\exists`, `\\implies`, `\\iff` ;
- congruences : `a\\equiv b\\pmod n`.

Ne pas laisser une formule sous la forme brute `\phantom`, `\fillblank` ou
autre commande technique visible dans le texte final.

## 9. Commandes d'affichage progressif de type Beamer

Les commandes suivantes peuvent être insérées dans `text`, `statement`,
`recall` et `hints`.

### `\\pause`

Tout ce qui suit apparaît au clic suivant.

```json
{ "text": "Première observation.\\pause Deuxième observation." }
```

### Liste automatique `[<+->]`

```json
{
  "statement": "\\begin{itemize}[<+->]\\item Lire les données.\\item Choisir la propriété.\\item Vérifier.\\end{itemize}"
}
```

Chaque `\\item` apparaît à l'étape suivante.

### Commandes avec spécification

| Commande | Effet |
|---|---|
| `\\onslide<2->{...}` | affiche à partir de l'étape 2 |
| `\\only<3>{...}` | existe uniquement à l'étape 3 |
| `\\uncover<2->{...}` | révèle en conservant l'espace |
| `\\visible<2-4>{...}` | visible des étapes 2 à 4 |
| `\\invisible<2>{...}` | masqué à l'étape 2 |
| `\\alert<2>{...}` | met en valeur à l'étape 2 |

Spécifications acceptées :

- `<2>` : seulement l'étape 2 ;
- `<2->` : à partir de l'étape 2 ;
- `<-3>` : jusqu'à l'étape 3 ;
- `<2-4>` : de 2 à 4 ;
- `<2,4>` : aux étapes 2 et 4 ;
- `\\item<2->` : spécification propre à un item.

Utiliser les overlays pour fractionner une explication, jamais pour dissimuler
une réponse déjà enregistrée dans un autre champ JSON.

## 10. Blanc stratégique `\\fillblank`

La commande existe pour les activités à trous :

```json
{ "text": "$a=b\\times\\fillblank{q}+\\fillblank{r}$" }
```

Elle masque la valeur en mode élève et la révèle en mode édition.

Règle robot : ne pas l'utiliser automatiquement. L'utiliser uniquement si
l'utilisateur demande explicitement un exercice à trous. Une aide de cours ne
doit pas être transformée en réponse masquée.

## 11. Images et figures extraites du PDF

```json
{
  "image": {
    "id": "fig_exo_02",
    "src": "data:image/png;base64,...",
    "width": 420,
    "placement": "center",
    "caption": "Figure 1"
  }
}
```

| Champ | Type | Rôle |
|---|---|---|
| `id` | chaîne | identifiant unique |
| `src` | chaîne | Data URL Base64 ou URL accessible |
| `width` | nombre | largeur souhaitée |
| `height` | nombre | hauteur souhaitée |
| `placement` | chaîne | `left`, `center`, `right` |
| `caption` | chaîne | légende utile |

Recadrer la figure sans inclure le texte voisin. Conserver les axes, unités,
flèches, points nommés et légendes. Ne pas convertir un schéma important en
description textuelle si la géométrie visuelle est nécessaire à la question.

### Ancre `\\figure` : figure au milieu de l'énoncé

Par défaut, l'illustration est placée sous tout le texte de la question. Quand le
PDF intercale la figure entre deux phrases, insérer l'ancre `\\figure` à
l'endroit exact :

```json
{
  "text": "Les courbes $(C_g)$ et $(C_h)$ ci-dessous représentent $g$ et $h$ dans un même repère orthonormé.\\figure Justifier graphiquement que $$\\forall x\\in]0,1[,\\qquad h(x)-g(x)<0.$$",
  "image": { "id": "fig_courbes", "src": "/assets/courbes.svg", "width": 520, "placement": "center" }
}
```

`\\image` et `\\includegraphics{...}` sont acceptés comme synonymes. Sans ancre,
le comportement historique est conservé. L'ancre est ignorée si la question ne
porte pas d'objet `image`.

## 12. Champ JSON `strokes`

Par défaut, une question ne contient aucun champ `strokes`. Le JSON ne contient
donc aucun texte, trait ou réponse prérempli.

Le champ `strokes` n'est autorisé que pour un gabarit explicitement demandé.
Exemple de texte éditable :

```json
{
  "strokes": [
    {
      "points": [{ "x": 28, "y": 66, "pressure": 0.5 }],
      "color": "#1e3a8a",
      "width": 3,
      "isText": true,
      "text": "Structure à compléter",
      "font": "Caveat",
      "fontSize": 25
    }
  ]
}
```

Types de formes disponibles dans un stroke :

`freeform`, `line`, `arrow`, `double-arrow`, `angle`, `axes`, `rectangle`,
`circle`, `triangle`, `right-triangle`, `diamond`, `parallelogram`, `pentagon`,
`hexagon`.

## 13. Heuristiques de conversion pédagogique

### Hauteur de la zone de réponse

- réponse numérique courte : `180` à `220` px ;
- calcul en plusieurs lignes : `240` à `300` px ;
- démonstration : `300` à `380` px ;
- construction géométrique : au moins `360` px.

### Découpage des questions

- conserver une question simple dans un seul objet ;
- créer `subquestions` lorsque le PDF utilise a, b, c ;
- ne pas transformer artificiellement chaque phrase en sous-question ;
- conserver une donnée commune dans `statement` ou dans la question parente.

### Aide ciblée

Pour chaque question, identifier :

1. la notion minimale nécessaire ;
2. le premier choix stratégique ;
3. le test de contrôle.

Exemple :

```json
{
  "text": "Résoudre $3x\\equiv4\\pmod7$.",
  "answerHeight": 250,
  "guidance": {
    "recall": "\\textbf{Inverse} : un nombre premier avec $7$ est inversible modulo $7$.",
    "hints": [
      "\\textbf{Recherche} : trouve l'inverse de $3$ modulo $7$.",
      "\\textbf{Isolement} : multiplie les deux membres par cet inverse."
    ]
  }
}
```

## 14. Exemple complet recommandé

```json
{
  "chapter": "Arithmétique dans ℤ",
  "version": "1.0",
  "settings": {
    "showCanvas": true,
    "showSolutions": false,
    "presentationMode": true,
    "oneQuestionPerPage": false,
    "answerSpaceMinHeight": 240,
    "answerSpaceStyle": "grid",
    "answerSpaceColor": "white",
    "className": "Tronc commun scientifique",
    "schoolYear": "2026-2027"
  },
  "exercises": [
    {
      "id": "arith_division_01",
      "title": "Division euclidienne",
      "statement": "Dans $\\mathbb{Z}$, utiliser $a=bq+r$ avec $0\\le r<|b|$.",
      "questions": [
        {
          "text": "Effectuer la division euclidienne de $437$ par $12$.",
          "answerHeight": 260,
          "guidance": {
            "recall": "\\textbf{Division euclidienne} : chercher $a=bq+r$.",
            "hints": [
              "\\textbf{Multiple} : repère un multiple de $12$ proche de $437$.",
              "\\textbf{Reste} : soustrais puis contrôle $0\\le r<12$."
            ]
          }
        }
      ]
    }
  ]
}
```

## 15. Validation automatique

Le robot doit exécuter ces contrôles avant livraison.

### Syntaxe

- le document est analysable par un parseur JSON ;
- aucune virgule finale ;
- guillemets doubles autour des clés et chaînes ;
- antislashs LaTeX doublés ;
- aucun commentaire dans le JSON final.

### Schéma

- `chapter` est une chaîne non vide ;
- `exercises` est un tableau non vide ;
- chaque exercice possède `id`, `title`, `statement`, `questions` ;
- tous les `id` sont uniques ;
- chaque question possède `text`, éventuellement vide pour un numéro chapeau ;
- une question à `text` vide possède obligatoirement des `subquestions` ;
- profondeur limitée à ce que le PDF impose, deux niveaux dans le cas courant ;
- une ancre `\\figure` n'apparaît que dans une question munie d'un objet `image` ;
- chaque `hints` est un tableau de chaînes ;
- les styles et couleurs appartiennent aux listes autorisées.

### Fidélité au PDF

- nombre d'exercices conforme ;
- ordre conforme ;
- numéros et sous-numéros conformes ;
- formules comparées visuellement ;
- figures présentes et lisibles ;
- aucune hypothèse ou unité perdue.

### Pédagogie et confidentialité de la réponse

- deux indices par question quand ils sont utiles, trois au maximum ;
- chaque indice commence par un verbe d'action à l'impératif ;
- aucun indice ne contient « essaie de », « pense à », « n'oublie pas » ;
- chaque indice nomme l'objet visé et une seule opération ;
- mots-clés en gras ;
- fragments courts et affichables sur une même ligne ;
- aucune réponse finale dans `guidance`, `answer`, `solution` ou `strokes` ;
- aucune aide affichée avant le clic sur **Aide** ;
- progression indépendante pour chaque question.

### Validation des chaînes

- chaque formule possède ses délimiteurs `$...$` ou `$$...$$` ;
- les accolades LaTeX sont équilibrées ;
- aucune commande technique brute ne subsiste hors d'une formule ;
- chaque `guidance` contient un `recall` et, par défaut, deux `hints` ;
- les fragments d'aide restent autonomes, concis et sans réponse finale.

## 16. Rapport que le robot doit fournir

En plus du JSON, produire un court rapport avec :

- fichier PDF source ;
- pages traitées et pages ignorées ;
- nombre d'exercices et de questions ;
- figures extraites ;
- passages OCR incertains ;
- corrections typographiques effectuées ;
- statut de validation JSON ;
- statut de la validation du schéma et des chaînes LaTeX.

Le rapport ne doit pas être inséré dans le JSON importable.
