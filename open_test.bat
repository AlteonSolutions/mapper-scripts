@echo off
cd /d "%~dp0"
git pull origin feature/upstream-compute
start "" "%~dp0compute_test.html"
