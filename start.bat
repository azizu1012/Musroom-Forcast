@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Weather App - Isolated Local Environment Launcher
echo ========================================================

:: Set PATH to prioritize project local node runtime
set "PATH=%~dp0.runtime\nodejs;%PATH%"

echo Local Node: 
node -v
echo.

if not exist "node_modules" (
    echo [INFO] Installing dependencies using isolated runtime...
    call npm install
)

if not exist "data" (
    mkdir data
)

echo [INFO] Starting Weather App Server and Frontend...
call npm run dev

endlocal
