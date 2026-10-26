@echo off
setlocal
title Network Flow Control Visualizer - Configure Windows Firewall

echo ======================================================================
echo   Network Flow Control Visualizer - Windows Firewall Setup
echo ======================================================================
echo.

echo This script adds inbound and outbound firewall rules for UDP port 9000
echo so two laptops on the same Wi-Fi / LAN can communicate seamlessly.
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Administrator privileges are required to modify Windows Firewall.
    echo Please right-click this script and select "Run as administrator".
    echo.
    echo Alternatively, run this command in an Administrator PowerShell:
    echo   New-NetFirewallRule -DisplayName "NFCV UDP 9000 Inbound" -Direction Inbound -Protocol UDP -LocalPort 9000 -Action Allow
    echo.
    pause
    exit /b 1
)

echo Adding Inbound Rule for UDP port 9000...
netsh advfirewall firewall delete rule name="Network Flow Control Visualizer UDP 9000 Inbound" >nul 2>&1
netsh advfirewall firewall add rule name="Network Flow Control Visualizer UDP 9000 Inbound" dir=in action=allow protocol=UDP localport=9000

echo Adding Outbound Rule for UDP port 9000...
netsh advfirewall firewall delete rule name="Network Flow Control Visualizer UDP 9000 Outbound" >nul 2>&1
netsh advfirewall firewall add rule name="Network Flow Control Visualizer UDP 9000 Outbound" dir=out action=allow protocol=UDP localport=9000

echo.
echo [SUCCESS] Windows Firewall rules configured successfully for UDP port 9000!
echo Both laptops can now exchange real UDP datagrams without firewall drops.
echo.
pause

