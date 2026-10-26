@echo off
setlocal
title Network Flow Control Visualizer - Install Windows Startup Service

echo ======================================================================
echo   Network Flow Control Visualizer - Register Windows Auto-Start
echo ======================================================================
echo.

cd /d "%~dp0..\.."
set PROJECT_DIR=%CD%
set VBS_TARGET=%PROJECT_DIR%\scripts\windows\start-agent-background.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_PATH=%STARTUP_DIR%\NetworkFlowControlAgent.lnk

echo [INFO] Project directory: %PROJECT_DIR%
echo [INFO] Background runner: %VBS_TARGET%
echo [INFO] Startup location:  %SHORTCUT_PATH%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Shortcut = $WshShell.CreateShortcut('%SHORTCUT_PATH%'); " ^
  "$Shortcut.TargetPath = 'wscript.exe'; " ^
  "$Shortcut.Arguments = '\"%VBS_TARGET%\"'; " ^
  "$Shortcut.WorkingDirectory = '%PROJECT_DIR%'; " ^
  "$Shortcut.Description = 'Network Flow Control Protocols Visualizer - Background Networking Agent'; " ^
  "$Shortcut.Save()"

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Windows Auto-Start shortcut registered successfully!
    echo The Networking Agent will now run silently in the background whenever you sign in to Windows.
    echo No VS Code or CLI terminal window is required.
) else (
    echo [ERROR] Failed to create shortcut in Startup directory.
)

echo.
pause

