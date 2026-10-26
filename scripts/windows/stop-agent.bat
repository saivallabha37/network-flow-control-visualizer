@echo off
setlocal enabledelayedexpansion
title Network Flow Control Visualizer - Stop Agent

echo ======================================================================
echo   Network Flow Control Visualizer - Stop Background Agent
echo ======================================================================
echo.

set KILLED=0

echo Checking for agent processes on port 8080...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":8080" ^| findstr "LISTENING"') do (
    set TARGET_PID=%%a
    if not "!TARGET_PID!"=="" (
        echo Stopping process !TARGET_PID! listening on port 8080...
        taskkill /PID !TARGET_PID! /F >nul 2>&1
        set KILLED=1
    )
)

echo Checking for agent processes on port 9000...
for /f "tokens=5" %%a in ('netstat -a -n -o ^| findstr ":9000" ^| findstr "UDP"') do (
    set TARGET_PID=%%a
    if not "!TARGET_PID!"=="" (
        echo Stopping process !TARGET_PID! bound to UDP 9000...
        taskkill /PID !TARGET_PID! /F >nul 2>&1
        set KILLED=1
    )
)

echo.
if "!KILLED!"=="1" (
    echo [SUCCESS] Background agent stopped successfully.
) else (
    echo [INFO] No active agent processes were found on ports 8080 or 9000.
)

echo.
pause

