[CmdletBinding()]
param(
    [Parameter(Position = 0)] [string]$Message,
    [string]$Branch,
    [Alias('Paths')] [string[]]$Path,
    [switch]$Yes,
    [switch]$DryRun,
    [switch]$NoSync,
    [switch]$NoPush,
    [switch]$SkipChecks,
    [switch]$FullCheck,
    [switch]$IncludeSensitive,
    [switch]$Doctor,
    [switch]$Recover,
    [switch]$Pause,
    [switch]$Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- Anti-blocage ---------------------------------------------------------
# Git ne doit jamais attendre une saisie interactive (identifiants, mot de
# passe, PIN) : en leur absence, la commande echoue rapidement au lieu de
# geler la fenetre.
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'

# Sujet du commit temporaire cree pendant une synchronisation. Il sert de
# marqueur : le script ne defait que les commits qu'il a lui-meme poses.
$script:WipSubject = 'chore(auto): sauvegarde temporaire avant synchronisation'
$script:StartedAt = Get-Date
$script:PushAttempts = 3

$Path = @($Path | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

$script:LockPath = $null
$script:LockStream = $null
$script:OwnsLock = $false

function Write-Step([string]$Text) { Write-Host "`n> $Text" -ForegroundColor Cyan }
function Write-Info([string]$Text) { Write-Host "[INFO] $Text" -ForegroundColor DarkGray }
function Write-Warn([string]$Text) { Write-Host "[ATTENTION] $Text" -ForegroundColor Yellow }

function Run-Git {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position = 0)]
        [string[]]$Arguments,
        [switch]$AllowFailure,
        [switch]$Silent
    )
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& git @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }
    # En mode silencieux, on n'affiche la sortie qu'en cas d'echec (diagnostic).
    if (-not $Silent -or $exitCode -ne 0) {
        $output | ForEach-Object { Write-Host $_ }
    }
    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "La commande Git a echoue : git $($Arguments -join ' ')"
    }
}

function Get-GitText {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory, Position = 0)]
        [string[]]$Arguments,
        [switch]$AllowFailure
    )
    $previousErrorPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $raw = @(& git @Arguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }
    # stderr (avertissements de normalisation CRLF, progression) ne doit jamais
    # etre pris pour des donnees : sinon un simple avertissement devient un
    # fichier a commiter ou un commit distant fantome.
    $data = @($raw | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] })
    if (-not $AllowFailure -and $exitCode -ne 0) {
        $detail = (@($raw | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.ToString() }) -join "`n")
        if ([string]::IsNullOrWhiteSpace($detail)) {
            $detail = (@($data | ForEach-Object { $_.ToString() }) -join "`n")
        }
        throw "La commande Git a echoue : git $($Arguments -join ' ')`n$detail"
    }
    return @($data | ForEach-Object { $_.ToString() })
}

function Test-Git {
    [CmdletBinding()]
    param([Parameter(Mandatory, Position = 0)][string[]]$Arguments)
    & git @Arguments *> $null
    return $LASTEXITCODE -eq 0
}

function Confirm([string]$Prompt) {
    if ($Yes) { return $true }
    try { return (Read-Host "$Prompt [o/N]") -match '^(o|oui|y|yes)$' }
    catch { return $false }
}

function Get-Status {
    return @(Get-GitText -Arguments @('status', '--porcelain=v1', '--untracked-files=all'))
}

function Get-Branch {
    $name = [string](@(Get-GitText -Arguments @('branch', '--show-current')) | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($name)) { throw 'HEAD est detache. Basculez sur une branche avant de publier.' }
    return $name.Trim()
}

function Has-RemoteBranch([string]$Target) {
    return Test-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/remotes/origin/$Target")
}

function Get-Divergence([string]$Target) {
    $countLine = [string](@(Get-GitText -Arguments @('rev-list', '--left-right', '--count', "$Target...origin/$Target")) | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($countLine)) { return [PSCustomObject]@{ Ahead = 0; Behind = 0 } }
    $counts = $countLine.Trim() -split '\s+'
    return [PSCustomObject]@{ Ahead = [int]$counts[0]; Behind = [int]$counts[1] }
}

function Get-GitDir {
    $gitDir = (Get-GitText -Arguments @('rev-parse', '--git-dir') | Select-Object -First 1).Trim()
    if (-not [System.IO.Path]::IsPathRooted($gitDir)) {
        $gitDir = Join-Path (Get-Location).Path $gitDir
    }
    return [System.IO.Path]::GetFullPath($gitDir)
}

function Acquire-Lock {
    if ($DryRun) { return }
    $script:LockPath = Join-Path (Get-GitDir) 'auto-commit.lock'

    # Verrou laisse par une session interrompue : on le nettoie si personne ne
    # le tient. On sonde le fichier en ouverture exclusive : si elle reussit,
    # aucune autre instance ne le tient, donc on peut le supprimer sans risque.
    if (Test-Path -LiteralPath $script:LockPath) {
        $probe = $null
        try {
            $probe = [System.IO.File]::Open($script:LockPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        } catch [System.IO.IOException] {
            throw "Une autre publication est deja en cours (verrou $($script:LockPath)). Attendez sa fin, ou supprimez ce fichier si aucune fenetre n'est ouverte."
        }
        if ($probe) {
            $probe.Dispose()
            Remove-Item -LiteralPath $script:LockPath -Force -ErrorAction Stop
        }
    }

    # Le verrou = poignee exclusive gardee ouverte jusqu'a la fin. Si le processus
    # est tue, Windows libere la poignee et le fichier devient recuperable.
    try {
        $script:LockStream = [System.IO.File]::Open($script:LockPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $meta = "pid=$PID`nhost=$env:COMPUTERNAME`nstarted=$(Get-Date -Format 'o')`n"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($meta)
        $script:LockStream.Write($bytes, 0, $bytes.Length)
        $script:LockStream.Flush($true)
        $script:OwnsLock = $true
    } catch [System.IO.IOException] {
        if ($script:LockStream) { $script:LockStream.Dispose(); $script:LockStream = $null }
        throw "Impossible de creer le verrou $($script:LockPath). Une autre publication vient probablement de demarrer."
    }
}

function Release-Lock {
    if ($script:LockStream) {
        try { $script:LockStream.Dispose() } catch {}
        $script:LockStream = $null
    }
    if ($script:OwnsLock -and $script:LockPath -and (Test-Path -LiteralPath $script:LockPath)) {
        Remove-Item -LiteralPath $script:LockPath -Force -ErrorAction SilentlyContinue
    }
    $script:OwnsLock = $false
}

function Test-PendingOperation {
    $gitDir = Get-GitDir
    foreach ($entry in @('rebase-merge', 'rebase-apply')) {
        if (Test-Path -LiteralPath (Join-Path $gitDir $entry)) { return 'rebase' }
    }
    if (Test-Path -LiteralPath (Join-Path $gitDir 'MERGE_HEAD')) { return 'merge' }
    if (Test-Path -LiteralPath (Join-Path $gitDir 'CHERRY_PICK_HEAD')) { return 'cherry-pick' }
    if (Test-Path -LiteralPath (Join-Path $gitDir 'REVERT_HEAD')) { return 'revert' }
    return $null
}

function Get-UnmergedPaths {
    return @(Get-GitText -Arguments @('diff', '--name-only', '--diff-filter=U'))
}

# Un marqueur de conflit oublie dans un fichier casse la compilation et peut
# partir en production : on le refuse avant l'indexation. Seuls les marqueurs
# de fusion sont cherches (les soulignes Markdown ne sont pas concernes).
function Get-ConflictMarkers([string[]]$Files) {
    $found = @()
    foreach ($file in @($Files)) {
        if ([string]::IsNullOrWhiteSpace($file)) { continue }
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
        $hits = Select-String -LiteralPath $file -Pattern '^(<{7}|>{7})' -ErrorAction SilentlyContinue
        if ($hits) { $found += $file }
    }
    return $found
}

function Assert-ReadyToCommit {
    $pending = Test-PendingOperation
    if ($pending) {
        throw "Une operation $pending est en cours dans le depot. Terminez-la, ou lancez .\auto_commitv2.ps1 -Recover pour voir les options."
    }
    $unmerged = @(Get-UnmergedPaths)
    if ($unmerged.Count -gt 0) {
        throw "Fichiers non fusionnes :`n  $($unmerged -join "`n  ")`nResolvez-les puis relancez (ou .\auto_commitv2.ps1 -Recover)."
    }
    $markers = @(Get-ConflictMarkers (Get-ChangedPaths))
    if ($markers.Count -gt 0) {
        throw "Marqueurs de conflit detectes :`n  $($markers -join "`n  ")`nCorrigez ces fichiers avant de publier."
    }
}

# Message de commit deduit des fichiers reels : plus lisible que « Mise a jour
# automatique », sans inventer d'intention fonctionnelle.
function Get-AutoMessage {
    $files = @(Get-ChangedPaths)
    if ($files.Count -eq 0) { return 'chore(auto): mise a jour' }
    $areas = @($files | ForEach-Object {
        $parts = ($_ -replace '\\', '/') -split '/'
        if ($parts.Count -gt 1) { $parts[0] } else { 'racine' }
    } | Sort-Object -Unique)
    $prefix = if ($areas.Count -eq 1 -and $areas[0] -eq 'docs') { 'docs' }
        elseif ($areas.Count -eq 1 -and $areas[0] -eq 'public') { 'chore(assets)' }
        elseif ($areas.Count -eq 1 -and $areas[0] -eq 'package.json') { 'chore(deps)' }
        else { 'chore(auto)' }
    $headline = "{0} : {1} fichier(s) - {2}" -f $prefix, $files.Count, ($areas -join ', ')
    $listed = @($files | Select-Object -First 12 | ForEach-Object { ' - ' + ($_ -replace '\\', '/') })
    $body = $listed -join "`n"
    if ($files.Count -gt $listed.Count) {
        $body += "`n - ... et $($files.Count - $listed.Count) autre(s)"
    }
    return "$headline`n`n$body"
}

function Save-Changes {
    if (@(Get-Status).Count -eq 0) { return $false }
    Write-Step 'Sauvegarde temporaire des changements locaux'
    Write-Info 'Commit local temporaire (jamais pousse) : il remplace le stash, qui laissait des marqueurs de conflit dans les fichiers.'
    Run-Git -Silent -Arguments @('add', '--all')
    Run-Git -Silent -Arguments @('commit', '--no-verify', '-m', $script:WipSubject)
    return $true
}

function Restore-Changes([bool]$Saved) {
    if (-not $Saved) { return }
    $subject = ((Get-GitText -Arguments @('log', '-1', '--pretty=%s') | Select-Object -First 1)).Trim()
    if ($subject -ne $script:WipSubject) { return }
    Write-Step 'Restauration des changements locaux'
    Run-Git -Silent -Arguments @('reset', '--soft', 'HEAD^')
}

function Sync-Remote([string]$Target) {
    if ($NoSync -or -not (Has-RemoteBranch $Target)) { return }
    if ((Get-Divergence $Target).Behind -eq 0) { return }

    $saved = Save-Changes
    # L'ecart est recalcule apres la sauvegarde : le commit temporaire place la
    # branche en avance, donc un fast-forward serait refuse par Git.
    $divergence = Get-Divergence $Target
    try {
        Write-Step "Integration de $($divergence.Behind) commit(s) arrive(s) depuis un autre appareil"
        if ($divergence.Ahead -gt 0) { Run-Git -Arguments @('rebase', "origin/$Target") }
        else { Run-Git -Arguments @('merge', '--ff-only', "origin/$Target") }
    } catch {
        # Le rebase est abandonne : le depot revient exactement a l'etat d'avant
        # la synchronisation, changements locaux compris. Aucun stash orphelin.
        Run-Git -AllowFailure -Silent -Arguments @('rebase', '--abort')
        Run-Git -AllowFailure -Silent -Arguments @('merge', '--abort')
        Restore-Changes $saved
        throw "Conflit pendant la mise a jour distante : rien n'a ete pousse et vos changements locaux sont intacts. Reprenez la fusion a la main, puis relancez."
    }
    Restore-Changes $saved
}

function Get-ChangedPaths {
    $paths = @(
        Get-GitText -Arguments @('diff', '--name-only')
        Get-GitText -Arguments @('diff', '--cached', '--name-only')
        Get-GitText -Arguments @('ls-files', '--others', '--exclude-standard')
    )
    return @($paths | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
}

function Assert-SafePaths([string[]]$Files) {
    $blocked = foreach ($file in $Files) {
        $normalized = $file -replace '\\', '/'
        $name = [System.IO.Path]::GetFileName($normalized)
        $isExample = $name -match '^\.env\.(example|sample|template)$'
        if (
            $name -eq '.env' -or
            (($name -match '^\.env\.') -and -not $isExample) -or
            ($name -match '(?i)\.(pem|key|p12|pfx)$') -or
            ($normalized -match '(?i)(^|/)(id_rsa|id_dsa|id_ecdsa|id_ed25519|secrets?|credentials?|tokens?)(/|$|\.)')
        ) { $file }
    }
    if ($blocked -and -not $IncludeSensitive) {
        throw "Fichiers potentiellement sensibles bloques :`n  $($blocked -join "`n  ")`nUtilisez -IncludeSensitive seulement apres verification explicite."
    }
}

function Run-Checks {
    if ($SkipChecks -or -not (Test-Path -LiteralPath 'package.json')) { return }
    # Le type-check n'a d'interet que si du TypeScript a change : on l'evite
    # sinon (commits de .md, .bat, .ps1, images... -> instantanes).
    $tsChanged = @(Get-ChangedPaths | Where-Object { $_ -match '\.(ts|tsx)$' })
    if (-not $tsChanged -and -not $FullCheck) {
        Write-Info 'Aucun fichier TypeScript modifie : verification TypeScript ignoree.'
        return
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Info 'npm absent : verifications ignorees.'
        return
    }
    try { $package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json }
    catch { Write-Info 'package.json illisible : verifications ignorees.'; return }

    $available = @($package.scripts.PSObject.Properties.Name)
    $targets = if ($FullCheck) { @('check') } else { @('lint') }
    foreach ($target in $targets) {
        if ($available -notcontains $target) {
            Write-Info "Script npm absent : $target (verification ignoree)."
            continue
        }
        Write-Step "Verification du depot (npm run $target)"
        if ($target -eq 'check') { Write-Info 'Chaine complete : donnees, types, architecture, code mort, build.' }
        else { Write-Info 'Cela peut prendre quelques secondes sur un gros projet.' }
        & npm run $target
        if ($LASTEXITCODE -ne 0) { throw "La verification npm run $target a echoue. Le commit est annule." }
    }
}

function Commit-Work([string]$CommitMessage) {
    $status = @(Get-Status)
    if ($status.Count -eq 0) { return $false }
    $files = if (@($Path).Count -gt 0) { @($Path) } else { @(Get-ChangedPaths) }
    Assert-SafePaths $files
    Assert-ReadyToCommit
    $question = if ($NoPush) { "Creer le commit sur $Branch (sans publication)" } else { "Creer le commit et publier $Branch" }
    if (-not (Confirm $question)) {
        Write-Info 'Operation annulee. Aucun fichier n a ete indexe.'
        return $false
    }
    Write-Step 'Indexation et creation du commit'
    if (@($Path).Count -gt 0) { Run-Git -Arguments (@('add', '--') + $Path) }
    else { Run-Git -Arguments @('add', '--all') }
    # Refuse les espaces fautifs, les marqueurs de conflit et les binaires ajoutes par erreur.
    # `cr-at-eol` evite un faux positif sur les fichiers stockes en CRLF : sans lui,
    # chaque ligne ajoutee serait signalee « trailing whitespace ».
    Run-Git -Silent -Arguments @('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol', 'diff', '--cached', '--check')
    if (Test-Git -Arguments @('diff', '--cached', '--quiet')) { return $false }
    Run-Git -Silent -Arguments @('var', 'GIT_AUTHOR_IDENT')
    Run-Git -Arguments @('commit', '-m', $CommitMessage)
    return $true
}

function Push-Branch([string]$Target) {
    for ($attempt = 1; $attempt -le $script:PushAttempts; $attempt++) {
        try {
            Write-Info "push origin/$Target (tentative $attempt/$($script:PushAttempts))"
            Run-Git -Silent -Arguments @('push', '--quiet', '-u', 'origin', $Target)
            return
        } catch {
            if ($NoSync) { throw "La publication de $Target a echoue et la synchronisation est desactivee (-NoSync). Le commit local est conserve." }
            if ($attempt -eq $script:PushAttempts) { throw "La publication de $Target a echoue apres $($script:PushAttempts) tentatives. Le commit local est conserve et aucun force-push n'a ete tente." }
            Write-Warn 'Push refuse : actualisation distante puis nouvelle tentative.'
            Run-Git -Silent -Arguments @('fetch', '--quiet', '--prune', 'origin', $Target)
            Sync-Remote $Target
        }
    }
}

function Show-Doctor {
    Write-Step 'Diagnostic du depot'
    Write-Host ("  Branche active      : " + (Get-Branch))
    $remote = (Get-GitText -AllowFailure -Arguments @('remote', 'get-url', 'origin') | Select-Object -First 1)
    Write-Host ("  Remote origin       : " + $(if ([string]::IsNullOrWhiteSpace($remote)) { 'ABSENT' } else { $remote.Trim() }))
    $pending = Test-PendingOperation
    Write-Host ("  Operation en cours  : " + $(if ($pending) { "$pending (a terminer ou a abandonner)" } else { 'aucune' }))
    $target = if ([string]::IsNullOrWhiteSpace($Branch)) { Get-Branch } else { $Branch }
    if (-not [string]::IsNullOrWhiteSpace($remote) -and (Has-RemoteBranch $target)) {
        Run-Git -Silent -AllowFailure -Arguments @('fetch', '--quiet', '--prune', 'origin')
        $divergence = Get-Divergence $target
        Write-Host ("  Ecart avec origin   : $($divergence.Ahead) commit(s) local(aux), $($divergence.Behind) distant(s)")
    }
    $unmerged = @(Get-UnmergedPaths)
    Write-Host ("  Fichiers non fusionnes : " + $unmerged.Count)
    $markers = @(Get-ConflictMarkers (Get-ChangedPaths))
    Write-Host ("  Marqueurs de conflit   : " + $markers.Count)
    foreach ($file in $markers) { Write-Host ("    - " + $file) }
    $lockPath = Join-Path (Get-GitDir) 'auto-commit.lock'
    Write-Host ("  Verrou de publication  : " + $(if (Test-Path -LiteralPath $lockPath) { "present ($lockPath)" } else { 'libre' }))
    $stashes = @(Get-GitText -AllowFailure -Arguments @('stash', 'list'))
    Write-Host ("  Stashs conserves       : " + $stashes.Count)
    foreach ($line in @($stashes | Select-Object -First 3)) { Write-Host ('    ' + $line) }
    Write-Host ("  Fichiers en attente    : " + @(Get-Status).Count)
    Write-Host ''
    Write-Info 'Mode diagnostic : aucune modification effectuee.'
}

function Invoke-Recover {
    Write-Step 'Recuperation'
    $pending = Test-PendingOperation
    if ($pending) {
        Write-Host "  Une operation $pending est en cours."
        if (Confirm "L abandonner (les commits deja crees restent en place)") {
            if ($pending -eq 'rebase') { Run-Git -AllowFailure -Arguments @('rebase', '--abort') }
            elseif ($pending -eq 'merge') { Run-Git -AllowFailure -Arguments @('merge', '--abort') }
            elseif ($pending -eq 'cherry-pick') { Run-Git -AllowFailure -Arguments @('cherry-pick', '--abort') }
            else { Run-Git -AllowFailure -Arguments @('revert', '--abort') }
            Write-Info 'Operation abandonnee : le depot est revenu a son etat anterieur.'
        }
    }
    $unmerged = @(Get-UnmergedPaths)
    if ($unmerged.Count -gt 0) {
        Write-Warn "Fichiers non fusionnes : $($unmerged -join ', ')"
        Write-Info 'Garder une version : git checkout --ours <fichier> (locale) ou --theirs (distante), puis git add <fichier>.'
        Write-Info 'Tout annuler : git checkout -- <fichier> (ou git reset --hard HEAD, destructif).'
    }
    $markers = @(Get-ConflictMarkers (Get-ChangedPaths))
    foreach ($file in $markers) {
        Write-Warn "Marqueur de conflit dans $file : ouvrez le fichier et gardez le bon contenu."
    }
    $stashes = @(Get-GitText -AllowFailure -Arguments @('stash', 'list'))
    if ($stashes.Count -gt 0) {
        Write-Info "Stashs conserves ($($stashes.Count)) :"
        foreach ($line in $stashes) { Write-Host ('  ' + $line) }
        Write-Info 'Pour en rejouer un : git stash apply stash@{0}, puis git stash drop stash@{0}.'
    }
    if (-not $pending -and $unmerged.Count -eq 0 -and $markers.Count -eq 0 -and $stashes.Count -eq 0) {
        Write-Host '  Rien a recuperer : le depot est propre.' -ForegroundColor Green
    }
}

function Show-Help {
    Write-Host ''
    Write-Host 'auto_commitv2.ps1 [options] [message]'
    Write-Host '  -Branch <nom>          branche cible (branche active par defaut)'
    Write-Host '  -Path <fichiers>       limite le commit a des fichiers precis'
    Write-Host '  -Yes                   confirme sans question'
    Write-Host '  -DryRun                analyse sans indexer, commiter ni pousser'
    Write-Host '  -NoSync                desactive fetch/rebase de securite'
    Write-Host '  -NoPush                commit local seulement, aucune publication'
    Write-Host '  -SkipChecks            ignore les verifications npm'
    Write-Host '  -FullCheck             lance npm run check au lieu de npm run lint'
    Write-Host '  -IncludeSensitive      autorise une cle ou un .env verifie'
    Write-Host '  -Doctor                diagnostic du depot, sans rien modifier'
    Write-Host '  -Recover               aide a sortir d un rebase, d une fusion ou d un stash'
    Write-Host ''
    Write-Host 'Sans message explicite, le sujet du commit est deduit des fichiers modifies.'
    Write-Host ''
    Write-Host 'Protections : verrou local auto-recuperable, blocage des secrets, refus des'
    Write-Host 'marqueurs de conflit, commit temporaire reversible au lieu d un stash, reessai'
    Write-Host 'de push apres actualisation distante, aucun force-push.'
}

if ($Help) {
    Show-Help
    if ($Pause) { Read-Host 'Appuyez sur Entree pour fermer' | Out-Null }
    exit 0
}

try {
    Set-Location -LiteralPath $PSScriptRoot
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '  AUTO COMMIT v2, POWERSHELL' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git est introuvable.' }
    if (-not (Test-Git -Arguments @('rev-parse', '--is-inside-work-tree'))) { throw 'Ce dossier n est pas un depot Git.' }

    $current = Get-Branch
    if ([string]::IsNullOrWhiteSpace($Branch)) { $Branch = $current }

    # Les modes de diagnostic ne modifient rien : ils restent utilisables meme
    # si le depot est casse (rebase interrompu, remote absent, verrou bloque).
    if ($Doctor) { Show-Doctor; exit 0 }
    if ($Recover) { Invoke-Recover; exit 0 }

    if (-not (Test-Git -Arguments @('remote', 'get-url', 'origin'))) { throw 'Le remote origin est absent.' }
    Write-Host "Branche : $Branch"

    if ($current -ne $Branch) {
        if (@(Get-Status).Count -gt 0) { throw "La branche active $current contient des changements : bascule vers $Branch refusee." }
        if (-not (Confirm "Basculer de $current vers $Branch")) { exit 0 }
        if (Test-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/heads/$Branch")) { Run-Git -Arguments @('switch', $Branch) }
        elseif (Test-Git -Arguments @('show-ref', '--verify', '--quiet', "refs/remotes/origin/$Branch")) { Run-Git -Arguments @('switch', '--track', '-c', $Branch, "origin/$Branch") }
        else { Run-Git -Arguments @('switch', '-c', $Branch) }
    }

    if ($DryRun) {
        Write-Step "Verification distante de origin/$Branch"
        Run-Git -Silent -Arguments @('ls-remote', '--heads', 'origin', $Branch)
        Write-Info 'Origine accessible.'
        Write-Step 'Apercu des changements'
        $preview = @(Get-Status)
        if ($preview.Count -eq 0) {
            Write-Info 'Aucun changement de fichier.'
        } else {
            $preview | ForEach-Object { Write-Host $_ }
            Write-Host ''
            $markers = @(Get-ConflictMarkers (Get-ChangedPaths))
            if ($markers.Count -eq 0) { Write-Info 'Marqueurs de conflit : aucun.' }
            else { Write-Warn "Marqueurs de conflit dans : $($markers -join ', ')" }
            Write-Host ''
            Write-Host 'Message de commit qui serait utilise :'
            Write-Host $(if ([string]::IsNullOrWhiteSpace($Message)) { Get-AutoMessage } else { $Message })
        }
        Write-Host ''
        Write-Host '[INFO] Simulation terminee : aucun commit ni push.' -ForegroundColor Green
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($Message)) { $Message = Get-AutoMessage }
    Write-Host "Message : $Message"

    Assert-ReadyToCommit

    Acquire-Lock
    if (-not $NoSync) { Run-Git -Silent -Arguments @('fetch', '--quiet', '--prune', 'origin', $Branch) }
    Sync-Remote $Branch

    $status = @(Get-Status)
    Write-Step 'Apercu des changements'
    if ($status.Count -eq 0) { Write-Info 'Aucun changement de fichier a commiter.' }
    else {
        $status | ForEach-Object { Write-Host $_ }
        Run-Checks
        if (Commit-Work $Message) {
            Write-Info ('Commit cree : ' + ((Get-GitText -Arguments @('log', '-1', '--oneline') | Select-Object -First 1)).Trim())
        }
    }

    if ($NoPush) {
        Write-Info 'Publication desactivee (-NoPush) : le commit reste local.'
    }
    elseif (-not (Has-RemoteBranch $Branch) -or -not (Test-Git -Arguments @('diff', '--quiet', "origin/$Branch..$Branch"))) {
        Write-Step "Publication sur origin/$Branch"
        Push-Branch $Branch
    }

    $elapsed = [math]::Round(((Get-Date) - $script:StartedAt).TotalSeconds, 1)
    if ($NoPush) {
        Write-Host "`n[TERMINE] Commit local sur $Branch, non publie ($elapsed s)." -ForegroundColor Green
    } else {
        Write-Host "`n[TERMINE] $Branch est synchronisee avec origin ($elapsed s)." -ForegroundColor Green
    }
} catch {
    Write-Host "`n[ERREUR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Aucun force-push n a ete execute.' -ForegroundColor Yellow
    Write-Host 'Diagnostic : .\auto_commitv2.ps1 -Doctor   |   Recuperation : .\auto_commitv2.ps1 -Recover' -ForegroundColor Yellow
    exit 1
} finally {
    Release-Lock
    if ($Pause) { Read-Host 'Appuyez sur Entree pour fermer' | Out-Null }
}
