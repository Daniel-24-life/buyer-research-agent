"""Serve synthetic records and a local queue on loopback only."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from core import Queue, load_demo

ROOT = Path(__file__).parent


def handler(queue):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, body, mime='application/json; charset=utf-8'):
            if not isinstance(body, bytes):
                body = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == '/api/state':
                self.reply(200, {**queue.state(), **load_demo()})
                return
            files = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'),
                     '/styles.css': ('styles.css', 'text/css')}
            if self.path not in files:
                self.reply(404, {'error': 'not found'})
                return
            name, mime = files[self.path]
            self.reply(200, (ROOT / 'dist' / name).read_bytes(), mime + '; charset=utf-8')

        def do_POST(self):
            # Browser writes are same-origin JSON. A third-party page cannot enqueue work.
            if self.headers.get('Content-Type') != 'application/json':
                self.reply(415, {'error': 'JSON required'})
                return
            origin = self.headers.get('Origin')
            if origin and origin != f'http://127.0.0.1:{self.server.server_port}':
                self.reply(403, {'error': 'origin refused'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 4096:
                    raise ValueError('invalid request size')
                data = json.loads(self.rfile.read(length))
                if self.path == '/api/enqueue':
                    product = data.get('product', '').strip()
                    request_id = data.get('request_id', '')
                    if not product or len(product) > 120 or not isinstance(request_id, str) or not 1 <= len(request_id) <= 100:
                        raise ValueError('product and request_id required')
                    queue.enqueue(request_id, product)
                elif self.path == '/api/pause':
                    queue.pause(True)
                elif self.path == '/api/resume':
                    queue.pause(False)
                elif self.path == '/api/next':
                    queue.run_next()
                elif self.path == '/api/cancel':
                    queue.cancel(int(data['id']))
                else:
                    self.reply(404, {'error': 'not found'})
                    return
                self.reply(200, {**queue.state(), **load_demo()})
            except (ValueError, TypeError, KeyError, AttributeError) as error:
                self.reply(400, {'error': str(error)})
    return Handler


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4182)
    args = parser.parse_args()
    runtime = ROOT / '.runtime'
    runtime.mkdir(exist_ok=True)
    server = HTTPServer(('127.0.0.1', args.port), handler(Queue(runtime / 'demo.sqlite')))
    print(f'Offline demo: http://127.0.0.1:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
