@echo off
setlocal EnableExtensions

where ssh >nul 2>nul || (echo OpenSSH was not found. Install Git for Windows or the Windows OpenSSH Client, then try again.& exit /b 1)
where ssh-keygen >nul 2>nul || (echo ssh-keygen was not found. Install Git for Windows or the Windows OpenSSH Client, then try again.& exit /b 1)
where scp >nul 2>nul || (echo scp was not found. Install Git for Windows or the Windows OpenSSH Client, then try again.& exit /b 1)

set "SSH_DIR=%USERPROFILE%\.ssh"
set "KEY_FILE=%SSH_DIR%\purchase_sale_debian_ed25519"
set "SSH_CONFIG=%SSH_DIR%\config"
if not exist "%SSH_DIR%" mkdir "%SSH_DIR%"

set /p "REMOTE_HOST=Debian computer name or IP: "
set /p "REMOTE_USER=Debian username: "
if not defined REMOTE_HOST (echo Debian host is required.& exit /b 1)
if not defined REMOTE_USER (echo Debian username is required.& exit /b 1)

if not exist "%KEY_FILE%" (
  echo Creating an SSH key for this connection...
  ssh-keygen -t ed25519 -N "" -C "purchase-sale-manager" -f "%KEY_FILE%" || exit /b 1
)

echo.
ssh -i "%KEY_FILE%" -o BatchMode=yes "%REMOTE_USER%@%REMOTE_HOST%" "true" >nul 2>nul
if errorlevel 1 (
  echo First, confirm the Debian host key and sign in with your Debian password.
  ssh -o PubkeyAuthentication=no "%REMOTE_USER%@%REMOTE_HOST%" "true" || (echo Could not connect. Check the host, username, and password.& exit /b 1)
  echo Installing the SSH public key. Enter your Debian password once more if prompted.
  type "%KEY_FILE%.pub" | ssh -o PubkeyAuthentication=no "%REMOTE_USER%@%REMOTE_HOST%" "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
  if errorlevel 1 (echo Could not install the public key. Check the host, username, and Debian password.& exit /b 1)
)

findstr /C:"Host purchase-sale-debian" "%SSH_CONFIG%" >nul 2>nul
if errorlevel 1 (
  >>"%SSH_CONFIG%" echo Host purchase-sale-debian
  >>"%SSH_CONFIG%" echo     HostName %REMOTE_HOST%
  >>"%SSH_CONFIG%" echo     User %REMOTE_USER%
  >>"%SSH_CONFIG%" echo     IdentityFile "%KEY_FILE%"
  >>"%SSH_CONFIG%" echo     IdentitiesOnly yes
)

ssh purchase-sale-debian "true" || (echo SSH key login failed.& exit /b 1)

echo.
echo Choose transfer direction:
echo   1. Download build-electron from Debian to this PC
echo   2. Upload build-electron from this PC to Debian
set /p "DIRECTION=Enter 1 or 2: "

if "%DIRECTION%"=="1" goto download
if "%DIRECTION%"=="2" goto upload
echo Enter 1 or 2.
exit /b 1

:download
set /p "REMOTE_PATH=Full Debian build-electron folder path: "
if not defined REMOTE_PATH (echo Remote folder path is required.& exit /b 1)
set "LOCAL_PATH=%USERPROFILE%\Downloads"
set /p "LOCAL_PATH=Local parent directory [%LOCAL_PATH%]: "
if not defined LOCAL_PATH set "LOCAL_PATH=%USERPROFILE%\Downloads"
if not exist "%LOCAL_PATH%" mkdir "%LOCAL_PATH%"
scp -r "purchase-sale-debian:%REMOTE_PATH%" "%LOCAL_PATH%"
if errorlevel 1 (echo Download failed.& exit /b 1)
echo Download complete: "%LOCAL_PATH%\build-electron"
exit /b 0

:upload
set /p "REMOTE_PATH=Debian parent directory for build-electron: "
if not defined REMOTE_PATH (echo Remote parent directory is required.& exit /b 1)
set "LOCAL_PATH=%~dp0..\build-electron"
set /p "LOCAL_PATH=Local build-electron folder [%LOCAL_PATH%]: "
if not defined LOCAL_PATH set "LOCAL_PATH=%~dp0..\build-electron"
if not exist "%LOCAL_PATH%" (echo Local folder not found: "%LOCAL_PATH%"& exit /b 1)
ssh purchase-sale-debian "mkdir -p '%REMOTE_PATH%'" || exit /b 1
scp -r "%LOCAL_PATH%" "purchase-sale-debian:%REMOTE_PATH%/"
if errorlevel 1 (echo Upload failed.& exit /b 1)
echo Upload complete: %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_PATH%
exit /b 0
