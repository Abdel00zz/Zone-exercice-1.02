@echo off
setlocal
chcp 65001 >nul

echo.
echo Preparation de Git pour cette machine...
echo Les installations et la connexion demanderont votre confirmation.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0scripts\git-auto.ps1" -Setup -InstallTools -Interactive %*

set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Preparation terminee avec le code %EXIT_CODE%.
)

exit /b %EXIT_CODE%
