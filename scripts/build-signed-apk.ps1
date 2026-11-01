# Build signed APK for Windows PowerShell
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "==> [1/4] Compilation du bundle Web de production..."
npm run build
if ($LASTEXITCODE -ne 0) { throw "La compilation Web a échoué. Aucun APK existant ne sera recopié." }

Write-Host "==> [2/4] Synchronisation des assets Capacitor..."
node ./node_modules/@capacitor/cli/bin/capacitor sync android
if ($LASTEXITCODE -ne 0) { throw "La synchronisation Capacitor a échoué." }

Write-Host "==> [3/4] Vérification de l'environnement Java et Android SDK..."
if (-not $env:JAVA_HOME -and (Test-Path "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot")) {
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
}
if (-not $env:ANDROID_HOME -and (Test-Path "$env:USERPROFILE\Android\Sdk")) {
    $env:ANDROID_HOME = "$env:USERPROFILE\Android\Sdk"
}
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;" + $env:Path
if (-not (Test-Path "$env:JAVA_HOME\bin\javac.exe")) { throw "JAVA_HOME doit pointer vers un JDK installé." }
if (-not (Test-Path "$env:ANDROID_HOME\platforms")) { throw "ANDROID_HOME doit pointer vers le SDK Android installé." }
if (-not (Test-Path "android.keystore")) { throw "La clé de signature android.keystore est introuvable." }

Write-Host "==> [4/4] Compilation et signature de l'APK Release et du bundle AAB via Gradle..."
Push-Location android
try {
    .\gradlew.bat assembleRelease bundleRelease
    if ($LASTEXITCODE -ne 0) { throw "La compilation Android a échoué. Aucun ancien APK ne sera présenté comme nouveau." }
} finally {
    Pop-Location
}

if (-not (Test-Path "release-android")) { New-Item -ItemType Directory -Path "release-android" | Out-Null }
Copy-Item android\app\build\outputs\apk\release\app-release.apk -Destination .\zone-exercice-release.apk -Force
Copy-Item android\app\build\outputs\apk\release\app-release.apk -Destination .\release-android\ZoneExercice-v1.0.0-signed.apk -Force
Copy-Item android\app\build\outputs\bundle\release\app-release.aab -Destination .\release-android\ZoneExercice-v1.0.0-playstore.aab -Force
Write-Host "==> Succès ! APK et AAB générés :" -ForegroundColor Green
Write-Host "    - .\zone-exercice-release.apk (Installation directe tablette/smartphone)" -ForegroundColor Cyan
Write-Host "    - .\release-android\ZoneExercice-v1.0.0-playstore.aab (Google Play Store)" -ForegroundColor Cyan
