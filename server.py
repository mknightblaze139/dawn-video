"""
Dawn video player - local test server.

Run this file in PyCharm (right-click -> Run 'server'), then the player
opens in your browser at http://localhost:8000

Why not just double-click index.html?  Google's IMA ad SDK misbehaves on
file:// pages, and the plain `python -m http.server` can't do "range
requests", so you couldn't seek/skip in the video. This server does both.
Uses only the Python standard library - nothing to install.
"""

import os
import re
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000
FOLDER = os.path.dirname(os.path.abspath(__file__))
VIDEO_FILE = "carrick.mp4"


class RangeRequestHandler(SimpleHTTPRequestHandler):
    """Static file server that supports HTTP Range (needed for video seeking)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FOLDER, **kwargs)

    def send_head(self):
        range_header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not range_header or not os.path.isfile(path):
            return super().send_head()

        match = re.match(r"bytes=(\d*)-(\d*)", range_header)
        size = os.path.getsize(path)
        if not match:
            return super().send_head()

        start_s, end_s = match.groups()
        if start_s:
            start = int(start_s)
            end = int(end_s) if end_s else size - 1
        else:  # suffix range, e.g. "bytes=-500"
            start = max(0, size - int(end_s))
            end = size - 1
        end = min(end, size - 1)

        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        f = open(path, "rb")
        f.seek(start)
        self._remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self._remaining))
        self.end_headers()
        return f

    def copyfile(self, source, outputfile):
        remaining = getattr(self, "_remaining", None)
        if remaining is None:
            return super().copyfile(source, outputfile)
        try:
            while remaining > 0:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # browser stopped loading (normal when seeking)
        finally:
            self._remaining = None

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the PyCharm console readable: only log page/video loads.
        if any(x in self.path for x in (".html", ".mp4", " / ")) or self.path == "/":
            super().log_message(fmt, *args)


def main():
    if not os.path.isfile(os.path.join(FOLDER, VIDEO_FILE)):
        print("=" * 60)
        print(f"  '{VIDEO_FILE}' not found in:\n  {FOLDER}")
        print("  Download it from YouTube Studio (Content -> ... -> Download),")
        print(f"  rename it to {VIDEO_FILE} and put it in this folder.")
        print("  The player will still load, but with no video until then.")
        print("=" * 60)

    url = f"http://localhost:{PORT}/index.html"
    server = ThreadingHTTPServer(("localhost", PORT), RangeRequestHandler)
    print(f"Dawn video player running at {url}")
    print("Press the red Stop button in PyCharm (or Ctrl+C) to stop.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
