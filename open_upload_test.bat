@echo off
setlocal
title Mapper Upload Test

REM Put this file anywhere. On first run it clones the repo into a
REM "mapper-scripts" folder beside itself; after that it just updates.
REM If the file already sits inside the clone, it uses that clone directly.

cd /d "%~dp0"

set REPO_URL=https://github.com/AlteonSolutions/mapper-scripts.git
set BRANCH=feature/direct-pa-submit
set PAGE=test-upload-local.html

echo ============================================
echo  Mapper.js - Local Upload Test
echo  Branch: %BRANCH%
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 goto :no_git

REM ---- locate or create the clone -------------------------------------
if exist "%~dp0.git" (
    set "REPO_DIR=%~dp0."
    goto :have_repo
)
if exist "%~dp0mapper-scripts\.git" (
    set "REPO_DIR=%~dp0mapper-scripts"
    goto :have_repo
)

echo [1/5] No clone found. Cloning into "%~dp0mapper-scripts" ...
echo       (a GitHub sign-in window may appear - this is a private repo)
echo.
git clone --branch %BRANCH% "%REPO_URL%" "%~dp0mapper-scripts"
if errorlevel 1 goto :clone_failed
set REPO_DIR=%~dp0mapper-scripts
echo.
echo       Clone complete.
goto :updated

:have_repo
cd /d "%REPO_DIR%"
set "REPO_DIR=%CD%"
echo  Folder: %CD%
echo.

echo [1/5] Fetching %BRANCH% ...
git fetch origin %BRANCH%
if errorlevel 1 goto :fetch_failed

echo.
echo [2/5] Switching to %BRANCH% ...
git checkout %BRANCH%
if errorlevel 1 goto :checkout_failed

echo.
echo [3/5] Pulling latest ...
git pull --ff-only origin %BRANCH%
if errorlevel 1 goto :not_ff

:updated
cd /d "%REPO_DIR%"

echo.
echo [4/5] Checking dependencies ...
if exist "node_modules\xlsx\dist\xlsx.full.min.js" goto :deps_ok
where npm >nul 2>&1
if errorlevel 1 goto :no_npm
echo       Installing xlsx ...
call npm install --silent
goto :deps_ok

:no_npm
echo [WARN] npm not found and node_modules is missing.
echo        The page needs xlsx. Either install Node.js and re-run, or edit
echo        %PAGE% and point the xlsx script tag back at the cdnjs URL.
goto :deps_ok

:deps_ok
if not exist "%PAGE%" goto :no_page

echo.
echo [5/5] Launching %PAGE% ...
start "" "%REPO_DIR%\%PAGE%"

echo.
echo Repo folder: %REPO_DIR%
echo Edit mapper.js there and refresh the browser to retest - no commit needed.
timeout /t 6 >nul
exit /b 0

REM ---- failure paths ---------------------------------------------------
:no_git
echo [ERROR] git is not on PATH.
echo         Install Git for Windows from https://git-scm.com/download/win
echo         then re-run this file.
goto :fail

:clone_failed
echo.
echo [ERROR] Clone failed.
echo         Check your network, and that your GitHub account has access
echo         to AlteonSolutions/mapper-scripts.
goto :fail

:fetch_failed
echo.
echo [ERROR] Fetch failed - check your network or GitHub credentials.
goto :fail

:checkout_failed
echo.
echo [ERROR] Could not switch branches. You most likely have local edits.
echo         Commit or stash them first. Nothing has been discarded.
goto :fail

:not_ff
echo.
echo [WARN] Pull was not a fast-forward. Your local branch has commits that
echo        are not on origin. Launching with what you have.
goto :updated

:no_page
echo.
echo [ERROR] %PAGE% not found in %REPO_DIR%.
goto :fail

:fail
echo.
pause
exit /b 1
