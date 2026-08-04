# Git Auto - commit et push assistes

Le mecanisme reprend le fonctionnement de Interactive Maths et l'adapte a ce projet.
Il diagnostique le depot, inspecte les changements, lance les controles qualite,
cree un message Conventional Commit, synchronise la branche courante et pousse
le commit sans changer automatiquement de branche.

## Demarrage rapide

```powershell
# Premiere configuration de la machine
.\setup_git.bat

# Diagnostic sans modification
.\git_doctor.bat

# Simulation complete
.\auto_commit.bat -DryRun

# Commit et push
.\auto_commit.bat

# Confirmation avant commit et push
.\auto_commit.bat -Interactive

# Commit limite a certains fichiers ou dossiers
.\auto_commit.bat -Paths components,hooks,App.tsx

# Message impose et build complet
.\auto_commit.bat -Message "feat(canvas): ameliore les aides" -WithBuild

# Commit local uniquement
.\auto_commit.bat -NoPush
```

## Options

| Option | Effet |
|---|---|
| `-Message "..."` | impose le message du commit |
| `-Type fix` | impose le type Conventional Commit |
| `-Scope canvas` | impose le scope |
| `-Paths a,b` | limite l'analyse et le staging aux chemins indiques |
| `-Doctor` | diagnostic uniquement |
| `-DryRun` | simule sans modifier Git |
| `-NoVerify` | ignore typecheck, lint et build |
| `-WithBuild` | ajoute `npm run build` |
| `-NoPush` | cree seulement le commit local |
| `-NoSync` | n'effectue pas fetch/rebase avant le push |
| `-Amend` | complete le dernier commit |
| `-Strict` | transforme les avertissements en blocages |
| `-Force` | ignore les blocages d'inspection |
| `-Interactive` | demande confirmation avant les actions sensibles |
| `-Json` | ajoute le rapport JSON a la sortie |
| `-Setup` | configure la machine sans creer de commit |
| `-InstallTools` | autorise l'installation via winget en mode Setup |
| `-GitName`, `-GitEmail` | configure l'identite Git |
| `-RemoteUrl` | ajoute `origin` s'il manque |

## Controles effectues

- Git, Node, npm et identite Git ;
- depot valide, branche detachee, conflits et operation Git en cours ;
- verrou `.git/index.lock` ;
- remote et branche amont ;
- fichiers sensibles, cles privees et jetons probables ;
- fichiers superieurs aux limites conseillees par GitHub ;
- marqueurs de conflit et traces de debogage ;
- `npm run typecheck --if-present` ;
- `npm run lint --if-present` ;
- `npm run build` avec `-WithBuild` ;
- divergence distante avant le push.

Les rapports sont ecrits dans `.git/gitauto/` et ne sont jamais versionnes.
Avant un rebase, une reference de sauvegarde est creee sous
`refs/gitauto/backup-AAAAmmjj-HHMMSS`.

## Codes de sortie

| Code | Signification |
|---:|---|
| 0 | succes |
| 1 | erreur inattendue |
| 2 | rien a faire |
| 3 | inspection bloquante |
| 4 | controle qualite en echec |
| 5 | synchronisation en echec |
| 6 | push en echec |
| 7 | environnement Git invalide |
