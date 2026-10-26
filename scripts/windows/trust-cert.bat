@echo off
setlocal
title Network Flow Control Visualizer - Trust Local Agent Certificate

echo ======================================================================
echo   Network Flow Control Visualizer - Trust Local WSS Certificate
echo ======================================================================
echo.
echo This script registers the local agent's TLS certificate into your
echo Windows Current User Trusted Root store.
echo.
echo This allows the deployed Vercel HTTPS website (https://...vercel.app)
echo to securely connect to wss://127.0.0.1:8443 without any TLS warnings.
echo.

set CERT_FILE=%~dp0..\..\agent\certs\cert.pem

if not exist "%CERT_FILE%" (
    echo [ERROR] Certificate file not found at: %CERT_FILE%
    echo Please run scripts\generate-cert.ps1 first.
    pause
    exit /b 1
)

for /f "tokens=3" %%a in ('certutil -dump "%CERT_FILE%" ^| findstr /i "Cert Hash(sha1):"') do set THUMBPRINT=%%a
echo Certificate Thumbprint (SHA-1): %THUMBPRINT%
echo.
echo Registering certificate with certutil...
certutil -addstore -user Root "%CERT_FILE%"

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] Certificate successfully trusted in Windows Current User store!
    echo Chrome and Edge will now securely connect to wss://127.0.0.1:8443.
) else (
    echo.
    echo [WARNING] Failed to add certificate to user root store.
)

echo.
pause

