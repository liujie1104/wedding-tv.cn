import os, re
from xml.dom import minidom
import xml.etree.ElementTree as ET

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITEMAP_PATH = os.path.join(PROJECT_ROOT, "sitemap.xml")

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
    ("blog/guangdong.html", "0.85", "monthly"),
    ("blog/fujian.html", "0.85", "monthly"),
    ("blog/hunan.html", "0.85", "monthly"),
    ("blog/sichuan.html", "0.85", "monthly"),
    ("blog/zhejiang.html", "0.85", "monthly"),
    ("blog/inner-mongolia.html", "0.85", "monthly"),
    ("blog/gansu.html", "0.85", "monthly"),
    ("blog/qinghai.html", "0.85", "monthly"),
    ("blog/heilongjiang.html", "0.85", "monthly"),
    ("blog/jilin.html", "0.85", "monthly"),
    ("blog/beijing.html", "0.85", "monthly"),
    ("blog/tianjin.html", "0.85", "monthly"),
    ("blog/shanghai.html", "0.85", "monthly"),
    ("blog/chongqing.html", "0.85", "monthly"),
    ("blog/jiangsu.html", "0.85", "monthly"),
    ("blog/hebei.html", "0.85", "monthly"),
    ("blog/shanxi.html", "0.85", "monthly"),
    ("blog/liaoning.html", "0.85", "monthly"),
    ("blog/anhui.html", "0.85", "monthly"),
    ("blog/shandong.html", "0.85", "monthly"),
    ("blog/henan.html", "0.85", "monthly"),
    ("blog/hubei.html", "0.85", "monthly"),
    ("blog/jiangxi.html", "0.85", "monthly"),
    ("blog/shaanxi.html", "0.85", "monthly"),
    ("blog/guizhou.html", "0.85", "monthly"),
    ("blog/hainan.html", "0.85", "monthly"),
    ("blog/yunnan.html", "0.85", "monthly"),
    ("blog/guangxi.html", "0.85", "monthly"),
    ("blog/ningxia.html", "0.85", "monthly"),
    ("blog/xinjiang.html", "0.85", "monthly"),
    ("blog/tibet.html", "0.85", "monthly"),
    ("blog/taiwan.html", "0.85", "monthly"),
    ("blog/hong-kong.html", "0.85", "monthly"),
    ("blog/macao.html", "0.85", "monthly"),
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

EXPLICIT_CORE_DATES = {
    "": "2026-08-27",
    "about.html": "2026-08-26",
    "terms.html": "2026-09-01",
    "editorial-policy.html": "2026-08-27",
    "authors.html": "2026-08-28",
    "privacy.html": "2026-09-01",
    "ai-planner.html": "2026-08-26",
    "invitation.html": "2026-08-26",
    "poster.html": "2026-08-26",
    "qr-poster.html": "2026-08-26",
    "almanac.html": "2026-08-26",
    "timeline.html": "2026-08-26",
    "timeline-templates.html": "2026-08-26",
    "playlist.html": "2026-08-26",
    "vows.html": "2026-08-27",
    "speech.html": "2026-08-27",
    "checklist.html": "2026-08-27",
    "countdown.html": "2026-08-26",
    "calculator.html": "2026-08-26",
    "quote-comparison.html": "2026-08-26",
    "emergency-plan-generator.html": "2026-08-26",
    "mv-style.html": "2026-08-26",
    "guide.html": "2026-08-26",
    "guide-livestream.html": "2026-08-26",
    "wedding-budget-planning-guide.html": "2026-08-26",
    "wedding-day-timeline-guide.html": "2026-08-26",
    "wedding-invitation-wording-guide.html": "2026-08-26",
    "wedding-family-communication-guide.html": "2026-08-26",
    "wedding-vendor-contract-guide.html": "2026-08-26",
    "wedding-photo-video-delivery-guide.html": "2026-08-26",
    "wedding-live-stream-technical-guide.html": "2026-08-26",
    "wedding-emergency-plan-guide.html": "2026-08-26",
    "wedding-customs-verification-guide.html": "2026-08-26",
    "wedding-budget-scenarios-case.html": "2026-08-26",
    "wedding-quote-comparison-case.html": "2026-08-26",
    "outdoor-wedding-emergency-case.html": "2026-08-26",
    "tool-methodology.html": "2026-08-26",
    "blog.html": "2026-08-28"
}

def extract_html_date(rel_path: str) -> str:
    target_rel = "index.html" if not rel_path else rel_path
    fpath = os.path.join(PROJECT_ROOT, target_rel.replace("/", os.sep))
    if not os.path.exists(fpath):
        return EXPLICIT_CORE_DATES.get(rel_path, "2026-08-26")
    with open(fpath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # 1. Check JSON-LD dateModified
    m = re.search(r'"dateModified":\s*"(\d{4}-\d{2}-\d{2})"', content)
    if m:
        return m.group(1)
    
    # 2. Check visible update date
    m2 = re.search(r'(?:更新时间|最近更新|更新|最后更新)[：:]\s*(\d{4})[年-](\d{1,2})[月-](\d{1,2})', content)
    if m2:
        return f"{m2.group(1)}-{int(m2.group(2)):02d}-{int(m2.group(3)):02d}"
    
    return EXPLICIT_CORE_DATES.get(rel_path, "2026-08-26")

def build_sitemap():
    urlset = ET.Element("urlset")
    urlset.set("xmlns", "http://www.sitemaps.org/schemas/sitemap/0.9")

    for rel_path, priority, freq in CORE_PAGES:
        url_el = ET.SubElement(urlset, "url")
        loc_el = ET.SubElement(url_el, "loc")
        loc_el.text = f"https://wedding-tv.cn/{rel_path}"

        lastmod_el = ET.SubElement(url_el, "lastmod")
        lastmod_el.text = extract_html_date(rel_path)

        changefreq_el = ET.SubElement(url_el, "changefreq")
        changefreq_el.text = freq

        priority_el = ET.SubElement(url_el, "priority")
        priority_el.text = priority

    xml_str = ET.tostring(urlset, encoding="utf-8")
    parsed = minidom.parseString(xml_str)
    pretty_xml = parsed.toprettyxml(indent="  ", encoding="utf-8").decode("utf-8")

    # Remove extra blank lines
    lines = [line for line in pretty_xml.splitlines() if line.strip()]
    final_xml = "\n".join(lines) + "\n"

    with open(SITEMAP_PATH, "w", encoding="utf-8") as f:
        f.write(final_xml)

    print(f"Sitemap rebuilt successfully with {len(CORE_PAGES)} URLs.")

if __name__ == "__main__":
    build_sitemap()
