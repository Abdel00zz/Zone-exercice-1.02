# Zone Exercice

Application de fiches pédagogiques avec édition, écriture au stylet, sous-questions, présentation et impression A4. Le même document alimente les différentes vues.

## Développement

Node.js et npm sont nécessaires. Le client local fonctionne sans clé d’IA.

```powershell
npm ci
npm run dev
```

```powershell
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

La synchronisation serveur utilise les fonctions `api/` et requiert `APP_SECRET`, un mot de passe configuré côté serveur et les variables Upstash documentées dans ces fonctions. Ne jamais placer ces secrets dans une variable `VITE_` ou dans un bundle client. Vite ne lance pas les fonctions Edge de production.

## Architecture et revue technique

- [Architecture cible, arbitrages et état de migration](docs/ARCHITECTURE_CIBLE.md)
- [Questions, sous-questions, diaporama et pagination](docs/REVIEW_PRESENTATION.md)
- [Imports, stockage et synchronisation](docs/AUDIT_DONNEES_SYNC.md)
- [Plateforme, hors connexion et performances](docs/REVIEW_PLATFORM.md)
- [Premier audit des canvas et de l’impression](docs/AUDIT_CANVAS_IMPRESSION.md)
- [Réglages de la fiche et qualité vectorielle du PDF](docs/REGLAGES_ET_QUALITE_PDF.md)

`domain/` contient les modèles et transformations documentaires. `features/` orchestre les commandes, la navigation et l’impression. `platform/` et `build/` portent les intégrations navigateur et la construction hors connexion. `components/` reste l’adaptateur d’affichage ; la migration complète des fonctions historiques est progressive.

## Essais navigateur

Playwright est une dépendance de test facultative. Le script utilise Edge sous Windows lorsqu’il est disponible ; sinon installer Chromium pour Playwright ou renseigner `BROWSER_EXECUTABLE`.

```powershell
npm install --no-save --package-lock=false playwright
# Pendant que npm run dev est lancé :
npm run test:canvas
npm run test:presentation
npm run test:print
npm run test:settings
npm run test:vector-print
# Après build et pendant que preview est lancé :
npm run test:offline
```

Le contrôle de présentation nécessite aussi `pdfinfo` et `pdftotext`, ou `PDF_PYTHON` pointant vers un Python contenant `pypdf`. Les variables `PLAYWRIGHT_MODULE`, `CANVAS_AUDIT_URL`, `OFFLINE_AUDIT_URL`, `CANVAS_AUDIT_OUTPUT` et `PRESENTATION_AUDIT_OUTPUT` adaptent les outils et sorties. Les essais utilisent des profils temporaires et des fiches synthétiques.

## Android

Le projet Capacitor se trouve dans `android/`. Les sources de signature et les scripts existants doivent être inventoriés avant toute distribution. La validation web ne remplace pas une compilation Android et des essais sur appareil avec stylet et service d’impression.
