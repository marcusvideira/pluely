@echo off
setlocal
title Pluely - build ^& run
cd /d "%~dp0"

REM --- Ensure Rust/cargo is on PATH (rustup installs to %USERPROFILE%\.cargo\bin) ---
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

echo ===============================================
echo    Pluely  -  building and running locally
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :no_node

where cargo >nul 2>nul
if errorlevel 1 goto :no_cargo

if not exist "node_modules\" (
  echo Installing npm dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 goto :npm_fail
  echo.
)

echo Compiling Rust + frontend and launching the app...
echo Keep this window open. Press Ctrl+C to stop.
echo.
call npm run tauri dev

echo.
echo Pluely stopped.
goto :end

:no_node
echo [ERROR] Node.js not found. Install Node 18+ from https://nodejs.org and try again.
goto :end

:no_cargo
echo [ERROR] cargo/Rust not found. Install it from https://rustup.rs then run this file again.
goto :end

:npm_fail
echo [ERROR] "npm install" failed. Check the messages above.
goto :end

:end
echo.
pause
endlocal
