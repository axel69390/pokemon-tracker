#!/usr/bin/env python3
"""Stamps a release version everywhere a browser could serve a stale file.

Every module import, the stylesheet, the data catalogue and version.json carry
?v=<version>, so a new release never mixes cached and fresh files (the iOS
home-screen app keeps HTTP-cached files for several minutes).

Usage: python3 tools/release.py 2.2.1
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def stamp(path, version):
    text = path.read_text()
    # static and dynamic imports of local modules: './x.js', '../x.js' (with or without an old ?v=)
    text = re.sub(r"""((?:from\s+|import\s*\(\s*)['"])(\.{1,2}/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])""",
                  lambda m: f"{m.group(1)}{m.group(2)}?v={version}{m.group(3)}", text)
    text = re.sub(r"(sealed\.json\?v=)[0-9.]+", rf"\g<1>{version}", text)
    text = re.sub(r"(export const VERSION = ')[^']+(';)", rf"\g<1>{version}\g<2>", text)
    path.write_text(text)


def main():
    version = sys.argv[1]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        sys.exit('version attendue : X.Y.Z')
    for js in (ROOT / 'assets' / 'js').rglob('*.js'):
        stamp(js, version)
    index = ROOT / 'index.html'
    index.write_text(re.sub(r"\?v=[0-9.]+", f"?v={version}", index.read_text()))
    (ROOT / 'version.json').write_text(json.dumps({'version': version}) + '\n')
    print('version', version, 'appliquée')


if __name__ == '__main__':
    main()
