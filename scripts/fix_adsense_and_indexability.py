import os
import re
import xml.etree.ElementTree as ET

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"

def fix_all():
    meta_tag_str = '<meta name="google-adsense-account" content="ca-pub-6560247681968502" />'
    script_tag_str = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>'
    
    meta_pattern = re.compile(r'\s*<meta\s+name=["\']google-adsense-account["\']\s+content=["\']ca-pub-6560247681968502["\']\s*/?>', re.IGNORECASE)
    script_pattern = re.compile(r'<script\s+async\s+(?:fetchpriority=["\']low["\']\s+)?src=["\']https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js\?client=ca-pub-6560247681968502["\']\s+crossorigin=["\']anonymous["\']></script>', re.IGNORECASE)
    robots_noindex_pattern = re.compile(r'<meta\s+name=["\']robots["\']\s+content=["\']noindex,\s*follow["\']\s*/?>', re.IGNORECASE)

    # Pages that should remain noindex (internal/error pages)
    noindex_pages = {'404.html', 'i.html', 'live.html'}

    fixed_robots_count = 0
    cleaned_meta_count = 0
    added_script_count = 0

    for root_dir, _, files in os.walk(PROJECT_ROOT):
        if '.git' in root_dir or '.gemini' in root_dir or 'node_modules' in root_dir:
            continue
        for f in files:
            if f.endswith('.html'):
                filepath = os.path.join(root_dir, f)
                rel_path = os.path.relpath(filepath, PROJECT_ROOT).replace('\\', '/')

                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()

                orig = content
                is_homepage = (rel_path == 'index.html')
                is_noindex_page = (rel_path in noindex_pages)

                # 1. Fix Robots Meta Tag
                # If it's a city article, insights article, blog page, or tool page (not in noindex_pages), set to index,follow
                if not is_noindex_page and robots_noindex_pattern.search(content):
                    content = robots_noindex_pattern.sub('<meta name="robots" content="index,follow" />', content)
                    fixed_robots_count += 1

                # 2. Fix AdSense Meta & Script Tags
                if is_homepage:
                    # Homepage MUST have meta verification tag AND script tag
                    if not meta_pattern.search(content):
                        content = content.replace('</head>', f'  {meta_tag_str}\n</head>')
                    if not script_pattern.search(content):
                        content = content.replace('</head>', f'  {script_tag_str}\n</head>')
                elif is_noindex_page:
                    # Noindex internal pages: strip meta and script
                    content = meta_pattern.sub('', content)
                    content = script_pattern.sub('', content)
                else:
                    # Subpages: strip meta verification tag
                    if meta_pattern.search(content):
                        content = meta_pattern.sub('', content)
                        cleaned_meta_count += 1
                    # Subpages: add script tag for AdSense rendering
                    if not script_pattern.search(content):
                        content = content.replace('</head>', f'  {script_tag_str}\n</head>')
                        added_script_count += 1

                if content != orig:
                    with open(filepath, 'w', encoding='utf-8') as file_obj:
                        file_obj.write(content)

    print("Indexability & AdSense normalization complete:")
    print(f"- Changed robots tag to 'index,follow' on {fixed_robots_count} articles/pages.")
    print(f"- Cleaned meta verification tags from {cleaned_meta_count} subpages.")
    print(f"- Ensured AdSense script tag on {added_script_count} pages.")

if __name__ == '__main__':
    fix_all()
