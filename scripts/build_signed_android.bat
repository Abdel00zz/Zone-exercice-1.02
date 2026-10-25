@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ==================================================================
echo   Interactive Maths — Generation APK et AAB Signes (Google Play)
echo ==================================================================

set APP_ID=com.interactivemaths.app
set VERSION_NAME=1.0.0
set VERSION_CODE=1
set KEYSTORE_DIR=android-keystore
set KEYSTORE_FILE=%KEYSTORE_DIR%\interactive-maths-release.jks
set KEY_ALIAS=interactivemaths
if "%KEYSTORE_PASSWORD%"=="" set KEYSTORE_PASSWORD=InteractiveMaths2026!
set DIST_APK_DIR=release-android

if not exist "%KEYSTORE_DIR%" mkdir "%KEYSTORE_DIR%"
if not exist "%DIST_APK_DIR%" mkdir "%DIST_APK_DIR%"

echo [1/4] Compilation du bundle Web de production...
call npm run build
if errorlevel 1 exit /b 1

echo [2/4] Verification du Keystore RSA-2048...
if not exist "%KEYSTORE_FILE%" (
    keytool -genkeypair -v -keystore "%KEYSTORE_FILE%" -alias "%KEY_ALIAS%" -keyalg RSA -keysize 2048 -validity 10000 -storepass "%KEYSTORE_PASSWORD%" -keypass "%KEYSTORE_PASSWORD%" -dname "CN=Interactive Maths, OU=Education, O=InteractiveMaths, L=Paris, ST=IDF, C=FR"
)

echo [3/4] Synchronisation du projet Android Capacitor...
if not exist "android" (
    call npm install -D @capacitor/cli @capacitor/core @capacitor/android
    call npx cap add android
)
call npx cap sync android

echo [4/4] Compilation Gradle assembleRelease et bundleRelease...
pushd android
call gradlew.bat assembleRelease bundleRelease
popd

copy /Y "android\app\build\outputs\apk\release\*.apk" "%DIST_APK_DIR%\InteractiveMaths-v%VERSION_NAME%-signed.apk" >nul 2>&1
copy /Y "android\app\build\outputs\bundle\release\*.aab" "%DIST_APK_DIR%\InteractiveMaths-v%VERSION_NAME%-playstore.aab" >nul 2>&1

echo ==================================================================
echo   TERMINE ! Fichiers generes dans %DIST_APK_DIR%\
echo ==================================================================
pause
