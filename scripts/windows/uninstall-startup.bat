@echo off
setlocal
title Network Flow Control Visualizer - Uninstall Windows Startup Service

echo ======================================================================
echo   Network Flow Control Visualizer - Remove Windows Auto-Start
echo ======================================================================
echo.

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\NetworkFlowControlAgent.lnk

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] Windows Auto-Start shortcut removed.
) else (
    echo [INFO] Startup shortcut not found. Nothing to remove.
)

echo.
pause

