@echo off
setlocal
title Network Flow Control Visualizer - Untrust Local Agent Certificate

echo ======================================================================
echo   Network Flow Control Visualizer - Remove Trusted Local Certificate
echo ======================================================================
echo.

set CERT_FILE=%~dp0..\..\agent\certs\cert.pem

if not exist "%CERT_FILE%" (
    echo [ERROR] Certificate file not found at: %CERT_FILE%
    pause
    exit /b 1
)

for /f "tokens=3" %%a in ('certutil -dump "%CERT_FILE%" ^| findstr /i "Cert Hash(sha1):"') do set THUMBPRINT=%%a

if not "%THUMBPRINT%"=="" (
    echo Target Thumbprint: %THUMBPRINT%
    echo Removing certificate from Windows Current User Root store...
    certutil -delstore -user Root %THUMBPRINT%
) else (
    echo Removing certificate from Windows Current User Root store...
    certutil -delstore -user Root "localhost"
)

echo.
echo [SUCCESS] Certificate removed from Windows Current User store.
echo.
pause

