import { WorksheetContent } from '../types';

export const initialJson: WorksheetContent = {
  "chapter": "Logique et Raisonnements",
  "exercises": [
    {
      "id": "ex1",
      "title": "Techniques de démonstration",
      "statement": "Dans cet exercice, nous allons utiliser différentes méthodes de raisonnement.\\pause Bonne chance !",
      "questions": [
        {
          "text": "\\onslide<1->Donner la négation des assertions suivantes :",
          "subquestions": [
            {
              "text": "\\onslide<2-> $(P): \\forall x \\in \\mathbb{R}, \\exists k \\in \\mathbb{Z} ; k \\le x < k+1$",
              "answerHeight": 100,
              "solution": "\\begin{block}{Solution (Négation de P)}\\overline{(P)} : \\exists x \\in \\mathbb{R}, \\forall k \\in \\mathbb{Z} ; (x < k \\text{ ou } x \\ge k+1)\\end{block}",
              "strokes": [
                {
                  "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
                  "color": "#1e3a8a",
                  "width": 3,
                  "isText": true,
                  "text": "Non(P) : ∃x ∈ ℝ, ∀k ∈ ℤ ; x < k ou x ≥ k+1",
                  "font": "Caveat",
                  "fontSize": 28
                }
              ]
            },
            {
              "text": "\\onslide<3-> $(Q): \\forall (\\alpha, \\beta) \\in \\mathbb{R}^2 ; (\\alpha - \\beta) > 1 \\implies \\exists n \\in \\mathbb{Z} ; \\alpha < n < \\beta$",
              "answerHeight": 100,
              "solution": "\\begin{block}{Solution (Négation de Q)}\\overline{(Q)} : \\exists (\\alpha, \\beta) \\in \\mathbb{R}^2 ; (\\alpha - \\beta) > 1 \\text{ et } (\\forall n \\in \\mathbb{Z} ; n \\le \\alpha \\text{ ou } n \\ge \\beta)\\end{block}",
              "strokes": [
                {
                  "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
                  "color": "#1e3a8a",
                  "width": 3,
                  "isText": true,
                  "text": "Non(Q) : ∃(α, β) ∈ ℝ², (α - β) > 1 ET ∀n ∈ ℤ, (n ≤ α ou n ≥ β)",
                  "font": "Caveat",
                  "fontSize": 28
                }
              ]
            }
          ]
        },
        {
          "text": "\\pause Montrer par la contraposée que : $\\forall n \\in \\mathbb{N}; \\frac{n^2}{3} \\in \\mathbb{N} \\implies \\frac{n}{3} \\in \\mathbb{N}$",
          "answerHeight": 180,
          "strokes": [
            {
              "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
              "color": "#1e3a8a",
              "width": 3,
              "isText": true,
              "text": "Supposons que n/3 ∉ ℕ. Alors n n'est pas un multiple de 3.\nDonc n = 3k + 1 ou n = 3k + 2 pour un certain k ∈ ℕ.\nSi n = 3k + 1, n² = 9k² + 6k + 1 = 3(3k² + 2k) + 1, donc n²/3 ∉ ℕ.\nSi n = 3k + 2, n² = 9k² + 12k + 4 = 3(3k² + 4k + 1) + 1, donc n²/3 ∉ ℕ.\nDans tous les cas, n²/3 ∉ ℕ. Par contraposée, l'assertion est vraie.",
              "font": "Caveat",
              "fontSize": 24
            }
          ]
        },
        {
          "text": "\\pause En déduire par l'absurde que : $\\sqrt{3} \\notin \\mathbb{Q}$",
          "answerHeight": 220,
          "strokes": [
            {
              "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
              "color": "#1e3a8a",
              "width": 3,
              "isText": true,
              "text": "Supposons que √3 ∈ ℚ. Alors √3 = p/q avec p, q ∈ ℕ*, premiers entre eux.\nEn élevant au carré : 3 = p²/q², d'où p² = 3q², donc p²/3 = q² ∈ ℕ.\nD'après la question précédente, si p²/3 ∈ ℕ, alors p/3 ∈ ℕ, donc p = 3k.\nOn a alors (3k)² = 3q², soit 9k² = 3q², donc q² = 3k².\nDonc q²/3 = k² ∈ ℕ. Toujours d'après la question précédente, q/3 ∈ ℕ.\nAinsi, 3 divise p et q, ce qui contredit le fait qu'ils soient premiers entre eux.\nL'hypothèse de départ est fausse, donc √3 ∉ ℚ.",
              "font": "Caveat",
              "fontSize": 24
            }
          ]
        },
        {
          "text": "\\pause Soit $q \\in \\mathbb{R} \\setminus \\{1\\}$. Montrer par récurrence que : $\\forall n \\in \\mathbb{N}^*; q + q^2 + \\dots + q^n = q \\times \\frac{q^n - 1}{q - 1}$",
          "answerHeight": 180,
          "strokes": [
            {
              "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
              "color": "#1e3a8a",
              "width": 3,
              "isText": true,
              "text": "Initialisation (n=1) : q¹ = q, et q × (q¹ - 1)/(q - 1) = q. Vrai.\nHérédité : Supposons la propriété vraie au rang n. \nAu rang n+1 : (q + ... + qⁿ) + qⁿ⁺¹ = q(qⁿ - 1)/(q - 1) + qⁿ⁺¹\n= [q(qⁿ - 1) + qⁿ⁺¹(q - 1)] / (q - 1)\n= [qⁿ⁺² - q] / (q - 1) = q(qⁿ⁺¹ - 1)/(q - 1).\nLa propriété est héréditaire, elle est donc vraie pour tout n ≥ 1.",
              "font": "Caveat",
              "fontSize": 24
            }
          ]
        }
      ]
    },
    {
      "id": "ex2",
      "title": "Raisonnements et assertions logiques",
      "statement": "",
      "questions": [
        {
          "text": "Montrer que : $\\forall n \\in \\mathbb{N}; 7 \\mid 21^n - 2^{3n}$",
          "answerHeight": 120,
          "strokes": [
            {
              "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
              "color": "#1e3a8a",
              "width": 3,
              "isText": true,
              "text": "21 ≡ 0 [7] et 2³ = 8 ≡ 1 [7].\nDonc 21ⁿ ≡ 0 [7] et 2³ⁿ = (2³)ⁿ ≡ 1ⁿ ≡ 1 [7].\nAinsi 21ⁿ - 2³ⁿ ≡ -1 [7]. L'énoncé semble incorrect (21ⁿ - 2³ⁿ n'est pas tjs divisible par 7).",
              "font": "Caveat",
              "fontSize": 24
            }
          ]
        },
        {
          "text": "Montrer que : $\\forall x \\in \\mathbb{R}_+^*; x \\ne 0 \\implies \\sqrt{x+1} \\le 1 + \\frac{x}{2}$",
          "answerHeight": 120,
          "strokes": [
            {
              "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
              "color": "#1e3a8a",
              "width": 3,
              "isText": true,
              "text": "Les deux termes sont positifs, comparons leurs carrés :\n(√(x+1))² = x + 1\n(1 + x/2)² = 1 + x + x²/4\nComme x²/4 ≥ 0, on a bien x + 1 ≤ 1 + x + x²/4.\nD'où l'inégalité demandée.",
              "font": "Caveat",
              "fontSize": 24
            }
          ]
        },
        {
          "text": "On considère les deux assertions : $P: \\forall x \\in \\mathbb{R}_+^*; x \\ge 2\\sqrt{x} - 1$ et $Q: \\forall y \\in \\mathbb{R}, \\exists x \\in \\mathbb{R}; xy \\ne x$",
          "subquestions": [
            {
              "text": "Donner la négation de $P$ et de $Q$",
              "strokes": [
                {
                  "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
                  "color": "#1e3a8a",
                  "width": 3,
                  "isText": true,
                  "text": "Non(P) : ∃x ∈ ℝ*₊ ; x < 2√x - 1\nNon(Q) : ∃y ∈ ℝ, ∀x ∈ ℝ ; xy = x",
                  "font": "Caveat",
                  "fontSize": 24
                }
              ]
            },
            {
              "text": "Montrer que $P$ est vraie et que $Q$ est fausse",
              "strokes": [
                {
                  "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
                  "color": "#1e3a8a",
                  "width": 3,
                  "isText": true,
                  "text": "P est vraie car x - 2√x + 1 = (√x - 1)² ≥ 0.\nQ est fausse car pour y = 1, on a ∀x ∈ ℝ, x(1) = x, donc xy = x.",
                  "font": "Caveat",
                  "fontSize": 24
                }
              ]
            },
            {
              "text": "Déterminer la valeur de vérité de : $R: (\\exists y \\in \\mathbb{R}, \\forall x \\in \\mathbb{R}; xy = x) \\implies (\\exists x \\in \\mathbb{R}_+^*; x < 2\\sqrt{x} - 1)$",
              "strokes": [
                {
                  "points": [{ "x": 20, "y": 20, "pressure": 0.5 }],
                  "color": "#1e3a8a",
                  "width": 3,
                  "isText": true,
                  "text": "R est de la forme Non(Q) => Non(P).\nNon(Q) est vraie (y=1) et Non(P) est fausse.\nVrai => Faux est FAUX. Donc R est fausse.",
                  "font": "Caveat",
                  "fontSize": 24
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};
