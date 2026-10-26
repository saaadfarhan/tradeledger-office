@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Build and install a per-user Windows 7/10 application.
rem Run from a Windows JDK environment. Do not run this against live data.

cd /d "%~dp0.."
set "OUT=%CD%\build-windows"
set "APP=%OUT%\PurchaseSaleOffice"
set "INSTALL=%LOCALAPPDATA%\PurchaseSaleOffice"
set "STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Purchase Sale Office.lnk"
set "DESKTOP=%USERPROFILE%\Desktop\Purchase Sale Office.lnk"

echo [1/6] Checking Java tools...
where java >nul 2>nul
if errorlevel 1 (
  echo ERROR: java was not found on PATH.
  echo Install a Java 8 runtime or JDK compatible with Windows 7.
  exit /b 1
)
where javac >nul 2>nul
if errorlevel 1 (
  echo ERROR: javac was not found on PATH.
  echo Install a Java 8 JDK to build the application.
  exit /b 1
)
where jar >nul 2>nul
if errorlevel 1 (
  echo ERROR: jar was not found on PATH.
  exit /b 1
)

echo [2/6] Preparing clean generated output...
if exist "%OUT%" rmdir /s /q "%OUT%"
mkdir "%OUT%\classes"
mkdir "%APP%\app"
mkdir "%APP%\data"
mkdir "%APP%\backups"
mkdir "%APP%\lib"

echo [3/6] Compiling Java 8-compatible classes...
if exist "%OUT%\sources.txt" del /q "%OUT%\sources.txt"
rem Quote every source path and use forward slashes: javac argument files
rem interpret backslashes as escapes, especially in C:\ paths.
for /r "src\main\java" %%F in (*.java) do (
  set "SOURCE=%%~fF"
  set "SOURCE=!SOURCE:\=/!"
  echo "!SOURCE!" >> "%OUT%\sources.txt"
)
javac -source 8 -target 8 -encoding UTF-8 -d "%OUT%\classes" @"%OUT%\sources.txt"
if errorlevel 1 (
  echo ERROR: compilation failed.
  exit /b 1
)

echo [4/6] Creating application JAR...
jar cfe "%APP%\app\PurchaseSaleOffice.jar" com.purchasesale.ui.Main -C "%OUT%\classes" .
if errorlevel 1 (
  echo ERROR: JAR creation failed.
  exit /b 1
)

echo [5/6] Checking SQLite JDBC driver...
if exist "lib\sqlite-jdbc.jar" (
  copy /y "lib\sqlite-jdbc.jar" "%APP%\lib\sqlite-jdbc.jar" >nul
) else (
  echo WARNING: lib\sqlite-jdbc.jar was not found.
  echo The current in-memory demo can run, but durable SQLite mode cannot.
  echo Place a Java 8-compatible Xerial SQLite JDBC JAR in lib and rerun this script.
)

echo [6/6] Writing launcher and handover notes...
> "%APP%\run.bat" echo @echo off
>> "%APP%\run.bat" echo setlocal
>> "%APP%\run.bat" echo cd /d "%%~dp0"
>> "%APP%\run.bat" echo if not exist "data" mkdir "data"
>> "%APP%\run.bat" echo if not exist "backups" mkdir "backups"
>> "%APP%\run.bat" echo javaw -Dpurchase.sale.sqlite=true -Dpurchase.sale.database="data\purchase-sale.sqlite" -cp "app\PurchaseSaleOffice.jar;lib\sqlite-jdbc.jar" com.purchasesale.ui.Main
>> "%APP%\run.bat" echo if errorlevel 1 pause
copy /y README.md "%APP%\README.txt" >nul
copy /y scripts\restore-windows.bat "%APP%\restore-windows.bat" >nul

echo [7/7] Installing for the current Windows user...
if not exist "%INSTALL%" mkdir "%INSTALL%"
if not exist "%INSTALL%\data" mkdir "%INSTALL%\data"
if not exist "%INSTALL%\backups" mkdir "%INSTALL%\backups"
if not exist "%INSTALL%\app" mkdir "%INSTALL%\app"
if not exist "%INSTALL%\lib" mkdir "%INSTALL%\lib"
xcopy /E /I /Y "%APP%\app\*" "%INSTALL%\app\" >nul
xcopy /E /I /Y "%APP%\lib\*" "%INSTALL%\lib\" >nul
copy /y "%APP%\run.bat" "%INSTALL%\run.bat" >nul
copy /y "%APP%\README.txt" "%INSTALL%\README.txt" >nul
copy /y "%APP%\restore-windows.bat" "%INSTALL%\restore-windows.bat" >nul

where powershell >nul 2>nul
if errorlevel 1 (
  echo WARNING: PowerShell was not found; application installed without shortcuts.
) else (
  if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell;$p='%STARTMENU%';$l=$w.CreateShortcut($p);$l.TargetPath='javaw.exe';$l.Arguments='-Dpurchase.sale.sqlite=true -Dpurchase.sale.database=data\purchase-sale.sqlite -cp app\PurchaseSaleOffice.jar;lib\sqlite-jdbc.jar com.purchasesale.ui.Main';$l.WorkingDirectory='%INSTALL%';$l.Description='Purchase Sale Office';$l.Save();$p='%DESKTOP%';$l=$w.CreateShortcut($p);$l.TargetPath='javaw.exe';$l.Arguments='-Dpurchase.sale.sqlite=true -Dpurchase.sale.database=data\purchase-sale.sqlite -cp app\PurchaseSaleOffice.jar;lib\sqlite-jdbc.jar com.purchasesale.ui.Main';$l.WorkingDirectory='%INSTALL%';$l.Description='Purchase Sale Office';$l.Save()"
  if errorlevel 1 echo WARNING: shortcut creation failed; run "%INSTALL%\run.bat" directly.
)

echo.
echo Application installed:
echo %INSTALL%
echo Start Menu shortcut:
echo %STARTMENU%
echo Desktop shortcut:
echo %DESKTOP%
echo.
echo IMPORTANT: existing data and backups were preserved when reinstalling.
echo Close/reopen testing must confirm records survive before live use.
echo If the SQLite driver was missing, this package is only the in-memory demo.
exit /b 0
