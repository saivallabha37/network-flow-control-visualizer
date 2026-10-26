@echo off
setlocal enabledelayedexpansion
title Network Flow Control Visualizer - Agent Status

echo ======================================================================
echo   Network Flow Control Visualizer - Agent Service Status
echo ======================================================================
echo.

set AGENT_ACTIVE=0

echo Checking UDP Port 9000 (Peer Datagrams)...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":9000" ^| findstr "UDP"') do (
    set PID_9000=%%a
    set AGENT_ACTIVE=1
    echo [ONLINE] UDP listener bound on port 9000 ^(PID: !PID_9000!^)
)

echo Checking WebSocket Port 8080 (WS for Local HTTP)...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":8080" ^| findstr "LISTENING"') do (
    set PID_8080=%%a
    set AGENT_ACTIVE=1
    echo [ONLINE] WebSocket server bound on port 8080 ^(PID: !PID_8080!^)
)

echo Checking Secure WSS Port 8443 (WSS for Vercel HTTPS)...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":8443" ^| findstr "LISTENING"') do (
    set PID_8443=%%a
    set AGENT_ACTIVE=1
    echo [ONLINE] Secure WSS server bound on port 8443 ^(PID: !PID_8443!^)
)

echo.
if "!AGENT_ACTIVE!"=="1" (
    echo ===^> Agent is ACTIVE and ready to handle UDP datagrams and browser telemetry.
) else (
    echo ===^> Agent is NOT running.
    echo Run start-agent.bat or double-click start-agent-background.vbs to start.
)

echo.
pause

