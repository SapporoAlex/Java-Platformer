"""Local dev server for the game, with caching disabled so edits always show
up on reload.

Usage (from the repo root):  python tools/serve.py [port]
Then open http://localhost:8000/
"""
import http.server
import os
import socket
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class DualStackServer(http.server.ThreadingHTTPServer):
    # Listen on IPv6 *and* IPv4. On Windows "localhost" resolves to ::1
    # first, and an IPv4-only server makes every request wait for that
    # attempt to time out - loading the game took 10+ seconds instead of 1.
    address_family = socket.AF_INET6

    def server_bind(self):
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving on http://localhost:{port}/")
    DualStackServer(("::", port), NoCacheHandler).serve_forever()
