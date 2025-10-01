@echo off
echo Starting Search & Chat Interface Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH
    echo Please install Python 3 and try again
    pause
    exit /b 1
)

REM Start the server
python server.py

pause
