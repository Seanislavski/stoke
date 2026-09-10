@echo off
REM Weekly off-platform backup of the Body Doubling Q&A library to Proton Drive.
REM Driven by the Windows scheduled task "Stoke library backup".
REM
REM Logs every run - success AND failure - to _backup-log.txt next to the
REM backup itself. A backup that silently stops working is worse than no
REM backup, so the log is the point, not an extra.

set "REPO=C:\Users\Sean\OneDrive\reciprocal-community-platform"
set "DEST=C:\Users\Sean\Proton Drive\seanislavski\My files\library-export"
set "LOG=%DEST%\_backup-log.txt"
set "NODE=C:\Program Files\nodejs\node.exe"

if not exist "%DEST%" mkdir "%DEST%"

echo. >> "%LOG%"
echo ===== %DATE% %TIME% ===== >> "%LOG%"

"%NODE%" "%REPO%\scripts\export-library.mjs" --out "%DEST%" --photos >> "%LOG%" 2>&1

if errorlevel 1 (
  echo RESULT: FAILED with errorlevel %ERRORLEVEL% >> "%LOG%"
  exit /b %ERRORLEVEL%
) else (
  echo RESULT: OK >> "%LOG%"
  exit /b 0
)
