"""Pokédex Invest — application de bureau (fenêtre native, sans navigateur).

Affiche l'application Pokédex Invest dans sa propre fenêtre grâce à pywebview
(moteur Edge WebView2 sous Windows). Les réglages et la connexion au serveur
sont conservés entre deux lancements, et les mises à jour de l'application
arrivent automatiquement.

Lancement direct :  pythonw pokedex_invest.py
Version .exe     :  build_exe.bat
"""
import os
import pathlib

import webview

APP_URL = 'https://axel69390.github.io/pokemon-tracker/'


def data_dir():
    """Dossier persistant (réglages, clé de connexion, cache hors ligne)."""
    root = os.environ.get('APPDATA') or os.path.join(pathlib.Path.home(), '.config')
    path = pathlib.Path(root) / 'PokedexInvest'
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def main():
    # Liens eBay, Cardmarket, GCC… : ouverts dans le navigateur habituel.
    webview.settings['OPEN_EXTERNAL_LINKS_IN_BROWSER'] = True
    webview.create_window(
        'Pokédex Invest', APP_URL,
        width=1280, height=860, min_size=(420, 640),
        background_color='#0B0C10', text_select=True,
    )
    webview.start(private_mode=False, storage_path=data_dir())


if __name__ == '__main__':
    main()
