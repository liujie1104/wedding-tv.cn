import os
from datetime import datetime, timezone, timedelta

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"
sitemap_path = os.path.join(PROJECT_ROOT, "sitemap.xml")
today_str = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")

urls = []

# Core tools & main pages
core_pages = [
    ("", "1.0", "daily"),
    ("ai-planner.html", "0.95", "weekly"),
    ("invitation.html", "0.95", "weekly"),
    ("vows.html", "0.9", "weekly"),
    ("speech.html", "0.9", "weekly"),
    ("calculator.html", "0.9", "weekly"),
    ("checklist.html", "0.9", "weekly"),
    ("poster.html", "0.9", "weekly"),
    ("almanac.html", "0.85", "monthly"),
    ("timeline.html", "0.9", "weekly"),
    ("playlist.html", "0.85", "monthly"),
    ("qr-poster.html", "0.85", "monthly"),
    ("countdown.html", "0.85", "monthly"),
    ("mv-style.html", "0.8", "monthly"),
    ("budget-reference.html", "0.85", "monthly"),
    ("guide.html", "0.9", "monthly"),
    ("guide-livestream.html", "0.85", "monthly"),
    ("blog.html", "0.9", "weekly"),
    ("blog/cities/index.html", "0.9", "weekly"),
    ("insights/index.html", "0.85", "weekly"),
]

for p, pri, freq in core_pages:
    urls.append((f"https://wedding-tv.cn/{p}", today_str, freq, pri))

# City guides (72 cities)
cities_dir = os.path.join(PROJECT_ROOT, "blog", "cities")
if os.path.exists(cities_dir):
    for f in sorted(os.listdir(cities_dir)):
        if f.endswith(".html") and f != "index.html":
            urls.append((f"https://wedding-tv.cn/blog/cities/{f}", today_str, "monthly", "0.8"))

# Insights articles (6 articles)
insights_dir = os.path.join(PROJECT_ROOT, "insights")
if os.path.exists(insights_dir):
    for f in sorted(os.listdir(insights_dir)):
        if f.endswith(".html") and f != "index.html":
            urls.append((f"https://wedding-tv.cn/insights/{f}", today_str, "monthly", "0.8"))

# Province blog articles (34 provinces)
blog_dir = os.path.join(PROJECT_ROOT, "blog")
if os.path.exists(blog_dir):
    for f in sorted(os.listdir(blog_dir)):
        if f.endswith(".html") and f != "index.html" and not f.startswith("blog-global-"):
            urls.append((f"https://wedding-tv.cn/blog/{f}", today_str, "monthly", "0.8"))

xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for loc, lastmod, freq, pri in urls:
    xml_lines.append("  <url>")
    xml_lines.append(f"    <loc>{loc}</loc>")
    xml_lines.append(f"    <lastmod>{lastmod}</lastmod>")
    xml_lines.append(f"    <changefreq>{freq}</changefreq>")
    xml_lines.append(f"    <priority>{pri}</priority>")
    xml_lines.append("  </url>")
xml_lines.append("</urlset>")

with open(sitemap_path, "w", encoding="utf-8") as f:
    f.write("\n".join(xml_lines) + "\n")

print(f"Rebuilt sitemap.xml with {len(urls)} entries.")
