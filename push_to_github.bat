@echo off
title Push Gmail-Crawler to GitHub
cd /d "%~dp0"

echo ========================================================
echo        Publishing Gmail-Crawler to your GitHub          
echo ========================================================
echo.

echo [*] Checking GitHub CLI authentication...
gh auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] You are not currently logged in to GitHub.
    echo [*] Opening GitHub login prompt...
    gh auth login -w -p https
)

echo.
echo [*] Creating GitHub repository 'Gmail-Crawler' and pushing files...
gh repo create Gmail-Crawler --public --source=. --remote=origin --push

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [✓] SUCCESS! Repository published to your GitHub.
) else (
    echo.
    echo [!] If repository already exists on your GitHub, pushing commits...
    git push -u origin main
)

echo.
pause
