#!/usr/bin/env bash
# ==============================================================================
# Interactive Maths — Générateur Automatisé APK & AAB Signés (Google Play Store)
# Cible : Android API 35 (Android 15), Signature v2/v3 RSA-2048
# ==============================================================================
set -euo pipefail

APP_ID="${APP_ID:-com.interactivemaths.app}"
APP_NAME="${APP_NAME:-Interactive Maths}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
VERSION_CODE="${VERSION_CODE:-1}"
KEYSTORE_DIR="./android-keystore"
KEYSTORE_FILE="${KEYSTORE_DIR}/interactive-maths-release.jks"
KEY_ALIAS="${KEY_ALIAS:-interactivemaths}"
KEYSTORE_PASSWORD="${KEYSTORE_PASSWORD:-InteractiveMaths2026!}"
KEY_PASSWORD="${KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
DIST_APK_DIR="./release-android"

echo "=================================================================="
echo "  1. Compilation du bundle Web de production (Vite + KaTeX)"
echo "=================================================================="
npm run build

echo "=================================================================="
echo "  2. Vérification / Génération du Keystore RSA-2048 de Production"
echo "=================================================================="
mkdir -p "${KEYSTORE_DIR}" "${DIST_APK_DIR}"

if [ ! -f "${KEYSTORE_FILE}" ]; then
  echo "-> Création du keystore de signature Google Play : ${KEYSTORE_FILE}"
  keytool -genkeypair -v \
    -keystore "${KEYSTORE_FILE}" \
    -alias "${KEY_ALIAS}" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "${KEYSTORE_PASSWORD}" \
    -keypass "${KEY_PASSWORD}" \
    -dname "CN=Interactive Maths, OU=Education, O=InteractiveMaths, L=Paris, ST=IDF, C=FR"
fi

echo "-> Empreinte SHA-256 pour Digital Asset Links (public/.well-known/assetlinks.json) :"
SHA256_FP=$(keytool -list -v -keystore "${KEYSTORE_FILE}" -alias "${KEY_ALIAS}" -storepass "${KEYSTORE_PASSWORD}" | grep -i "SHA256:" | awk '{print $2}' || true)
echo "   SHA-256 : ${SHA256_FP}"

if [ -n "${SHA256_FP}" ] && [ -f "./public/.well-known/assetlinks.json" ]; then
  node -e "
    const fs = require('fs');
    const file = './public/.well-known/assetlinks.json';
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data[0].target.package_name = '${APP_ID}';
    data[0].target.sha256_cert_fingerprints = ['${SHA256_FP}'];
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  "
  echo "-> public/.well-known/assetlinks.json mis à jour avec l'empreinte SHA-256."
fi

echo "=================================================================="
echo "  3. Initialisation du projet Android Natif (Capacitor)"
echo "=================================================================="
if [ ! -d "./android" ]; then
  npx --yes @capacitor/cli@latest add android || {
    npm install -D @capacitor/cli @capacitor/core @capacitor/android
    npx cap add android
  }
fi

npx cap sync android

# Configure Android SDK 35 & versionCode / versionName + signingConfigs dans android/app/build.gradle
node -e "
const fs = require('fs');
const gradlePath = './android/app/build.gradle';
if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  content = content.replace(/versionCode\s+\d+/, 'versionCode ${VERSION_CODE}');
  content = content.replace(/versionName\s+\"[^\"]+\"/, 'versionName \"${VERSION_NAME}\"');
  if (!content.includes('signingConfigs')) {
    const signingBlock = \`
    signingConfigs {
        release {
            storeFile file('../../android-keystore/interactive-maths-release.jks')
            storePassword '${KEYSTORE_PASSWORD}'
            keyAlias '${KEY_ALIAS}'
            keyPassword '${KEY_PASSWORD}'
            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }\`;
    content = content.replace('buildTypes {', signingBlock + '\n    buildTypes {');
    content = content.replace(/buildTypes\s*\{\s*release\s*\{/, 'buildTypes {\n        release {\n            signingConfig signingConfigs.release');
  }
  fs.writeFileSync(gradlePath, content);
}
"

echo "=================================================================="
echo "  4. Compilation & Signature de l'APK et de l'AAB (Google Play)"
echo "=================================================================="
(
  cd android
  chmod +x ./gradlew
  ./gradlew assembleRelease bundleRelease
)

cp ./android/app/build/outputs/apk/release/*.apk "${DIST_APK_DIR}/InteractiveMaths-v${VERSION_NAME}-signed.apk" 2>/dev/null || true
cp ./android/app/build/outputs/bundle/release/*.aab "${DIST_APK_DIR}/InteractiveMaths-v${VERSION_NAME}-playstore.aab" 2>/dev/null || true

echo "=================================================================="
echo "  SUCCÈS ! Fichiers signés prêts pour Google Play Console :"
echo "  - APK Signé : ${DIST_APK_DIR}/InteractiveMaths-v${VERSION_NAME}-signed.apk"
echo "  - AAB Play  : ${DIST_APK_DIR}/InteractiveMaths-v${VERSION_NAME}-playstore.aab"
echo "  - Keystore  : ${KEYSTORE_FILE}"
echo "=================================================================="
