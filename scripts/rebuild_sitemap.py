import os
import subprocess
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"
SITEMAP_PATH = os.path.join(PROJECT_ROOT, "sitemap.xml")
TODAY_STR = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

# Review-mode sitemap:
# keep only durable tools, reviewed guides and policy pages indexed.
# Programmatic city, regional customs and insights pages are intentionally
# excluded while their sources and editorial scope are being reviewed.
CORE_PAGES = [
    ("", "1.0", "daily"),
    ("ai-planner.html", "0.95", "weekly"),
    ("invitation.html", "0.95", "weekly"),
    ("poster.html", "0.9", "weekly"),
    ("qr-poster.html", "0.85", "monthly"),
    ("almanac.html", "0.85", "monthly"),
    ("timeline.html", "0.9", "weekly"),
    ("timeline-templates.html", "0.85", "monthly"),
    ("playlist.html", "0.85", "monthly"),
    ("vows.html", "0.9", "weekly"),
    ("speech.html", "0.9", "weekly"),
    ("checklist.html", "0.9", "weekly"),
    ("countdown.html", "0.85", "monthly"),
    ("calculator.html", "0.9", "weekly"),
    ("quote-comparison.html", "0.95", "weekly"),
    ("emergency-plan-generator.html", "0.95", "weekly"),
    ("mv-style.html", "0.8", "monthly"),
    ("guide.html", "0.9", "monthly"),
    ("guide-livestream.html", "0.85", "monthly"),
    ("wedding-budget-planning-guide.html", "0.9", "monthly"),
    ("wedding-day-timeline-guide.html", "0.9", "monthly"),
    ("wedding-invitation-wording-guide.html", "0.9", "monthly"),
    ("wedding-family-communication-guide.html", "0.9", "monthly"),
    ("wedding-vendor-contract-guide.html", "0.9", "monthly"),
    ("wedding-photo-video-delivery-guide.html", "0.9", "monthly"),
    ("wedding-live-stream-technical-guide.html", "0.9", "monthly"),
    ("wedding-emergency-plan-guide.html", "0.9", "monthly"),
    ("wedding-customs-verification-guide.html", "0.9", "monthly"),
    ("wedding-budget-scenarios-case.html", "0.9", "monthly"),
    ("wedding-quote-comparison-case.html", "0.9", "monthly"),
    ("outdoor-wedding-emergency-case.html", "0.9", "monthly"),
    ("tool-methodology.html", "0.8", "monthly"),
    ("blog.html", "0.9", "weekly"),
    ("about.html", "0.7", "monthly"),
    ("editorial-policy.html", "0.7", "monthly"),
    ("authors.html", "0.7", "monthly"),
    ("privacy.html", "0.7", "monthly"),
    ("terms.html", "0.7", "monthly"),
]

def last_modified(relative_path: str) -> str:
    working_tree = subprocess.run(
        ["git", "status", "--porcelain", "--", relative_path],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    if working_tree.stdout.strip():
        return TODAY_STR

    result = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", relative_path],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    return result.stdout.strip() or TODAY_STR


def build_urls() -> list[tuple[str, str, str, str]]:
    urls = [
        (
            f"https://wedding-tv.cn/{path}",
            last_modified(path or "index.html"),
            freq,
            priority,
        )
        for path, priority, freq in CORE_PAGES
    ]

    return urls
def main() -> None:
    urls = build_urls()
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, lastmod, freq, priority in urls:
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{loc}</loc>")
        xml_lines.append(f"    <lastmod>{lastmod}</lastmod>")
        xml_lines.append(f"    <changefreq>{freq}</changefreq>")
        xml_lines.append(f"    <priority>{priority}</priority>")
        xml_lines.append("  </url>")
    xml_lines.append("</urlset>")

    with open(SITEMAP_PATH, "w", encoding="utf-8") as handle:
        handle.write("\n".join(xml_lines) + "\n")

    print(f"Rebuilt sitemap.xml with {len(urls)} review-mode entries.")
if __name__ == "__main__":
    main()
