@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: UDAAN 2nd Year Induction Toggle Script for Windows

cd /d "%~dp0\..\.."

set CONFIG_FILE=public\config.json

:: Create config if not exists
if not exist "public" mkdir public
if not exist "%CONFIG_FILE%" (
    echo {"induction1stYearOpen": false, "induction2ndYearOpen": false, "registrationOpen": false}> "%CONFIG_FILE%"
)

:: Read current values
set FIRST_YEAR_STATUS=false
set SECOND_YEAR_STATUS=false
set REGISTRATION_STATUS=false

for /f "tokens=*" %%a in ('type "%CONFIG_FILE%" 2^>nul') do set CONFIG_CONTENT=%%a

echo !CONFIG_CONTENT! | findstr /i "\"induction1stYearOpen\": true" >nul && set FIRST_YEAR_STATUS=true
echo !CONFIG_CONTENT! | findstr /i "\"induction2ndYearOpen\": true" >nul && set SECOND_YEAR_STATUS=true
echo !CONFIG_CONTENT! | findstr /i "\"registrationOpen\": true" >nul && set REGISTRATION_STATUS=true

cls
echo.
echo ╔══════════════════════════════════════╗
echo ║   UDAAN 2ND YEAR INDUCTION CONTROL   ║
echo ╚══════════════════════════════════════╝
echo.

if "!SECOND_YEAR_STATUS!"=="true" (
    echo Current Status: [✓] 2ND YEAR INDUCTIONS ARE OPEN
) else (
    echo Current Status: [X] 2ND YEAR INDUCTIONS ARE CLOSED
)

echo.
echo What would you like to do?
echo 1^) Turn ON 2nd year inductions
echo 2^) Turn OFF 2nd year inductions
echo 3^) Exit
echo.
set /p choice="Enter your choice (1/2/3): "

if "!choice!"=="1" (
    echo {"induction1stYearOpen": !FIRST_YEAR_STATUS!, "induction2ndYearOpen": true, "registrationOpen": !REGISTRATION_STATUS!}> "%CONFIG_FILE%"
    echo.
    echo [✓] 2nd Year Inductions are now OPEN!
) else if "!choice!"=="2" (
    echo {"induction1stYearOpen": !FIRST_YEAR_STATUS!, "induction2ndYearOpen": false, "registrationOpen": !REGISTRATION_STATUS!}> "%CONFIG_FILE%"
    echo.
    echo [X] 2nd Year Inductions are now CLOSED!
) else if "!choice!"=="3" (
    echo Exiting...
    exit /b 0
) else (
    echo Invalid choice!
    pause
    exit /b 1
)

echo.
echo Changes saved to config.json
echo The website will reflect changes on next page load.
echo.
pause
