@echo off
setlocal
title Mapper Upload Test

REM Runs from wherever this file lives, so the repo can sit anywhere.
cd /d "%~dp0"

set BRANCH=feature/direct-pa-submit

echo ============================================
echo  Mapper.js - Local Upload Test
echo  Folder: %CD%
echo  Branch: %BRANCH%
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] git is not on PATH. Install Git for Windows, then re-run.
    goto :fail
)

if not exist ".git" (
    echo [ERROR] This folder is not a git clone.
    echo         Put open_upload_test.bat inside your mapper-scripts clone.
    goto :fail
)

echo [1/4] Fetching %BRANCH% ...
git fetch origin %BRANCH%
if errorlevel 1 (
    echo [ERROR] Fetch failed - check your network or GitHub credentials.
    goto :fail
)

echo.
echo [2/4] Switching to %BRANCH% ...
git checkout %BRANCH%
if errorlevel 1 (
    echo.
    echo [ERROR] Could not switch branches. You probably have local edits.
    echo         Commit or stash them first - nothing has been discarded.
    goto :fail
)

echo.
echo [3/4] Pulling latest ...
git pull --ff-only origin %BRANCH%
if errorlevel 1 (
    echo.
    echo [WARN] Pull was not a fast-forward. Your local branch has commits
    echo        that are not on origin. Launching with what you have.
    echo.
)

echo.
echo [4/4] Checking dependencies ...
if exist "node_modules\xlsx\dist\xlsx.full.min.js" (
    echo       xlsx already installed.
) else (
    where npm >nul 2>&1
    if errorlevel 1 (
        echo [WARN] npm not found and node_modules is missing.
        echo        The page needs xlsx. Either install Node.js and re-run,
        echo        or edit test-upload-local.html and point the xlsx script
        echo        tag back at the cdnjs URL.
    ) else (
        echo       Installing xlsx ...
        call npm install --silent
    )
)

if not exist "test-upload-local.html" (
    echo.
    echo [ERROR] test-upload-local.html not found after pull.
    goto :fail
)

echo.
echo Launching test-upload-local.html ...
start "" "%~dp0test-upload-local.html"

echo.
echo Done. Edit mapper.js and refresh the browser to retest - no commit needed.
timeout /t 5 >nul
exit /b 0

:fail
echo.
pause
exit /b 1
