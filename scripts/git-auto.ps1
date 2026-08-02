<#
.SYNOPSIS
  Commit, synchronisation et push assistes pour le projet.

.EXAMPLE
  .\auto_commit.bat -DryRun
.EXAMPLE
  .\auto_commit.bat -Paths components,App.tsx -WithBuild
#>

[CmdletBinding()]
param(
  [Alias('m')][string]$Message,
  [ValidateSet('feat','fix','docs','style','refactor','perf','test','build','chore','data')]
  [string]$Type,
  [string]$Scope,
  [string[]]$Paths,
  [switch]$Doctor,
  [switch]$DryRun,
  [switch]$NoVerify,
  [switch]$Strict,
  [switch]$WithBuild,
  [switch]$NoPush,
  [switch]$NoSync,
  [switch]$Amend,
  [switch]$Force,
  [switch]$Interactive,
  [switch]$Json,
  [switch]$Setup,
  [switch]$InstallTools,
  [string]$GitName,
  [string]$GitEmail,
  [string]$RemoteUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$EXIT_OK = 0
$EXIT_ERROR = 1
$EXIT_NOTHING = 2
$EXIT_BLOCKED = 3
$EXIT_QUALITY = 4
$EXIT_SYNC = 5
$EXIT_PUSH = 6
$EXIT_ENV = 7
$script:StartedAt = Get-Date
$script:Issues = @()
$script:RepoRoot = $null
$script:Branch = $null
$script:Remote = $null
$script:Changes = @()
$script:CommitSha = $null
$script:Pushed = $false

if ($Paths) {
  $expanded = @()
  foreach ($entry in $Paths) {
    foreach ($part in ($entry -split ',')) {
      $clean = $part.Trim()
      if ($clean) { $expanded += $clean }
    }
  }
  $Paths = @($expanded | Select-Object -Unique)
}

function Write-Step([int]$Number, [string]$Title) {
  Write-Host ''
  Write-Host ("  {0}. {1}" -f $Number, $Title.ToUpperInvariant()) -ForegroundColor Cyan
  Write-Host ('  ' + ('-' * 64)) -ForegroundColor DarkGray
}

function Write-Ok([string]$Text) { Write-Host "     [ok] $Text" -ForegroundColor Green }
function Write-Info([string]$Text) { Write-Host "     [i]  $Text" -ForegroundColor Gray }
function Write-Warn([string]$Text) { Write-Host "     [!]  $Text" -ForegroundColor Yellow }
function Write-Fail([string]$Text) { Write-Host "     [x]  $Text" -ForegroundColor Red }

function Add-Issue([string]$Severity, [string]$Code, [string]$Text) {
  $script:Issues += [pscustomobject]@{ Severity=$Severity; Code=$Code; Text=$Text }
  if ($Severity -eq 'Block') { Write-Fail $Text }
  elseif ($Severity -eq 'Warn') { Write-Warn $Text }
  else { Write-Info $Text }
}

function Invoke-Native([string]$Exe, [string[]]$Arguments) {
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $raw = & $Exe @Arguments 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $oldPreference
  $outputLines = @()
  $errorLines = @()
  $allLines = @()
  foreach ($item in @($raw)) {
    $text = [string]$item
    $allLines += $text
    if ($item -is [System.Management.Automation.ErrorRecord]) { $errorLines += $text }
    else { $outputLines += $text }
  }
  [pscustomobject]@{
    Ok = ($code -eq 0)
    Code = $code
    Lines = $outputLines
    Errors = $errorLines
    Text = ($outputLines -join [Environment]::NewLine)
    All = ($allLines -join [Environment]::NewLine)
  }
}

function Invoke-Git { Invoke-Native 'git' @($args) }

function Get-GitValue {
  $result = Invoke-Native 'git' @($args)
  if (-not $result.Ok) { return '' }
  return $result.Text.Trim()
}

function Test-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Confirm-Choice([string]$Question) {
  if (-not $Interactive) { return $true }
  $answer = Read-Host "     $Question [O/n]"
  if ([string]::IsNullOrWhiteSpace($answer)) { return $true }
  return $answer -match '^(o|oui|y|yes)$'
}

function Write-Report([string]$Status, [int]$ExitCode) {
  $elapsed = [math]::Round(((Get-Date) - $script:StartedAt).TotalSeconds, 1)
  $result = [ordered]@{
    status = $Status
    exitCode = $ExitCode
    branch = $script:Branch
    remote = $script:Remote
    files = $script:Changes.Count
    commit = $script:CommitSha
    pushed = $script:Pushed
    issues = @($script:Issues | ForEach-Object {
      [ordered]@{ severity=$_.Severity; code=$_.Code; message=$_.Text }
    })
    durationSeconds = $elapsed
  }

  Write-Host ''
  Write-Host '  ------------------------------------------------------------' -ForegroundColor DarkCyan
  Write-Host "   Resultat : $Status" -ForegroundColor $(if ($ExitCode -eq 0) { 'Green' } else { 'Yellow' })
  if ($script:Branch) { Write-Host "   Branche  : $($script:Branch)" }
  if ($script:CommitSha) { Write-Host "   Commit   : $($script:CommitSha)" }
  Write-Host "   Fichiers : $($script:Changes.Count)"
  Write-Host "   Push     : $(if ($script:Pushed) { 'oui' } else { 'non' })"
  Write-Host "   Duree    : ${elapsed}s"
  Write-Host '  ------------------------------------------------------------' -ForegroundColor DarkCyan

  if ($script:RepoRoot -and (Test-Path (Join-Path $script:RepoRoot '.git'))) {
    try {
      $reportDir = Join-Path $script:RepoRoot '.git\gitauto'
      New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
      $result | ConvertTo-Json -Depth 5 | Out-File (Join-Path $reportDir 'last-run.json') -Encoding utf8
    } catch { }
  }
  if ($Json) { $result | ConvertTo-Json -Depth 5 }
}

function Stop-Auto([int]$Code, [string]$Status, [string]$Reason = '') {
  if ($Reason) { Write-Warn $Reason }
  Write-Report $Status $Code
  exit $Code
}

function Install-Tool([string]$Command, [string]$WingetId, [string]$Label, [bool]$Required) {
  if (Test-Command $Command) { Write-Ok "$Label disponible."; return $true }
  if (-not $InstallTools) {
    Add-Issue $(if ($Required) { 'Block' } else { 'Warn' }) 'tool-missing' "$Label absent."
    return (-not $Required)
  }
  if (-not (Test-Command 'winget')) {
    Add-Issue $(if ($Required) { 'Block' } else { 'Warn' }) 'winget-missing' "winget absent : $Label non installe."
    return (-not $Required)
  }
  if (-not (Confirm-Choice "Installer $Label avec winget ?")) { return (-not $Required) }
  if ($DryRun) { Write-Info "[simulation] winget install $WingetId"; return $true }
  $install = Invoke-Native 'winget' @('install','--id',$WingetId,'--exact','--accept-package-agreements','--accept-source-agreements')
  if (-not $install.Ok) { Add-Issue 'Block' 'install-failed' "Installation de $Label impossible."; return $false }
  Write-Ok "$Label installe. Relancer le terminal si necessaire."
  return $true
}

function Invoke-Setup {
  Write-Step 0 'Preparation de la machine'
  $gitReady = Install-Tool 'git' 'Git.Git' 'Git for Windows' $true
  Install-Tool 'gh' 'GitHub.cli' 'GitHub CLI' $false | Out-Null
  Install-Tool 'node' 'OpenJS.NodeJS.LTS' 'Node.js LTS' $false | Out-Null
  if (-not $gitReady -or -not (Test-Command 'git')) { Stop-Auto $EXIT_ENV 'setup-tools-missing' }

  $currentName = Get-GitValue 'config' '--global' '--get' 'user.name'
  $currentEmail = Get-GitValue 'config' '--global' '--get' 'user.email'
  if (-not $GitName) { $GitName = $currentName }
  if (-not $GitEmail) { $GitEmail = $currentEmail }
  if (-not $GitName -and $Interactive) { $GitName = Read-Host '     Nom Git' }
  if (-not $GitEmail -and $Interactive) { $GitEmail = Read-Host '     Email Git' }
  if (-not $GitName -or -not $GitEmail) { Stop-Auto $EXIT_ENV 'setup-identity-missing' 'Utiliser -GitName et -GitEmail.' }
  if ($GitEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Stop-Auto $EXIT_ENV 'setup-invalid-email' }

  if (-not $DryRun) {
    Invoke-Git 'config' '--global' 'user.name' $GitName | Out-Null
    Invoke-Git 'config' '--global' 'user.email' $GitEmail | Out-Null
    Invoke-Git 'config' '--global' 'init.defaultBranch' 'main' | Out-Null
    Invoke-Git 'config' '--global' 'pull.rebase' 'true' | Out-Null
    Invoke-Git 'config' '--global' 'fetch.prune' 'true' | Out-Null
    Invoke-Git 'config' '--global' 'push.autoSetupRemote' 'true' | Out-Null
  }
  Write-Ok 'Identite et valeurs Git configurees.'

  if ((Get-GitValue 'rev-parse' '--is-inside-work-tree') -ne 'true') {
    Stop-Auto $EXIT_ENV 'setup-no-repository' 'Ce dossier ne contient pas de depot Git.'
  }
  $script:RepoRoot = (Get-GitValue 'rev-parse' '--show-toplevel') -replace '/', '\'
  Set-Location $script:RepoRoot
  $remotes = @((Get-GitValue 'remote') -split "`n" | Where-Object { $_ })
  if ($remotes.Count -eq 0 -and $RemoteUrl) {
    if ($RemoteUrl -notmatch '^(https://|ssh://|git@)') { Stop-Auto $EXIT_ENV 'setup-invalid-remote' }
    if (-not $DryRun) { Invoke-Git 'remote' 'add' 'origin' $RemoteUrl | Out-Null }
    Write-Ok 'Remote origin ajoute.'
  }
  if ((Test-Command 'gh') -and $Interactive) {
    $auth = Invoke-Native 'gh' @('auth','status')
    if (-not $auth.Ok -and (Confirm-Choice 'Ouvrir la connexion GitHub officielle ?')) {
      if (-not $DryRun) { & gh auth login --web --git-protocol https }
    }
  }
  Stop-Auto $EXIT_OK 'setup-complete'
}

function Test-Environment {
  Write-Step 1 'Environnement'
  if (-not (Test-Command 'git')) { Stop-Auto $EXIT_ENV 'git-missing' 'Git est introuvable.' }
  Write-Ok (Get-GitValue '--version')
  if (Test-Command 'node') { Write-Ok "Node $(& node --version)" } else { Write-Warn 'Node absent.' }
  if (Test-Command 'npm') { Write-Ok "npm $(& npm --version)" } else { Write-Warn 'npm absent.' }
  $name = Get-GitValue 'config' '--get' 'user.name'
  $email = Get-GitValue 'config' '--get' 'user.email'
  if (-not $name -or -not $email) { Add-Issue 'Block' 'identity-missing' 'Identite Git manquante. Lancer setup_git.bat.' }
  else { Write-Ok "Identite Git : $name <$email>" }
}

function Test-Repository {
  Write-Step 2 'Depot'
  if ((Get-GitValue 'rev-parse' '--is-inside-work-tree') -ne 'true') { Stop-Auto $EXIT_ENV 'not-a-repository' }
  $script:RepoRoot = (Get-GitValue 'rev-parse' '--show-toplevel') -replace '/', '\'
  Set-Location $script:RepoRoot
  $script:Branch = Get-GitValue 'branch' '--show-current'
  if (-not $script:Branch) { Add-Issue 'Block' 'detached-head' 'HEAD est detache.' } else { Write-Ok "Branche : $($script:Branch)" }

  $gitDir = Get-GitValue 'rev-parse' '--git-dir'
  if (-not [System.IO.Path]::IsPathRooted($gitDir)) { $gitDir = Join-Path $script:RepoRoot $gitDir }
  if (Test-Path (Join-Path $gitDir 'index.lock')) { Add-Issue 'Block' 'index-lock' 'Verrou Git index.lock present.' }
  foreach ($operation in @('MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','BISECT_LOG')) {
    if (Test-Path (Join-Path $gitDir $operation)) { Add-Issue 'Block' 'git-operation' "Operation Git inachevee : $operation" }
  }
  if ((Test-Path (Join-Path $gitDir 'rebase-merge')) -or (Test-Path (Join-Path $gitDir 'rebase-apply'))) {
    Add-Issue 'Block' 'rebase-active' 'Rebase en cours.'
  }
  $conflicts = @((Get-GitValue 'diff' '--name-only' '--diff-filter=U') -split "`n" | Where-Object { $_ })
  if ($conflicts.Count -gt 0) { Add-Issue 'Block' 'conflicts' "$($conflicts.Count) conflit(s) non resolu(s)." }

  $remotes = @((Get-GitValue 'remote') -split "`n" | Where-Object { $_ })
  if ($remotes -contains 'origin') { $script:Remote = 'origin' }
  elseif ($remotes.Count -gt 0) { $script:Remote = $remotes[0] }
  if ($script:Remote) { Write-Ok "Remote : $($script:Remote)" } else { Write-Warn 'Aucun remote configure.' }
}

function Get-Changes {
  Write-Step 3 'Changements'
  $arguments = @('status','--porcelain=v1','--untracked-files=all')
  if ($Paths) { $arguments += @('--') + $Paths }
  $status = Invoke-Git @arguments
  if (-not $status.Ok) { Stop-Auto $EXIT_ERROR 'status-failed' }
  $entries = @()
  foreach ($line in $status.Lines) {
    if ($line.Length -lt 4) { continue }
    $path = $line.Substring(3).Trim()
    if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
    $entries += [pscustomobject]@{ Status=$line.Substring(0,2); Path=$path.Trim('"') }
  }
  $script:Changes = @($entries)
  if ($script:Changes.Count -eq 0) { Write-Info 'Aucun changement selectionne.'; return }
  Write-Ok "$($script:Changes.Count) fichier(s) detecte(s)."
  foreach ($entry in ($script:Changes | Select-Object -First 20)) { Write-Info "$($entry.Status) $($entry.Path)" }
  if ($script:Changes.Count -gt 20) { Write-Info "... et $($script:Changes.Count - 20) autre(s)." }
}

function Invoke-Inspection {
  Write-Step 4 'Inspection'
  if ($script:Changes.Count -eq 0) { Write-Info 'Rien a inspecter.'; return }
  $secretPath = '(^|/)(\.env($|\.)|id_rsa|id_ed25519|\.claude/settings\.local\.json$|\.codex/)|\.(pem|key|p12|pfx)$'
  $secretContent = '(-----BEGIN [A-Z ]*PRIVATE KEY-----|github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,})'
  foreach ($entry in $script:Changes) {
    $relative = $entry.Path.Replace('\','/')
    $full = Join-Path $script:RepoRoot $entry.Path
    if ($relative -match $secretPath -and $relative -notmatch '\.env\.example$') {
      Add-Issue 'Block' 'sensitive-path' "Fichier sensible detecte : $relative"
    }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    $size = (Get-Item -LiteralPath $full).Length
    if ($size -gt 95MB) { Add-Issue 'Block' 'file-too-large' "Fichier superieur a 95 Mo : $relative"; continue }
    if ($size -gt 5MB) { Add-Issue 'Warn' 'large-file' "Fichier superieur a 5 Mo : $relative" }
    if ($size -gt 1MB) { continue }
    try {
      $content = Get-Content -LiteralPath $full -Raw -ErrorAction Stop
      if ($content -match $secretContent) { Add-Issue 'Block' 'secret-content' "Secret probable detecte dans $relative" }
      if ($content -match '(?m)^(<<<<<<< |=======\s*$|>>>>>>> )') { Add-Issue 'Block' 'conflict-marker' "Marqueur de conflit dans $relative" }
      if ($relative -match '\.(ts|tsx|js|jsx)$' -and $content -match '(?m)\bdebugger\s*;|console\.log\s*\(') {
        Add-Issue 'Warn' 'debug-trace' "Trace de debogage possible dans $relative"
      }
    } catch { Add-Issue 'Warn' 'read-failed' "Inspection impossible : $relative" }
  }
  $blockers = @($script:Issues | Where-Object { $_.Severity -eq 'Block' })
  $warnings = @($script:Issues | Where-Object { $_.Severity -eq 'Warn' })
  if ($blockers.Count -eq 0 -and $warnings.Count -eq 0) { Write-Ok 'Aucun probleme detecte.' }
}

function Invoke-Quality {
  Write-Step 5 'Qualite'
  if ($NoVerify) { Write-Warn 'Controles ignores (-NoVerify).'; return $true }
  if (-not (Test-Path (Join-Path $script:RepoRoot 'package.json'))) { Write-Info 'Pas de package.json.'; return $true }
  if (-not (Test-Command 'npm')) { Write-Warn 'npm absent.'; return (-not $Strict) }

  $checks = @(
    [pscustomobject]@{ Label='TypeScript'; Args=@('run','typecheck','--if-present') },
    [pscustomobject]@{ Label='Lint'; Args=@('run','lint','--if-present') }
  )
  if ($WithBuild) { $checks += [pscustomobject]@{ Label='Build'; Args=@('run','build') } }
  foreach ($check in $checks) {
    Write-Info "$($check.Label)..."
    $result = Invoke-Native 'npm' $check.Args
    if (-not $result.Ok) {
      Write-Fail "$($check.Label) en echec."
      foreach ($line in ($result.Lines | Select-Object -Last 12)) { Write-Host "            $line" -ForegroundColor DarkGray }
      return $false
    }
    Write-Ok "$($check.Label) valide."
  }
  return $true
}

function Get-CommitType {
  if ($Type) { return $Type }
  $paths = @($script:Changes | ForEach-Object { $_.Path.Replace('\','/') })
  if (@($paths | Where-Object { $_ -notmatch '\.md$|^docs/' }).Count -eq 0) { return 'docs' }
  if (@($paths | Where-Object { $_ -notmatch '\.(css|scss)$' }).Count -eq 0) { return 'style' }
  if (@($paths | Where-Object { $_ -notmatch '\.(json|md)$' }).Count -eq 0) { return 'data' }
  if (@($paths | Where-Object { $_ -notmatch '(test|spec)\.' }).Count -eq 0) { return 'test' }
  if (@($paths | Where-Object { $_ -notmatch '^(package(-lock)?\.json|vite\.config|tsconfig)' }).Count -eq 0) { return 'build' }
  if (@($script:Changes | Where-Object { $_.Status -eq '??' }).Count -ge [math]::Ceiling($script:Changes.Count / 2)) { return 'feat' }
  return 'fix'
}

function Get-CommitScope {
  if ($Scope) { return $Scope }
  $roots = @($script:Changes | ForEach-Object {
    $path = $_.Path.Replace('\','/')
    if ($path.Contains('/')) { ($path -split '/')[0] } else { [System.IO.Path]::GetFileNameWithoutExtension($path) }
  } | Select-Object -Unique)
  if ($roots.Count -eq 1) { return $roots[0].ToLowerInvariant() -replace '[^a-z0-9-]','-' }
  return ''
}

function New-CommitMessage {
  if ($Message) { return $Message }
  $kind = Get-CommitType
  $scopeName = Get-CommitScope
  $names = @($script:Changes | Select-Object -First 3 | ForEach-Object {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Path)
    if (-not $name) { $name = [System.IO.Path]::GetFileName($_.Path) }
    $name
  } | Select-Object -Unique)
  $subject = "mise a jour de " + ($names -join ', ')
  if ($script:Changes.Count -gt $names.Count) { $subject += " (+$($script:Changes.Count - $names.Count))" }
  $prefix = $kind
  if ($scopeName) { $prefix += "($scopeName)" }
  $messageValue = "${prefix}: $subject"
  if ($messageValue.Length -gt 72) { $messageValue = $messageValue.Substring(0,69) + '...' }
  return $messageValue
}

function Invoke-Commit {
  Write-Step 6 'Commit'
  $commitMessage = New-CommitMessage
  Write-Host "       $commitMessage" -ForegroundColor White
  if (-not (Confirm-Choice 'Creer ce commit ?')) { Stop-Auto $EXIT_OK 'cancelled' }
  if ($DryRun) { Write-Info '[simulation] git add + git commit'; $script:CommitSha='simulation'; return $true }

  $addArgs = @('add','--all')
  if ($Paths) { $addArgs += @('--') + $Paths }
  $add = Invoke-Git @addArgs
  if (-not $add.Ok) { Stop-Auto $EXIT_ERROR 'stage-failed' $add.All }
  $staged = Get-GitValue 'diff' '--cached' '--name-only'
  if (-not $staged -and -not $Amend) { return $false }
  $args = @('commit','-m',$commitMessage)
  if ($Amend) { $args += '--amend' }
  $commit = Invoke-Git @args
  if (-not $commit.Ok) { Stop-Auto $EXIT_ERROR 'commit-failed' $commit.All }
  $script:CommitSha = Get-GitValue 'rev-parse' '--short' 'HEAD'
  Write-Ok "Commit $($script:CommitSha) cree."
  return $true
}

function Invoke-Sync {
  Write-Step 7 'Synchronisation'
  if ($NoSync) { Write-Warn 'Synchronisation ignoree (-NoSync).'; return }
  if (-not $script:Remote) { Write-Info 'Aucun remote.'; return }
  if ($DryRun) { Write-Info '[simulation] fetch puis rebase si necessaire'; return }
  $fetch = Invoke-Git 'fetch' '--prune' $script:Remote
  if (-not $fetch.Ok) { Stop-Auto $EXIT_SYNC 'fetch-failed' 'Remote injoignable.' }
  Write-Ok 'Fetch termine.'
  $upstream = Get-GitValue 'rev-parse' '--abbrev-ref' '--symbolic-full-name' '@{u}'
  if (-not $upstream) { Write-Info 'La branche amont sera creee au push.'; return }
  $counts = Get-GitValue 'rev-list' '--left-right' '--count' "$upstream...HEAD"
  $behind = 0
  if ($counts -match '^(\d+)\s+(\d+)$') { $behind = [int]$Matches[1]; Write-Ok "Retard : $behind, avance : $($Matches[2])." }
  if ($behind -eq 0) { return }
  $backup = 'refs/gitauto/backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  Invoke-Git 'update-ref' $backup 'HEAD' | Out-Null
  Write-Info "Sauvegarde : $backup"
  $pull = Invoke-Git 'pull' '--rebase' '--autostash' $script:Remote $script:Branch
  if (-not $pull.Ok) { Stop-Auto $EXIT_SYNC 'rebase-failed' "Resoudre le rebase ou executer git rebase --abort. Sauvegarde : $backup" }
  Write-Ok 'Rebase termine.'
}

function Invoke-Push {
  Write-Step 8 'Push'
  if ($NoPush) { Write-Info 'Push ignore (-NoPush).'; return $true }
  if (-not $script:Remote) { Write-Warn 'Aucun remote : commit conserve localement.'; return $true }
  if (-not (Confirm-Choice "Pousser vers $($script:Remote)/$($script:Branch) ?")) { Write-Warn 'Push annule.'; return $true }
  if ($DryRun) { Write-Info '[simulation] git push'; return $true }
  $upstream = Get-GitValue 'rev-parse' '--abbrev-ref' '--symbolic-full-name' '@{u}'
  $pushArgs = @('push')
  if (-not $upstream) { $pushArgs += '--set-upstream' }
  $pushArgs += @($script:Remote,$script:Branch)
  $push = Invoke-Git @pushArgs
  if (-not $push.Ok) { Write-Fail $push.All; return $false }
  $script:Pushed = $true
  Write-Ok 'Push termine.'
  return $true
}

try {
  Write-Host ''
  Write-Host '  ============================================================' -ForegroundColor DarkCyan
  Write-Host '   git-auto | commit et push assistes' -ForegroundColor White
  Write-Host '  ============================================================' -ForegroundColor DarkCyan

  if ($Setup) { Invoke-Setup }
  Test-Environment
  Test-Repository
  Get-Changes
  Invoke-Inspection

  $blockers = @($script:Issues | Where-Object { $_.Severity -eq 'Block' })
  if ($Strict) { $blockers += @($script:Issues | Where-Object { $_.Severity -eq 'Warn' }) }
  if ($Doctor) {
    if ($blockers.Count -gt 0) { Stop-Auto $EXIT_BLOCKED 'doctor-issues' }
    Stop-Auto $EXIT_OK 'doctor-clean'
  }
  if ($script:Changes.Count -eq 0 -and -not $Amend) { Stop-Auto $EXIT_NOTHING 'nothing-to-do' }
  if ($blockers.Count -gt 0 -and -not $Force) { Stop-Auto $EXIT_BLOCKED 'blocked' 'Corriger les problemes ou utiliser -Force.' }
  if (-not (Invoke-Quality) -and -not $Force) { Stop-Auto $EXIT_QUALITY 'quality-failed' }
  if (-not (Invoke-Commit)) { Stop-Auto $EXIT_NOTHING 'nothing-committed' }
  Invoke-Sync
  if (-not (Invoke-Push)) { Stop-Auto $EXIT_PUSH 'push-failed' }
  Stop-Auto $EXIT_OK 'success'
}
catch {
  Write-Fail $_.Exception.Message
  Write-Report 'crash' $EXIT_ERROR
  exit $EXIT_ERROR
}
