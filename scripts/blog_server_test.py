import tempfile
import unittest
from pathlib import Path

from scripts.blog_server import BlogRequestHandler, VisitStore


class VisitStoreTest(unittest.TestCase):
	def test_counts_unique_visitors_and_every_pageview(self):
		with tempfile.TemporaryDirectory() as directory:
			store = VisitStore(Path(directory) / "visits.sqlite3")

			self.assertEqual(
				store.record_visit("visitor-a"),
				{"visitors": 1, "pageviews": 1},
			)
			self.assertEqual(
				store.record_visit("visitor-a"),
				{"visitors": 1, "pageviews": 2},
			)
			self.assertEqual(
				store.record_visit("visitor-b"),
				{"visitors": 2, "pageviews": 3},
			)
			self.assertEqual(store.get_stats(), {"visitors": 2, "pageviews": 3})


class ByteRangeTest(unittest.TestCase):
	def test_parses_bounded_open_and_suffix_ranges(self):
		parse = BlogRequestHandler._parse_byte_range
		self.assertEqual(parse("bytes=0-1023", 5000), (0, 1023))
		self.assertEqual(parse("bytes=4500-", 5000), (4500, 4999))
		self.assertEqual(parse("bytes=-500", 5000), (4500, 4999))

	def test_rejects_invalid_or_multiple_ranges(self):
		parse = BlogRequestHandler._parse_byte_range
		self.assertIsNone(parse("bytes=5000-", 5000))
		self.assertIsNone(parse("bytes=20-10", 5000))
		self.assertIsNone(parse("bytes=0-10,20-30", 5000))


if __name__ == "__main__":
	unittest.main()
