@echo off
setlocal enabledelayedexpansion
title SailPoint Connector Launcher

echo ============================================
echo  SailPoint Connector - Standalone Launcher
echo ============================================
echo.

:: ====================================
:: Check Node.js Installation
:: ====================================
echo [STEP 1/3] Checking for Node.js...
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js is installed
    goto :check_npm
)

echo [WARN] Node.js is not installed
echo.

:: ====================================
:: Attempt Automatic Installation
:: ====================================
echo [AUTO-INSTALL] Attempting automatic installation...
echo.

:: Try Method 1: Winget (Windows 10/11)
echo [Method 1/3] Trying Winget (Windows Package Manager)...
winget --version >nul 2>&1
if %errorlevel% equ 0 (
    echo     Winget is available. Installing Node.js...
    winget install -e --id OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements --silent
    
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Node.js installed via Winget!
        echo [ACTION] Please close this window and run the script again.
        pause
        exit /b 0
    ) else (
        echo     Winget installation failed. Trying next method...
    )
) else (
    echo     Winget not available on this system.
)

:: Try Method 2: Chocolatey
echo.
echo [Method 2/3] Trying Chocolatey...
choco --version >nul 2>&1
if %errorlevel% equ 0 (
    echo     Chocolatey is available. Installing Node.js...
    choco install nodejs-lts -y
    
    if %errorlevel% equ 0 (
        echo.
        echo [SUCCESS] Node.js installed via Chocolatey!
        echo [ACTION] Please close this window and run the script again.
        pause
        exit /b 0
    ) else (
        echo     Chocolatey installation failed. Trying next method...
    )
) else (
    echo     Chocolatey not available on this system.
)

:: Try Method 3: Manual Download Instructions
echo.
echo [Method 3/3] Manual Installation Required
echo.
echo ============================================
echo  MANUAL INSTALLATION INSTRUCTIONS
echo ============================================
echo.
echo Automatic installation failed. Please install Node.js manually:
echo.
echo 1. Open your web browser
echo 2. Visit: https://nodejs.org/
echo 3. Download the "LTS" (Long Term Support) version
echo 4. Run the installer (.msi file)
echo 5. Follow the installation wizard
echo 6. Accept all default options
echo 7. Restart this script after installation
echo.
echo TIP: The installer includes npm automatically
echo.
echo ============================================
pause
exit /b 1

:: ====================================
:: Check npm Installation
:: ====================================
:check_npm
echo.
echo [STEP 2/3] Checking for npm...
call npm -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] npm is installed
    goto :start_server
)

echo [WARN] npm is not installed (not required for server)
echo [INFO] The server will run without npm
echo        npm is only needed for development tasks
echo.
goto :start_server

:: ====================================
:: Start the Server
:: ====================================
:start_server
echo.
echo [STEP 3/3] Starting Server...
echo ============================================
echo.

set PORT=3000
set HOSTNAME=localhost

echo Configuration:
echo   - Port: %PORT%
echo   - URL:  http://%HOSTNAME%:%PORT%
echo.
echo [INFO] Starting SailPoint Connector...
echo [INFO] Press Ctrl+C to stop the server
echo.
echo ============================================
echo.

:: Start the Node.js server
node server.js

:: Handle server exit
if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo [ERROR] Server crashed or failed to start
    echo ============================================
    echo.
    echo Possible reasons:
    echo   - Port %PORT% is already in use
    echo   - Missing dependencies
    echo   - Configuration error
    echo.
    echo Try:
    echo   1. Close other applications using port %PORT%
    echo   2. Check the .env file exists
    echo   3. Review error messages above
    echo.
    pause
    exit /b 1
)

endlocal
