@echo off
setlocal
title Network Flow Control Protocols Visualizer - Live Networking Agent

echo ======================================================================
echo   Network Flow Control Protocols Visualizer - Live UDP Agent
echo ======================================================================
echo.

cd /d "%~dp0..\.."

echo [INFO] Working directory: %CD%
echo [INFO] Starting Live UDP Networking Agent...
echo [INFO] Local UDP Port: 9000
echo [INFO] Local WebSocket Port: 8080 (Loopback 127.0.0.1)
echo.

if exist "agent\dist\live\cli.js" (
    echo [INFO] Running compiled agent distribution...
    node "agent\dist\live\cli.js" --udp 9000 --ws 8080
) else (
    echo [INFO] Building agent or launching via npx tsx...
    call npx tsx agent/src/live/cli.ts --udp 9000 --ws 8080
)

pause

