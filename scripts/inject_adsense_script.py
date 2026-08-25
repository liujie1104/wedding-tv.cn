import os
import re

PROJECT_ROOT = r"d:\Liu JIE\wedding-tv.cn"

def inject_adsense_script():
    script_tag = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560247681968502" crossorigin="anonymous"></script>'
    exclude_files = {'404.html', 'i.html', 'live.html', 'google4fc1865e51bc4f82.html'}

    injected_count = 0
    for root_dir, _, files in os.walk(PROJECT_ROOT):
        if '.git' in root_dir or '.gemini' in root_dir or 'node_modules' in root_dir:
            continue
        for f in files:
            if f.endswith('.html') and f not in exclude_files:
                filepath = os.path.join(root_dir, f)
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as file_obj:
                    content = file_obj.read()

                if 'pagead2.googlesyndication.com' not in content:
                    if '</head>' in content:
                        content = content.replace('</head>', f'  {script_tag}\n</head>')
                        with open(filepath, 'w', encoding='utf-8') as file_obj:
                            file_obj.write(content)
                        injected_count += 1
                        print(f"Injected AdSense script to: {os.path.relpath(filepath, PROJECT_ROOT)}")

    print(f"Total AdSense scripts injected: {injected_count}")

if __name__ == '__main__':
    inject_adsense_script()
