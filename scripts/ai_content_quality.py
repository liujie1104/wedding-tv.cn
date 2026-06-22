#!/usr/bin/env python3
"""
Audit static pages with Bailian/DashScope before publishing.

Usage:
  set DASHSCOPE_API_KEY=...
  python scripts/ai_content_quality.py index.html ai-planner.html guide.html

Optional:
  BAILIAN_BASE_URL=https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
  BAILIAN_MODEL=qwen-plus
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DEFAULT_MODEL = "qwen-plus"


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.skip:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


def extract_text(path: Path) -> str:
    parser = TextExtractor()
    parser.feed(path.read_text(encoding="utf-8", errors="ignore"))
    text = "\n".join(parser.parts)
    return re.sub(r"\n{3,}", "\n\n", text)[:12000]


def call_bailian(key: str, base_url: str, model: str, page: str, text: str) -> dict:
    prompt = {
        "role": "user",
        "content": (
            "请以 Google AdSense 审核、SEO 点击率和用户价值为标准，审查下面页面。"
            "只输出 JSON，不要 Markdown。字段：score(0-100), risk_level(low/medium/high), "
            "indexable(true/false), title_advice, description_advice, issues(数组), improvements(数组)。\n\n"
            f"文件：{page}\n\n页面文本：\n{text}"
        ),
    }
    body = json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "你是严谨的网站内容质量审核员，输出必须是可解析 JSON。",
                },
                prompt,
            ],
            "temperature": 0.2,
            "max_tokens": 1200,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=body,
        headers={
            "authorization": f"Bearer {key}",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    raw = data["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```json|```$", "", raw, flags=re.I | re.M).strip()
    return json.loads(raw)


def main() -> int:
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        print("DASHSCOPE_API_KEY is required", file=sys.stderr)
        return 2

    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        paths = [Path("index.html"), Path("ai-planner.html"), Path("guide.html"), Path("invitation.html")]

    base_url = os.environ.get("BAILIAN_BASE_URL", DEFAULT_BASE_URL)
    model = os.environ.get("BAILIAN_MODEL", DEFAULT_MODEL)
    results = []

    for path in paths:
        if not path.exists() or path.suffix.lower() != ".html":
            continue
        text = extract_text(path)
        result = call_bailian(key, base_url, model, str(path), text)
        result["file"] = str(path)
        results.append(result)
        print(json.dumps(result, ensure_ascii=False))

    high_risk = [r for r in results if r.get("risk_level") == "high" or int(r.get("score", 0)) < 60]
    return 1 if high_risk else 0


if __name__ == "__main__":
    raise SystemExit(main())
