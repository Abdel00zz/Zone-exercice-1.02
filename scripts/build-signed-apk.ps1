# Build signed APK for Windows PowerShell
$ErrorActionPreference = "Stop"

Write-Host "==> [1/4] Compilation du bundle Web de production..."
npm run build

Write-Host "==> [2/4] Synchronisation des assets Capacitor..."
node ./node_modules/@capacitor/cli/bin/capacitor sync android

Write-Host "==> [3/4] Vérification de l'environnement Java et Android SDK..."
if (-not $env:JAVA_HOME -and (Test-Path "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot")) {
    $env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot"
}
if (-not $env:ANDROID_HOME -and (Test-Path "$env:USERPROFILE\Android\Sdk")) {
    $env:ANDROID_HOME = "$env:USERPROFILE\Android\Sdk"
}
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;" + $env:Path

Write-Host "==> [4/4] Compilation et signature de l'APK Release et du bundle AAB via Gradle..."
Push-Location android
.\gradlew.bat assembleRelease bundleRelease
Pop-Location

if (-not (Test-Path "release-android")) { New-Item -ItemType Directory -Path "release-android" | Out-Null }
Copy-Item android\app\build\outputs\apk\release\app-release.apk -Destination .\zone-exercice-release.apk -Force
Copy-Item android\app\build\outputs\apk\release\app-release.apk -Destination .\release-android\ZoneExercice-v1.0.0-signed.apk -Force
Copy-Item android\app\build\outputs\bundle\release\app-release.aab -Destination .\release-android\ZoneExercice-v1.0.0-playstore.aab -Force
Write-Host "==> Succès ! APK et AAB générés :" -ForegroundColor Green
Write-Host "    - .\zone-exercice-release.apk (Installation directe tablette/smartphone)" -ForegroundColor Cyan
Write-Host "    - .\release-android\ZoneExercice-v1.0.0-playstore.aab (Google Play Store)" -ForegroundColor Cyan
