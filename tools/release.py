#!/usr/bin/env python3
"""Stamps a new build everywhere a browser could serve a stale file.

Every module import, the stylesheet, the data catalogue and version.json carry
?v=<build>, so a new release never mixes cached and fresh files (the iOS
home-screen app keeps HTTP-cached files for several minutes), and the open app
reloads itself when version.json announces another build.

The version shown in Settings only changes when it is given:
  python tools/release.py          new build, same displayed version
  python tools/release.py 2.5.0    new displayed version (and a new build)
"""
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SETTINGS = ROOT / 'assets' / 'js' / 'views' / 'settings.js'
STAMP = r"[0-9A-Za-z.\-]+"


def read(path):
    return path.read_text(encoding='utf-8')


def write(path, text):
    path.write_text(text, encoding='utf-8', newline='')


def stamp(path, version, build):
    text = read(path)
    # static and dynamic imports of local modules: './x.js', '../x.js' (with or without an old ?v=)
    text = re.sub(r"""((?:from\s+|import\s*\(\s*)['"])(\.{1,2}/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])""",
                  lambda m: f"{m.group(1)}{m.group(2)}?v={build}{m.group(3)}", text)
    text = re.sub(rf"(sealed\.json\?v=){STAMP}", rf"\g<1>{build}", text)
    text = re.sub(r"(export const VERSION = ')[^']+(';)", rf"\g<1>{version}\g<2>", text)
    text = re.sub(r"(export const BUILD = ')[^']+(';)", rf"\g<1>{build}\g<2>", text)
    write(path, text)


def main():
    current = re.search(r"export const VERSION = '([^']+)'", read(SETTINGS)).group(1)
    version = sys.argv[1] if len(sys.argv) > 1 else current
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        sys.exit('version attendue : X.Y.Z')
    build = f"{version}-{datetime.now(timezone.utc):%Y%m%d%H%M}"
    for js in (ROOT / 'assets' / 'js').rglob('*.js'):
        stamp(js, version, build)
    for page in (ROOT / 'index.html', ROOT / 'cardvault' / 'index.html'):
        write(page, re.sub(rf"\?v={STAMP}", f"?v={build}", read(page)))
    # "version" holds the build: the app compares it with its own BUILD to know when to reload.
    write(ROOT / 'version.json', json.dumps({'version': build}) + '\n')
    print('version', version, '· build', build)


if __name__ == '__main__':
    main()
