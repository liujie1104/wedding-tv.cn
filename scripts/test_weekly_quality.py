import copy
import hashlib
import json
import re
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import generate_weekly_digest as generator
from weekly_quality import SkipPublication, approved_news, news_from_html, verify_candidate_unique


TODAY = date(2026, 11, 5)


def body(seed):
    return "".join(hashlib.sha256(f"{seed}-{i}".encode()).hexdigest() for i in range(20))


def article(text, title="Example", news=()):
    return (f'<script id="weekly-news-record" type="application/json">{json.dumps(list(news))}</script>'
            f'<main><h1>{title}</h1><h2 id="section-1">Section</h2><p>{text}</p></main>')


def draft():
    return {
        "title": "A specific newly published wedding update",
        "description": "An independent summary of the current event.",
        "review": {"status": "approved", "reviewer": "test reviewer", "reviewed_at": TODAY.isoformat()},
        "news": [{"event_id": "example-new-rule", "title": "A specific event title",
                  "url": "https://source.example/new-rule", "published_at": TODAY.isoformat(),
                  "verified_at": TODAY.isoformat(), "primary_source": True,
                  "summary": "The original institution published a new update with a clearly defined scope."}],
        "highlights": [{"section": "Analysis", "title": "Specific implications", "content": f"<p>{body('new')}</p>"}],
    }


class WeeklyQualityTests(unittest.TestCase):
    def test_recent_reviewed_primary_news_passes(self):
        self.assertEqual(len(approved_news(draft(), TODAY, TODAY)), 1)

    def test_empty_unapproved_and_stale_news_skip(self):
        for modify in (
            lambda d: d.update(news=[]),
            lambda d: d["review"].update(status="draft"),
            lambda d: d["review"].update(reviewer=""),
            lambda d: d["review"].update(reviewed_at=(TODAY - timedelta(days=7)).isoformat()),
            lambda d: d["news"][0].update(published_at=(TODAY - timedelta(days=7)).isoformat()),
        ):
            data = draft()
            modify(data)
            with self.assertRaises(SkipPublication):
                approved_news(data, TODAY, TODAY)

    def test_future_backdated_unverified_and_self_sources_reject(self):
        for modify in (
            lambda d: d["news"][0].update(primary_source=False),
            lambda d: d["news"][0].update(url="https://wedding-tv.cn/blog.html"),
            lambda d: d["news"][0].update(verified_at=(TODAY + timedelta(days=1)).isoformat()),
            lambda d: d["news"][0].update(published_at="invalid"),
        ):
            data = draft()
            modify(data)
            with self.assertRaises(ValueError):
                approved_news(data, TODAY, TODAY)
        for delta in [-1, 1]:
            with self.assertRaises(ValueError):
                approved_news(draft(), TODAY + timedelta(days=delta), TODAY)

    def test_duplicate_event_inside_issue_rejects(self):
        data = draft()
        data["news"].append(copy.deepcopy(data["news"][0]))
        with self.assertRaisesRegex(ValueError, "Duplicate news"):
            approved_news(data, TODAY, TODAY)

    def test_changed_title_and_small_body_edits_do_not_evade_dedup(self):
        old = article(body("original"), title="Old title")
        for text in [body("original"), body("original").replace("a", "b", 3)]:
            with self.assertRaisesRegex(ValueError, "near-duplicate"):
                verify_candidate_unique(article(text, title="A new title and date"), {"old.html": old})

    def test_copied_long_paragraph_is_blocked(self):
        paragraph = body("copied")[:150]
        old = article(body("old") + f"</p><p>{paragraph}")
        new = article(body("new") + f"</p><p>{paragraph}")
        with self.assertRaisesRegex(ValueError, "Reused long paragraph"):
            verify_candidate_unique(new, {"old.html": old})

    def test_new_body_with_previous_event_or_tracking_url_rejects(self):
        event = draft()["news"][0]
        old = article(body("old"), news=[event])
        for change in [{"url": "https://another.example/other"},
                       {"event_id": "another-event", "url": event["url"] + "?utm_source=next"}]:
            candidate_event = {**event, **change}
            with self.assertRaisesRegex(ValueError, "already covered"):
                verify_candidate_unique(article(body("new")), {"old.html": old}, [candidate_event])

    def test_independent_bodies_pass_with_shared_page_chrome(self):
        old = article(body("old"))
        new = article(body("new"))
        verify_candidate_unique(new, {"old.html": old})

    def run_main(self, root, *args):
        with patch.object(generator, "ROOT", root), patch.object(generator, "beijing_today", return_value=TODAY), \
             patch.object(sys, "argv", ["generate_weekly_digest.py", *args]):
            generator.main()

    def test_no_draft_never_rotates_historical_database(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.run_main(root, "--issue", "2")
            self.assertEqual(list(root.iterdir()), [])

    def test_unapproved_and_duplicate_drafts_have_no_file_side_effects(self):
        for state in ["unapproved", "duplicate", "dry-run"]:
            with self.subTest(state=state), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                (root / "wedding-weekly-issue-1.html").write_text(article(body("new" if state == "duplicate" else "old")), "utf-8")
                (root / "weekly-drafts").mkdir()
                data = draft()
                if state == "unapproved":
                    data["review"]["status"] = "draft"
                (root / "weekly-drafts" / "issue-2.json").write_text(json.dumps(data), "utf-8")
                before = {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()}
                if state == "duplicate":
                    with self.assertRaisesRegex(ValueError, "near-duplicate"):
                        self.run_main(root, "--issue", "2")
                else:
                    self.run_main(root, "--issue", "2", *(["--dry-run"] if state == "dry-run" else []))
                self.assertEqual(before, {p.relative_to(root): p.read_bytes() for p in root.rglob("*") if p.is_file()})

    def test_old_guide_cannot_be_repackaged_as_news(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "weekly-drafts").mkdir()
            (root / "weekly-drafts" / "issue-8.json").write_text(json.dumps(draft()), "utf-8")
            (root / "guide.html").write_text('<script>{"@type":"Article"}</script>' + article(body("new")), "utf-8")
            with self.assertRaisesRegex(ValueError, "near-duplicate"):
                self.run_main(root, "--issue", "8")
            self.assertFalse((root / "wedding-weekly-issue-8.html").exists())

    def test_approved_independent_news_publishes_with_visible_source_and_record(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "weekly-drafts").mkdir()
            data = draft()
            data["title"] = 'A newly announced "specific" update'
            (root / "weekly-drafts" / "issue-8.json").write_text(json.dumps(data), "utf-8")
            with patch.object(generator, "update_blog_html"), patch.object(generator.subprocess, "run"):
                self.run_main(root, "--issue", "8")
            html = (root / "wedding-weekly-issue-8.html").read_text("utf-8")
            self.assertIn('href="https://source.example/new-rule"', html)
            self.assertEqual(json.loads(re.search(
                r'<script type="application/ld\+json">([\s\S]*?)</script>', html).group(1))["headline"], data["title"])
            self.assertEqual(news_from_html(html), data["news"])
            self.assertTrue((root / "social_copy" / "issue-8.md").exists())

    def test_archive_revision_preserves_publication_date_and_no_promotion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "wedding-weekly-issue-2.html"
            target.write_text('<script>{"datePublished": "2026-09-30"}</script>' + article(body("old")), "utf-8")
            with patch.object(generator, "update_blog_html"), patch.object(generator.subprocess, "run"), \
                 patch.object(generator, "generate_social_copy") as promotion:
                self.run_main(root, "--issue", "2", "--revise")
            revised = target.read_text("utf-8")
            self.assertIn('"datePublished": "2026-09-30"', revised)
            self.assertIn('"dateModified": "2026-11-05"', revised)
            self.assertIn("户口簿不再是结婚登记所需证件", revised)
            promotion.assert_not_called()

    def test_existing_issue_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "wedding-weekly-issue-2.html"
            target.write_text("existing issue", "utf-8")
            self.run_main(root, "--issue", "2")
            self.assertEqual(target.read_text("utf-8"), "existing issue")


if __name__ == "__main__":
    unittest.main()
