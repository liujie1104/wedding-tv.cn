import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"

def clean_adsense_tags():
    # Regular expressions for matching
    # 1. Meta verification tag
    meta_pattern = r'(?i)\s*<meta\s+name=["\']google-adsense-account["\']\s+content=["\']ca-pub-6560247681968502["\']\s*/?>'
    
    # 2. AdSense script block in head
    script_pattern = r'(?is)\s*<script\s+async\s+(?:fetchpriority=["\']low["\']\s+)?src=["\']https://pagead2\.googlesyndication\.com/pagead/js/adsbygoogle\.js\?client=ca-pub-6560247681968502["\']\s+crossorigin=["\']anonymous["\']></script>'
    
    # 3. AdSense ins slot and push script block
    slot_pattern1 = r'(?is)\s*<!--\s*AdSense slot[^>]*-->\s*<div class="ad-slot"[^>]*>\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>\s*</div>'
    slot_pattern2 = r'(?is)\s*<div class="ad-slot"[^>]*>\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>\s*</div>'
    slot_pattern3 = r'(?is)\s*<ins class="adsbygoogle"[^>]*></ins>\s*<script>\(adsbygoogle[^<]*</script>'

    cleaned_counts = {
        'news': 0,
        'cities': 0,
        'insights': 0,
        'english': 0
    }

    # Helper function to remove slot blocks
    def remove_ad_slots(html_str):
        html_str = re.sub(slot_pattern1, '', html_str)
        html_str = re.sub(slot_pattern2, '', html_str)
        html_str = re.sub(slot_pattern3, '', html_str)
        return html_str

    # Process news/
    news_dir = os.path.join(PROJECT_ROOT, "news")
    if os.path.exists(news_dir):
        for f in os.listdir(news_dir):
            if f.endswith(".html") and f != "index.html":
                filepath = os.path.join(news_dir, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()
                
                orig = content
                # Remove meta tag
                content = re.sub(meta_pattern, '', content)
                # Remove script tag
                content = re.sub(script_pattern, '', content)
                # Remove slot blocks
                content = remove_ad_slots(content)
                
                if content != orig:
                    with open(filepath, 'w', encoding='utf-8') as file_obj:
                        file_obj.write(content)
                    cleaned_counts['news'] += 1

    # Process blog/cities/
    cities_dir = os.path.join(PROJECT_ROOT, "blog", "cities")
    if os.path.exists(cities_dir):
        for f in os.listdir(cities_dir):
            if f.endswith(".html") and f != "index.html":
                filepath = os.path.join(cities_dir, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()
                
                orig = content
                # For cities, ONLY remove meta verification tag (keep script & slot)
                content = re.sub(meta_pattern, '', content)
                
                if content != orig:
                    with open(filepath, 'w', encoding='utf-8') as file_obj:
                        file_obj.write(content)
                    cleaned_counts['cities'] += 1

    # Process insights/
    insights_dir = os.path.join(PROJECT_ROOT, "insights")
    if os.path.exists(insights_dir):
        for f in os.listdir(insights_dir):
            if f.endswith(".html") and f != "index.html":
                filepath = os.path.join(insights_dir, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()
                
                orig = content
                # For insights, ONLY remove meta verification tag (keep script & slot)
                content = re.sub(meta_pattern, '', content)
                
                if content != orig:
                    with open(filepath, 'w', encoding='utf-8') as file_obj:
                        file_obj.write(content)
                    cleaned_counts['insights'] += 1

    # Process English files (ending with -en.html and specific en stubs)
    en_files = []
    # Find all html files in root
    for f in os.listdir(PROJECT_ROOT):
        if f.endswith(".html") and (f.endswith("-en.html") or f in ["en.html", "tools-en.html", "blog-global-en.html", "about-en.html", "privacy-en.html", "terms-en.html", "guide-en.html", "calculator-en.html", "checklist-en.html", "poster-en.html", "invitation-en.html", "timeline-en.html"]):
            en_files.append(os.path.join(PROJECT_ROOT, f))
    
    # Also find files in blog/ beginning with blog-global-en
    blog_dir = os.path.join(PROJECT_ROOT, "blog")
    if os.path.exists(blog_dir):
        for f in os.listdir(blog_dir):
            if f.endswith(".html") and f.startswith("blog-global-"):
                en_files.append(os.path.join(blog_dir, f))

    for filepath in en_files:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
            content = file_obj.read()
        
        orig = content
        # For English files, remove EVERYTHING Adsense related
        content = re.sub(meta_pattern, '', content)
        content = re.sub(script_pattern, '', content)
        content = remove_ad_slots(content)
        
        if content != orig:
            with open(filepath, 'w', encoding='utf-8') as file_obj:
                file_obj.write(content)
            cleaned_counts['english'] += 1

    print("Cleanup completed successfully!")
    print(f"Cleaned news pages: {cleaned_counts['news']}")
    print(f"Cleaned cities pages: {cleaned_counts['cities']}")
    print(f"Cleaned insights pages: {cleaned_counts['insights']}")
    print(f"Cleaned English pages: {cleaned_counts['english']}")

if __name__ == '__main__':
    clean_adsense_tags()
