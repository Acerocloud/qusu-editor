@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if errorlevel 1 goto failed
set "QUSU_NODE="
for /f "delims=" %%N in ('where.exe node.exe 2^>nul') do if not defined QUSU_NODE set "QUSU_NODE=%%N"
if defined QUSU_NODE goto run
set "QUSU_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%QUSU_NODE%" goto missing_node
:run
"%QUSU_NODE%" "scripts\start-editor.mjs" %*
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo Node.js was not found. Install Node.js, then run npm install.
goto failed
:failed
echo.
echo QUSU Editor could not start. Please keep the error above for troubleshooting.
pause
exit /b 1
