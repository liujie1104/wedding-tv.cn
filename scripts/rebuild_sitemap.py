import os
from datetime import datetime, timedelta, timezone

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"
SITEMAP_PATH = os.path.join(PROJECT_ROOT, "sitemap.xml")
TODAY_STR = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

# Review-mode sitemap:
# keep only durable tool, guide, policy and province pages indexed.
# Programmatic city and insights pages remain crawlable from the site, but are
# intentionally excluded while AdSense is rejecting the site for low-value content.
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
    ("budget-reference.html", "0.85", "monthly"),
    ("mv-style.html", "0.8", "monthly"),
    ("guide.html", "0.9", "monthly"),
    ("guide-livestream.html", "0.85", "monthly"),
    ("wedding-budget-planning-guide.html", "0.9", "monthly"),
    ("wedding-day-timeline-guide.html", "0.9", "monthly"),
    ("wedding-invitation-wording-guide.html", "0.9", "monthly"),
    ("wedding-family-communication-guide.html", "0.9", "monthly"),
    ("blog.html", "0.9", "weekly"),
    ("about.html", "0.7", "monthly"),
    ("editorial-policy.html", "0.7", "monthly"),
    ("privacy.html", "0.7", "monthly"),
    ("terms.html", "0.7", "monthly"),
]

PROVINCE_PAGES = [
    "anhui.html",
    "aomen.html",
    "beijing.html",
    "chongqing.html",
    "fujian.html",
    "gansu.html",
    "guangdong.html",
    "guangxi.html",
    "guizhou.html",
    "hainan.html",
    "hebei.html",
    "heilongjiang.html",
    "henan.html",
    "hubei.html",
    "hunan.html",
    "jiangsu.html",
    "jiangxi.html",
    "jilin.html",
    "liaoning.html",
    "neimenggu.html",
    "ningxia.html",
    "qinghai.html",
    "shaanxi.html",
    "shandong.html",
    "shanghai.html",
    "shanxi.html",
    "sichuan.html",
    "taiwan.html",
    "tianjin.html",
    "xianggang.html",
    "xinjiang.html",
    "xizang.html",
    "yunnan.html",
    "zhejiang.html",
]
def build_urls() -> list[tuple[str, str, str, str]]:
    urls = [
        (f"https://wedding-tv.cn/{path}", TODAY_STR, freq, priority)
        for path, priority, freq in CORE_PAGES
    ]

    blog_dir = os.path.join(PROJECT_ROOT, "blog")
    for filename in PROVINCE_PAGES:
        path = os.path.join(blog_dir, filename)
        if os.path.exists(path):
            urls.append(
                (
                    f"https://wedding-tv.cn/blog/{filename}",
                    TODAY_STR,
                    "monthly",
                    "0.8",
                )
            )
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
