#!/usr/bin/env python3
"""Serve the built blog and keep anonymous UV/PV counters in SQLite."""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sqlite3
from functools import partial
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


COOKIE_NAME = "mini_blog_visitor"


class VisitStore:
	def __init__(self, database_path: Path):
		self.database_path = database_path
		self.database_path.parent.mkdir(parents=True, exist_ok=True)
		with self._connect() as connection:
			connection.execute("PRAGMA journal_mode=WAL")
			connection.execute(
				"CREATE TABLE IF NOT EXISTS visitors "
				"(visitor_id TEXT PRIMARY KEY, first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
			)
			connection.execute(
				"CREATE TABLE IF NOT EXISTS counters "
				"(name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)"
			)
			connection.execute(
				"INSERT OR IGNORE INTO counters(name, value) VALUES ('pageviews', 0)"
			)

	def _connect(self) -> sqlite3.Connection:
		return sqlite3.connect(self.database_path, timeout=10)

	def record_visit(self, visitor_id: str) -> dict[str, int]:
		with self._connect() as connection:
			connection.execute("BEGIN IMMEDIATE")
			connection.execute(
				"INSERT OR IGNORE INTO visitors(visitor_id) VALUES (?)",
				(visitor_id,),
			)
			connection.execute(
				"UPDATE counters SET value = value + 1 WHERE name = 'pageviews'"
			)
			return self._read_stats(connection)

	def get_stats(self) -> dict[str, int]:
		with self._connect() as connection:
			return self._read_stats(connection)

	@staticmethod
	def _read_stats(connection: sqlite3.Connection) -> dict[str, int]:
		visitors = connection.execute("SELECT COUNT(*) FROM visitors").fetchone()[0]
		pageviews = connection.execute(
			"SELECT value FROM counters WHERE name = 'pageviews'"
		).fetchone()[0]
		return {"visitors": int(visitors), "pageviews": int(pageviews)}


class BlogRequestHandler(SimpleHTTPRequestHandler):
	server_version = "MiniBlog/1.0"
	store: VisitStore
	_range_remaining: int | None = None

	def end_headers(self) -> None:
		self.send_header("X-Content-Type-Options", "nosniff")
		self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
		self.send_header("X-Frame-Options", "SAMEORIGIN")
		super().end_headers()

	def do_GET(self) -> None:
		if urlsplit(self.path).path == "/api/stats":
			self._send_json(self.store.get_stats())
			return
		super().do_GET()

	def send_head(self):
		"""Serve static files with single HTTP byte-range support."""
		self._range_remaining = None
		range_header = self.headers.get("Range")
		if not range_header:
			return super().send_head()

		path = Path(self.translate_path(self.path))
		if not path.is_file():
			return super().send_head()

		try:
			file = path.open("rb")
		except OSError:
			self.send_error(HTTPStatus.NOT_FOUND, "File not found")
			return None

		file_size = os.fstat(file.fileno()).st_size
		byte_range = self._parse_byte_range(range_header, file_size)
		if byte_range is None:
			file.close()
			self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
			self.send_header("Content-Range", f"bytes */{file_size}")
			self.send_header("Content-Length", "0")
			self.end_headers()
			return None

		start, end = byte_range
		length = end - start + 1
		self.send_response(HTTPStatus.PARTIAL_CONTENT)
		self.send_header("Content-Type", self.guess_type(str(path)))
		self.send_header("Accept-Ranges", "bytes")
		self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
		self.send_header("Content-Length", str(length))
		self.send_header("Last-Modified", self.date_time_string(path.stat().st_mtime))
		self.end_headers()
		file.seek(start)
		self._range_remaining = length
		return file

	@staticmethod
	def _parse_byte_range(value: str, file_size: int) -> tuple[int, int] | None:
		if file_size <= 0 or not value.startswith("bytes="):
			return None
		spec = value[6:].strip()
		if not spec or "," in spec or "-" not in spec:
			return None

		start_text, end_text = spec.split("-", 1)
		try:
			if not start_text:
				suffix_length = int(end_text)
				if suffix_length <= 0:
					return None
				start = max(0, file_size - suffix_length)
				end = file_size - 1
			else:
				start = int(start_text)
				end = int(end_text) if end_text else file_size - 1
		except ValueError:
			return None

		if start < 0 or start >= file_size or end < start:
			return None
		return start, min(end, file_size - 1)

	def copyfile(self, source, outputfile) -> None:
		if self._range_remaining is None:
			super().copyfile(source, outputfile)
			return

		remaining = self._range_remaining
		while remaining > 0:
			chunk = source.read(min(64 * 1024, remaining))
			if not chunk:
				break
			outputfile.write(chunk)
			remaining -= len(chunk)

	def do_POST(self) -> None:
		if urlsplit(self.path).path != "/api/visit":
			self.send_error(HTTPStatus.NOT_FOUND)
			return
		visitor_id = self._visitor_id_from_cookie()
		is_new = visitor_id is None
		if visitor_id is None:
			visitor_id = secrets.token_urlsafe(24)
		stats = self.store.record_visit(visitor_id)
		cookie = None
		if is_new:
			cookie = (
				f"{COOKIE_NAME}={visitor_id}; Path=/; Max-Age=63072000; "
				"Secure; HttpOnly; SameSite=Lax"
			)
		self._send_json(stats, cookie)

	def _visitor_id_from_cookie(self) -> str | None:
		cookie = SimpleCookie()
		cookie.load(self.headers.get("Cookie", ""))
		morsel = cookie.get(COOKIE_NAME)
		if morsel is None:
			return None
		value = morsel.value
		if not 16 <= len(value) <= 128:
			return None
		return value

	def _send_json(self, value: dict[str, int], cookie: str | None = None) -> None:
		payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
		self.send_response(HTTPStatus.OK)
		self.send_header("Content-Type", "application/json; charset=utf-8")
		self.send_header("Content-Length", str(len(payload)))
		self.send_header("Cache-Control", "no-store")
		if cookie:
			self.send_header("Set-Cookie", cookie)
		self.end_headers()
		self.wfile.write(payload)

	def log_message(self, format: str, *args: object) -> None:
		super().log_message(format, *args)


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("--root", type=Path, required=True)
	parser.add_argument("--data", type=Path, required=True)
	parser.add_argument("--host", default="127.0.0.1")
	parser.add_argument("--port", type=int, default=4322)
	args = parser.parse_args()

	root = args.root.resolve()
	if not (root / "index.html").is_file():
		raise SystemExit(f"Built blog not found at {root}")
	store = VisitStore(args.data.resolve() / "visits.sqlite3")
	BlogRequestHandler.store = store
	handler = partial(BlogRequestHandler, directory=str(root))
	server = ThreadingHTTPServer((args.host, args.port), handler)
	print(f"Serving {root} on http://{args.host}:{args.port}", flush=True)
	server.serve_forever()


if __name__ == "__main__":
	main()
