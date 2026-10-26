@echo off
setlocal
cd /d "%~dp0.."

if "%~1"=="" (
  echo Usage: restore-windows.bat backups\purchase-sale-YYYYMMDD-HHmmssSSS.sqlite
  exit /b 2
)
if not exist "%~1" (
  echo Backup file not found: %~1
  exit /b 2
)
if not exist "data" mkdir "data"
if not exist "backups" mkdir "backups"

echo WARNING: Purchase Sale Office must be closed before restoring.
echo The current database will be copied to backups before replacement.
choice /C YN /M "Continue with restore"
if errorlevel 2 exit /b 1

if exist "data\purchase-sale.sqlite" copy /Y "data\purchase-sale.sqlite" "backups\before-restore.sqlite" >nul
copy /Y "%~1" "data\purchase-sale.sqlite" >nul
if errorlevel 1 (
  echo Restore failed.
  exit /b 1
)
echo Restore completed. Start the application and run Files ^> Verify Database.
exit /b 0
