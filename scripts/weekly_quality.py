"""Publication gates for reviewed news, not a substitute for editorial source checks."""
from __future__ import annotations

import json
import re
from datetime import date
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


class SkipPublication(Exception):
    """A normal no-op: there is no approved, timely issue to publish."""


class ArticleText(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"}
    SKIP_CLASSES = {"toc", "meta", "action-box", "content-boundary", "weekly-status"}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.parts = []
        self.paragraphs = []
        self.current_paragraph = None
        main = re.search(r"<main\b[^>]*>([\s\S]*?)</main>", html, re.I)
        self.feed(main.group(1) if main else html)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        skip = (any(item[1] for item in self.stack) or tag in {"script", "style", "nav", "footer", "h1"}
                or bool(set(attrs.get("class", "").split()) & self.SKIP_CLASSES))
        if tag not in self.VOID_TAGS:
            self.stack.append((tag, skip))
        if tag in {"p", "li"} and not skip:
            self.current_paragraph = []

    def handle_endtag(self, tag):
        if tag in {"p", "li"} and self.current_paragraph is not None:
            self.paragraphs.append(normalize("".join(self.current_paragraph)))
            self.current_paragraph = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        if not any(item[1] for item in self.stack):
            self.parts.append(data)
            if self.current_paragraph is not None:
                self.current_paragraph.append(data)


def normalize(text):
    return "".join(char for char in text.casefold() if char.isalnum())


def shingles(text):
    return {text[i:i + 5] for i in range(max(0, len(text) - 4))}


def canonical_source(url):
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("News sources must use public HTTPS URLs")
    host = parsed.hostname.lower().removeprefix("www.")
    if host in {"wedding-tv.cn", "localhost", "127.0.0.1"} or "." not in host:
        raise ValueError("News must cite an external primary source")
    query = [(k, v) for k, v in parse_qsl(parsed.query) if not k.lower().startswith("utm_")]
    return urlunsplit(("https", host, parsed.path.rstrip("/"), urlencode(sorted(query)), ""))


def approved_news(topic, publication_date: date, today: date):
    if publication_date != today:
        raise ValueError("New issues must use today's publication date; do not backdate or predate news")
    review = topic.get("review", {})
    if review.get("status") != "approved" or not str(review.get("reviewer", "")).strip():
        raise SkipPublication("稿件尚未完成人工来源审阅")
    reviewed = date.fromisoformat(review.get("reviewed_at", ""))
    if not 0 <= (today - reviewed).days < 7:
        raise SkipPublication("审阅记录已过期，请重新核验来源")
    news = topic.get("news", [])
    if not isinstance(news, list) or not news:
        raise SkipPublication("没有已核验的热点新闻，本期不发布")
    seen_ids, seen_urls = set(), set()
    for item in news:
        event_id = str(item.get("event_id", "")).strip()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{5,99}", event_id):
            raise ValueError("News requires a stable event_id")
        url = canonical_source(item.get("url", ""))
        if event_id in seen_ids or url in seen_urls:
            raise ValueError("Duplicate news event or source within the issue")
        seen_ids.add(event_id)
        seen_urls.add(url)
        if item.get("primary_source") is not True:
            raise ValueError("Each event requires a checked primary source")
        if len(str(item.get("title", "")).strip()) < 5 or len(str(item.get("summary", "")).strip()) < 30:
            raise ValueError("Each event needs a specific title and factual summary")
        published = date.fromisoformat(item.get("published_at", ""))
        verified = date.fromisoformat(item.get("verified_at", ""))
        if not 0 <= (today - published).days < 7:
            raise SkipPublication("没有本周有效的新事件；旧政策与常青指南不充当热点")
        if not published <= verified <= reviewed:
            raise ValueError("Source verification must follow publication and precede editorial approval")
    return news


def news_from_html(html):
    match = re.search(r'<script\b[^>]*id="weekly-news-record"[^>]*>([\s\S]*?)</script>', html)
    return json.loads(match.group(1)) if match else []


def verify_candidate_unique(candidate, published, news=()):
    """Check before writing anything, including against issues after a revised issue."""
    text = ArticleText(candidate)
    body = normalize("".join(text.parts))
    if len(body) < 300:
        raise ValueError("Weekly article body is missing or too short for duplicate checks")
    grams = shingles(body)
    events = {item["event_id"] for item in news}
    sources = {canonical_source(item["url"]) for item in news}
    for name, html in published.items():
        old = ArticleText(html)
        old_body = normalize("".join(old.parts))
        old_grams = shingles(old_body)
        if not old_grams:
            raise ValueError(f"Cannot check published article {name}")
        common = len(grams & old_grams)
        similarity = common / len(grams | old_grams)
        containment = common / min(len(grams), len(old_grams))
        if body == old_body or similarity >= 0.65 or containment >= 0.85:
            raise ValueError(f"Duplicate or near-duplicate weekly body: {name}")
        old_paragraphs = {p for p in old.paragraphs if len(p) >= 100}
        if any(len(p) >= 100 and p in old_paragraphs for p in text.paragraphs):
            raise ValueError(f"Reused long paragraph from {name}; link to the original instead")
        for item in news_from_html(html):
            if item["event_id"] in events or canonical_source(item["url"]) in sources:
                raise ValueError(f"News event already covered by {name}; update that article instead")

