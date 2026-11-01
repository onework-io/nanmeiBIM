#!/usr/bin/env python3
"""Build a portable static site from the bundled Viewer and SVF archives."""
import json
import shutil
import sys
from pathlib import Path, PurePosixPath
from urllib.parse import quote
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist'

def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ROOT / 'web', OUT / 'web')
    shutil.copyfile(ROOT / 'web/index.html', OUT / 'index.html')
    (OUT / 'web/index.html').unlink()
    shutil.copytree(ROOT / 'forge-viewer', OUT / 'forge-viewer')
    models = []
    for archive_path in sorted((ROOT / 'BIM').glob('*.svfzip')):
        with ZipFile(archive_path) as archive:
            entries = [n for n in archive.namelist() if n.lower().endswith(('.svf', '.f2d'))]
            if not entries:
                raise ValueError(f'No model entry in {archive_path.name}')
            for info in archive.infolist():
                relative = PurePosixPath(info.filename)
                if relative.is_absolute() or '..' in relative.parts or '\\' in info.filename:
                    raise ValueError(f'Unsafe archive path: {info.filename}')
                # Export model data only; do not publish bundled demo pages or scripts.
                if info.is_dir() or relative.suffix.lower() in {'.html', '.htm', '.js'}:
                    continue
                target = OUT / 'models' / archive_path.name / info.filename
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(info))
            for entry in entries:
                models.append({'name': archive_path.stem, 'entry': entry,
                               'size': archive_path.stat().st_size,
                               'url': 'models/' + quote(archive_path.name, safe='') + '/' + quote(entry)})
    if not models:
        raise ValueError('No models found')
    (OUT / 'models.json').write_text(json.dumps(models, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / '.nojekyll').touch()
    print(f'Built {len(models)} models in {OUT}')

if __name__ == '__main__':
    build()
