# Guide de Création des Fichiers JSON pour les Fiches d'Exercices

Ce guide a pour but de vous aider à formater correctement vos exercices dans un fichier JSON que l'application peut importer et afficher.

## 1. Vue d'ensemble de la Structure

Le fichier JSON doit contenir un objet principal avec deux clés obligatoires :

-   `"chapter"` (chaîne de caractères) : Le titre général de la fiche d'exercices, qui servira aussi de nom par défaut à la fiche.
-   `"exercises"` (tableau) : Une liste `[...]` de tous vos exercices.

**Exemple de base :**
```json
{
  "chapter": "Algèbre de base",
  "exercises": [
    {
      "id": "exo_algebre_1",
      "title": "Introduction à l'algèbre",
      "statement": "Résolvez les équations suivantes :",
      "questions": [
        { "text": "Quelle est la valeur de $x$ dans l'équation $x + 5 = 10$ ?" },
        { "text": "Simplifiez l'expression $2(a + b) + 3a$." }
      ]
    }
  ]
}
```

---

## 2. Détail de la Structure

Analysons chaque partie du JSON.

### L'Objet Exercice

Chaque exercice dans le tableau `exercises` est un objet `{...}` qui doit contenir les clés suivantes :

-   `"id"` (chaîne de caractères) : Un identifiant unique pour l'exercice. **Obligatoire**.
    -   *Conseil :* Utilisez un format simple comme `"exo_nom_du_sujet"`.
-   `"title"` (chaîne de caractères) : Le titre de l'exercice, qui s'affichera en grand. **Obligatoire**.
-   `"statement"` (chaîne de caractères) : L'énoncé général ou l'instruction de l'exercice. Peut être une chaîne vide `""` si non nécessaire. **Obligatoire**.
-   `"questions"` (tableau) : Une liste `[...]` contenant les questions de l'exercice. **Obligatoire**.

### L'Objet Question (`QuestionPart`)

Chaque élément du tableau `"questions"` est un objet qui structure une question. Il peut contenir :

-   `"text"` (chaîne de caractères) : Le texte de la question elle-même. **Obligatoire**.
-   `"subquestions"` (tableau, **optionnel**) : Si une question a des sous-questions (par exemple a, b, c...), vous pouvez les ajouter ici. Ce tableau contient lui-même d'autres objets `QuestionPart`, ce qui permet plusieurs niveaux d'imbrication.

**Exemple avec des questions imbriquées :**
```json
{
  "id": "exo_analyse_fonctions",
  "title": "Analyse de Fonctions",
  "statement": "Pour la fonction $f(x) = x^2 + 2x - 3$, veuillez répondre aux questions suivantes :",
  "questions": [
    { 
      "text": "Étudiez les variations de la fonction $f$.",
      "subquestions": [
        { "text": "Calculez la dérivée $f'(x)$." },
        { "text": "Dressez le tableau de variation de $f$." }
      ]
    },
    { "text": "Trouvez les racines de la fonction." }
  ]
}
```
Dans cet exemple, la première question ("Étudiez les variations...") est numérotée `1` et contient deux sous-questions (`a` et `b`). La deuxième question ("Trouvez les racines...") sera numérotée `2`.

---

## 3. Formules Mathématiques avec LaTeX

L'application utilise MathJax pour afficher les formules mathématiques, qui est compatible avec la syntaxe LaTeX.

-   **Formules en ligne :** Pour intégrer une formule dans une ligne de texte, entourez-la de dollars simples (`$`).
    -   Exemple : `"La formule est $E = mc^2$."`

-   **Formules en bloc :** Pour afficher une formule centrée sur sa propre ligne, entourez-la de dollars doubles (`$$`).
    -   Exemple : `"$$ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} $$"`

### **Point crucial : L'échappement des backslashs (`\\`)**

En JSON, le caractère `\` est un caractère spécial. Pour écrire un backslash littéral (comme ceux utilisés dans LaTeX), **vous devez le doubler**.

-   `\sqrt{2}` en LaTeX doit s'écrire `"\\sqrt{2}"` dans le JSON.
-   `\frac{a}{b}` en LaTeX doit s'écrire `"\\frac{a}{b}"` dans le JSON.
-   `\int_0^1 x^2 dx` en LaTeX doit s'écrire `"\\int_0^1 x^2 dx"` dans le JSON.

C'est l'erreur la plus courante. Pensez à toujours remplacer `\` par `\\` dans vos formules.

---

## 4. Guide Pratique : d'une Image/PDF au JSON

Voici une méthode pour convertir vos exercices.

**Étape 1 : Extraire le Texte**

C'est l'étape la plus manuelle.
-   **Pour les PDF textuels :** Vous pouvez simplement copier-coller le texte dans un éditeur de texte (comme VS Code, Sublime Text, ou même le Bloc-notes).
-   **Pour les PDF scannés ou les images :** Utilisez un outil de reconnaissance optique de caractères (OCR).
    -   **Solutions simples :** Google Keep ou Google Docs peuvent extraire le texte d'une image que vous importez.
    -   **Attention :** Les outils OCR peuvent faire des erreurs, surtout avec les formules mathématiques. Une relecture attentive est indispensable.

**Étape 2 : Structurer dans un Éditeur de Texte**

1.  Ouvrez un nouveau fichier et nommez-le avec l'extension `.json` (ex: `ma_fiche.json`).
2.  Commencez par la structure de base :
    ```json
    {
      "chapter": "Titre de votre fiche",
      "exercises": [
        
      ]
    }
    ```
3.  Pour chaque exercice que vous avez copié, créez un nouvel objet dans le tableau `exercises`.
4.  Remplissez les champs `"id"`, `"title"`, et `"statement"`.
5.  Pour chaque question, créez un objet `{"text": "..."}` dans le tableau `"questions"`.
6.  Identifiez les formules mathématiques, entourez-les de `$` ou `$$`, et **n'oubliez pas de doubler les backslashs (`\\`)**.
7.  Si une question a des sous-parties, ajoutez le tableau `"subquestions"` et répétez le processus.

**Étape 3 : Valider votre Fichier JSON**

Avant d'importer, il est crucial de vérifier que votre JSON n'a pas d'erreurs de syntaxe (une virgule manquante, une accolade en trop, etc.).
-   Copiez l'intégralité de votre fichier JSON.
-   Collez-le dans un validateur en ligne. Cherchez "JSON Validator" sur Google (par exemple, `jsonlint.com`).
-   Le validateur vous dira si le JSON est valide ou vous indiquera où se trouve l'erreur.

Une fois validé, votre fichier est prêt à être importé dans l'application !