@echo off
setlocal
title SailPoint Connector Launcher

echo [INFO] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Node.js is not found on this system.
    echo [INFO] Attempting to install Node.js LTS via Winget...
    
    winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Automatic installation failed.
        echo Please download and install Node.js manually from: https://nodejs.org/
        pause
        exit /b 1
    )
    
    echo.
    echo [SUCCESS] Node.js has been installed.
    echo [IMPORTANT] Windows requires a restart of the terminal to recognize the new 'node' command.
    echo Please close this window and run the script again.
    pause
    exit /b 0
)

echo [INFO] Node.js is ready.
echo.

:: Configuration
set PORT=3000

echo [INFO] Starting server on port %PORT%...
echo [INFO] Access the app at: http://localhost:%PORT%
echo.

:: Start the server
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server crashed or failed to start.
    pause
)
endlocal
