#!/usr/bin/env python3
"""Local-only Forge Viewer; serves SVF archives without extracting them."""
import argparse
import json
import mimetypes
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit, quote
from zipfile import ZipFile, BadZipFile

ROOT = Path(__file__).resolve().parent


def catalog():
    models = []
    for path in sorted((ROOT / 'BIM').glob('*.svfzip')):
        try:
            with ZipFile(path) as archive:
                for entry in archive.namelist():
                    if entry.lower().endswith(('.svf', '.f2d')):
                        models.append({'name': path.stem, 'entry': entry,
                                       'size': path.stat().st_size,
                                       'url': '/models/' + quote(path.name, safe='') + '/' + quote(entry)})
        except (BadZipFile, OSError):
            continue
    return models


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enforce disconnected operation, including SDK analytics and extensions.
        self.send_header('Content-Security-Policy', "default-src 'self' blob: data:; script-src 'self' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; worker-src 'self' blob:; frame-ancestors 'none'")
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

    def do_GET(self):
        self.serve(False)

    def do_HEAD(self):
        self.serve(True)

    def serve(self, head):
        path = unquote(urlsplit(self.path).path)
        try:
            if path in ('/api/models', '/models.json'):
                return self.reply(json.dumps(catalog(), ensure_ascii=False).encode(), 'application/json; charset=utf-8', head)
            if path.startswith('/models/'):
                parts = path.split('/', 3)
                if len(parts) != 4 or Path(parts[2]).name != parts[2] or not parts[2].endswith('.svfzip'):
                    return self.send_error(404)
                entry = parts[3]
                if '..' in PurePosixPath(entry).parts or entry.startswith('/'):
                    return self.send_error(404)
                with ZipFile(ROOT / 'BIM' / parts[2]) as archive:
                    data = archive.read(entry)
                return self.reply(data, mimetypes.guess_type(entry)[0] or 'application/octet-stream', head)
            if path in ('/', '/index.html'):
                file = ROOT / 'web/index.html'
            elif path.startswith('/forge-viewer/') or path.startswith('/web/'):
                file = (ROOT / path.lstrip('/')).resolve()
                allowed = ROOT / ('forge-viewer' if path.startswith('/forge-viewer/') else 'web')
                if not file.is_relative_to(allowed) or not file.is_file():
                    return self.send_error(404)
            else:
                return self.send_error(404)
            return self.reply(file.read_bytes(), mimetypes.guess_type(str(file))[0] or 'application/octet-stream', head)
        except (OSError, KeyError, BadZipFile):
            self.send_error(404, 'Local resource not found')

    def reply(self, data, content_type, head):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        if not head:
            self.wfile.write(data)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Forge Viewer: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
