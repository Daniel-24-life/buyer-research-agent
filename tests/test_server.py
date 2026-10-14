import json
import tempfile
import threading
import unittest
from http.server import HTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from core import Queue
from server import handler


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.server = HTTPServer(('127.0.0.1', 0), handler(Queue(Path(self.tmp.name) / 'test.sqlite')))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.tmp.cleanup()

    def test_unknown_files_and_traversal_are_not_served(self):
        for path in ('/core.py', '/.runtime/demo.sqlite', '/../sample.fake.json'):
            with self.subTest(path=path), self.assertRaises(HTTPError) as caught:
                urlopen(self.base + path)
            self.assertEqual(caught.exception.code, 404)

    def test_foreign_origin_is_refused(self):
        request = Request(self.base + '/api/pause', b'{}',
                          headers={'Content-Type': 'application/json', 'Origin': 'https://foreign.invalid'})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request)
        self.assertEqual(caught.exception.code, 403)

    def test_malformed_json_returns_error(self):
        request = Request(self.base + '/api/enqueue', b'{broken', headers={'Content-Type': 'application/json'})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request)
        self.assertEqual(caught.exception.code, 400)

    def test_state_and_enqueue_are_synthetic(self):
        with urlopen(self.base + '/api/state') as response:
            payload = json.load(response)
        self.assertTrue(payload['synthetic'])
        self.assertEqual(len(payload['records']), 4)
        body = json.dumps({'product': 'demo', 'request_id': 'demo-id'}).encode()
        for _ in range(2):
            with urlopen(Request(self.base + '/api/enqueue', body, headers={'Content-Type': 'application/json'})) as response:
                payload = json.load(response)
            self.assertEqual(len(payload['tasks']), 1)
