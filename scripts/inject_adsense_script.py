import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"

def verify_adsense_meta():
    meta_tag = '<meta name="google-adsense-account" content="ca-pub-6560247681968502" />'
    exclude_files = {'404.html', 'i.html', 'live.html', 'google4fc1865e51bc4f82.html'}

    count = 0
    for root_dir, _, files in os.walk(PROJECT_ROOT):
        if '.git' in root_dir or '.gemini' in root_dir or 'node_modules' in root_dir:
            continue
        for f in files:
            if f.endswith('.html') and f not in exclude_files:
                filepath = os.path.join(root_dir, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()

                # Clean any stray ad scripts
                clean_content = re.sub(r'<script\s+async\s+src=["\']https://pagead2\.googlesyndication\.com/[^"\']*["\'][^>]*></script>', '', content)
                if 'google-adsense-account' not in clean_content and '</head>' in clean_content:
                    clean_content = clean_content.replace('</head>', f'  {meta_tag}\n</head>')
                
                if clean_content != content:
                    with open(filepath, 'w', encoding='utf-8') as file_obj:
                        file_obj.write(clean_content)
                    count += 1

    print(f"Verified AdSense meta and cleaned scripts across: {count} files")

if __name__ == '__main__':
    verify_adsense_meta()
