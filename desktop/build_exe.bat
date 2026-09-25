@echo off
chcp 65001 >nul
title Pokedex Invest - installation
cd /d "%~dp0"

echo.
echo  === Pokedex Invest : creation de l'application ===
echo.
echo  [1/3] Installation des composants (pywebview, pyinstaller)...
python -m pip install --upgrade --quiet pywebview pyinstaller
if errorlevel 1 goto err

echo  [2/3] Creation de "Pokedex Invest.exe" (1 a 2 minutes)...
python -m PyInstaller --noconfirm --clean --onefile --windowed --name "Pokedex Invest" --icon icon.ico --add-data "icon.ico;." pokedex_invest.py >build.log 2>&1
if errorlevel 1 goto err

echo  [3/3] Raccourci sur le bureau...
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop'); $s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"$d\Pokedex Invest.lnk\"); $s.TargetPath='%~dp0dist\Pokedex Invest.exe'; $s.IconLocation='%~dp0icon.ico'; $s.WorkingDirectory='%~dp0dist'; $s.Save()"

echo.
echo  Termine ! Lance "Pokedex Invest" depuis ton bureau.
echo  (Premier lancement : Reglages ^> colle ton lien de connexion ^> Connecter)
echo.
pause
exit /b 0

:err
echo.
echo  Une erreur est survenue. Details dans build.log
echo  Verifie que Python est installe avec l'option "Add Python to PATH".
pause
exit /b 1
