#!/usr/bin/env python3
"""Local + iPad server for the prototype that never lets browsers cache.

Same as `python3 -m http.server 8080 --bind 0.0.0.0`, but every response is sent with
no-cache headers, so a plain refresh on the iPad / laptop always shows the latest files.

Usage: python3 scripts/serve.py [port]    (default 8080, serves the project folder)
"""
import functools
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print(f"Serving {ROOT} on http://0.0.0.0:{PORT} (no-cache)")
        httpd.serve_forever()
