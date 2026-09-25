@echo off
cd /d "%~dp0"
python -m pip show pywebview >nul 2>&1 || python -m pip install --quiet pywebview
start "" pythonw pokedex_invest.py
