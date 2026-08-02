@echo off
setlocal
chcp 65001 >nul

set "SCRIPT=%~dp0scripts\git-auto.ps1"
if not exist "%SCRIPT%" (
  echo [ERREUR] Script introuvable : "%SCRIPT%"
  exit /b 7
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo git-auto termine avec le code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
