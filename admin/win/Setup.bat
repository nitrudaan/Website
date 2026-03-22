@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: UDAAN Website Setup Script for Windows
:: Double-click this file to install all dependencies and set up the project

cd /d "%~dp0\..\.."

cls
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                                                          ║
echo ║        UDAAN AEROMODELLING CLUB - WEBSITE SETUP          ║
echo ║                    NIT Rourkela                          ║
echo ║                                                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Check for Node.js
echo [INFO] Checking for Node.js...

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [X] Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo.
    echo   Download from: https://nodejs.org/
    echo   ^(Choose the LTS version^)
    echo.
    echo After installing, restart this setup script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [✓] Node.js found: %NODE_VERSION%

:: Check for npm
echo [INFO] Checking for npm...

where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [X] npm is not installed!
    echo npm usually comes with Node.js. Please reinstall Node.js.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm -v') do set NPM_VERSION=%%i
echo [✓] npm found: v%NPM_VERSION%

:: Ensure public directory and config exist
echo.
echo [INFO] Setting up configuration...

if not exist "public" mkdir public

if not exist "public\config.json" (
    echo {"inductionOpen": false, "registrationOpen": false, "inductionOpen2ndYear": false}> "public\config.json"
    echo [✓] Created config.json with default settings
) else (
    echo [✓] config.json already exists
)

:: Setup environment variables (.env file)
echo.
echo [INFO] Setting up environment variables...

set "DEFAULT_SUPABASE_URL=https://vdeacxzqdbulgklfkqfs.supabase.co"
set "DEFAULT_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkZWFjeHpxZGJ1bGdrbGZrcWZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTAxMTgsImV4cCI6MjA4MDMyNjExOH0.NBSBiR-l0Itv-rhKXod8fAar2apdTbad4_qN4vyQdDM"

if not exist ".env" (
    echo [!] .env file not found. Creating with default UDAAN Supabase configuration...
    (
        echo # Supabase Configuration
        echo # Replace these values with your own if you're using a different Supabase project
        echo.
        echo VITE_SUPABASE_URL=%DEFAULT_SUPABASE_URL%
        echo VITE_SUPABASE_ANON_KEY=%DEFAULT_SUPABASE_ANON_KEY%
        echo.
        echo # Optional: Gemini API Key for AI features ^(leave empty if not needed^)
        echo # GEMINI_API_KEY=your_gemini_api_key_here
    ) > ".env"
    echo [✓] Created .env file with default UDAAN Supabase configuration
) else (
    :: Verify .env has required variables
    echo [INFO] Verifying .env configuration...
    
    set ENV_VALID=true
    
    findstr /C:"VITE_SUPABASE_URL" ".env" >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [!] VITE_SUPABASE_URL not found in .env
        set ENV_VALID=false
    )
    
    findstr /C:"VITE_SUPABASE_ANON_KEY" ".env" >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [!] VITE_SUPABASE_ANON_KEY not found in .env
        set ENV_VALID=false
    )
    
    if "!ENV_VALID!"=="true" (
        echo [✓] .env file is properly configured
    ) else (
        echo [!] Some environment variables are missing!
        echo.
        set /p reset_env="Would you like to reset .env to default configuration? (y/N): "
        if /i "!reset_env!"=="y" (
            (
                echo # Supabase Configuration
                echo # Replace these values with your own if you're using a different Supabase project
                echo.
                echo VITE_SUPABASE_URL=%DEFAULT_SUPABASE_URL%
                echo VITE_SUPABASE_ANON_KEY=%DEFAULT_SUPABASE_ANON_KEY%
                echo.
                echo # Optional: Gemini API Key for AI features ^(leave empty if not needed^)
                echo # GEMINI_API_KEY=your_gemini_api_key_here
            ) > ".env"
            echo [✓] Reset .env file with default configuration
        )
    )
)

:: Install dependencies
echo.
echo [INFO] Installing dependencies...
echo.

if exist "node_modules" (
    echo [!] node_modules folder exists
    echo.
    set /p reinstall="Do you want to reinstall dependencies? (y/N): "
    if /i "!reinstall!"=="y" (
        echo [INFO] Removing existing node_modules...
        rmdir /s /q node_modules 2>nul
        del package-lock.json 2>nul
    ) else (
        echo [INFO] Skipping dependency installation
        set SKIP_INSTALL=true
    )
)

if not defined SKIP_INSTALL (
    echo [INFO] Running npm install... ^(this may take a few minutes^)
    echo.
    
    call npm install
    
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [X] Failed to install dependencies!
        echo [INFO] Try running 'npm install' manually to see the error
        pause
        exit /b 1
    )
    
    echo.
    echo [✓] Dependencies installed successfully!
)

:: Verify installation
echo.
echo [INFO] Verifying installation...

set MISSING_DEPS=

if not exist "node_modules\react" set MISSING_DEPS=!MISSING_DEPS! react
if not exist "node_modules\vite" set MISSING_DEPS=!MISSING_DEPS! vite
if not exist "node_modules\framer-motion" set MISSING_DEPS=!MISSING_DEPS! framer-motion

if "!MISSING_DEPS!"=="" (
    echo [✓] All core packages installed correctly
) else (
    echo [!] Some packages may be missing:!MISSING_DEPS!
    echo [INFO] Try running 'npm install' manually
)

:: Verify critical public assets (audio, models, logos)
echo.
echo [INFO] Verifying public assets (audio, models, logos)...

set MISSING_ASSETS=

if not exist "public\Click.wav" set MISSING_ASSETS=!MISSING_ASSETS! Click.wav
if not exist "public\Reject.wav" set MISSING_ASSETS=!MISSING_ASSETS! Reject.wav
if not exist "public\hayden-folker-surrounded.mp3" set MISSING_ASSETS=!MISSING_ASSETS! hayden-folker-surrounded.mp3
if not exist "public\uploads-files-3193264-drone+2+model.glb" set MISSING_ASSETS=!MISSING_ASSETS! drone-model.glb
if not exist "public\RC.glb" set MISSING_ASSETS=!MISSING_ASSETS! RC.glb
if not exist "public\udaan-logo.webp" set MISSING_ASSETS=!MISSING_ASSETS! udaan-logo.webp
if not exist "public\nitr-logo.svg" set MISSING_ASSETS=!MISSING_ASSETS! nitr-logo.svg

if "!MISSING_ASSETS!"=="" (
    echo [✓] All essential public assets are present
) else (
    echo [!] Some public assets are missing:!MISSING_ASSETS!
    echo Place the missing files in the 'public/' folder.
    echo Audio files: .mp3 or .wav format
    echo Model files: .glb format
    echo Logos: .webp or .svg format
)

:: Summary
echo.
echo ══════════════════════════════════════════════════════════
echo                     SETUP COMPLETE!
echo ══════════════════════════════════════════════════════════
echo.
echo   To start the development server:
echo.
echo     npm run dev
echo.
echo   Then open: http://localhost:3000
echo.
echo   Default Admin Login:
echo     ID: UDAAN-001
echo     Password: admin123
echo.
echo   Admin controls (in admin\win folder):
echo     - Toggle-Induction-1stYear.bat  - Toggle 1st year induction
echo     - Toggle-Induction-2ndYear.bat  - Toggle 2nd year induction
echo     - Toggle-Registration.bat       - Toggle event registration
echo.
echo ══════════════════════════════════════════════════════════
echo.

:: Ask if user wants to start the server
set /p start_server="Would you like to start the development server now? (Y/n): "

if /i not "!start_server!"=="n" (
    echo.
    echo [INFO] Starting development server...
    echo.
    call npm run dev
) else (
    echo.
    echo [INFO] You can start the server later with: npm run dev
    echo.
    pause
)
