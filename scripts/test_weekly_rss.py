import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch

import rss_builder


class WeeklyRssTests(unittest.TestCase):
    def test_revision_uses_original_publication_date_not_rebuild_time(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "archive.html").write_text(
                '<script type="application/ld+json">{"datePublished":"2026-09-30",'
                '"dateModified":"2026-11-05"}</script>', "utf-8")
            with patch.object(rss_builder, "ROOT", root):
                self.assertEqual(rss_builder.publication_date(rss_builder.SITE + "/archive.html"),
                                 "Tue, 29 Sep 2026 16:00:00 +0000")

    def test_undated_item_preserves_prior_date_or_omits_it(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(rss_builder, "ROOT", Path(tmp)):
            self.assertEqual(rss_builder.publication_date(rss_builder.SITE + "/missing.html", "old date"), "old date")
            self.assertIsNone(rss_builder.publication_date(rss_builder.SITE + "/missing.html"))

    def test_rss_escaping_and_rebuild_do_not_republish_items(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            feed = root / "rss.xml"
            item = {"title": "Title & quote", "desc": "A < B & C", "link": rss_builder.SITE + "/undated.html"}
            with patch.object(rss_builder, "ROOT", root), patch.object(rss_builder, "RSS", feed), \
                 patch.object(rss_builder, "get_all_items", return_value=[item]):
                rss_builder.build_rss()
                rss_builder.build_rss()
            items = ET.parse(feed).findall("./channel/item")
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0].findtext("title"), item["title"])
            self.assertEqual(items[0].findtext("description"), item["desc"])
            self.assertIsNone(items[0].find("pubDate"))


if __name__ == "__main__":
    unittest.main()
