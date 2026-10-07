import re

with open('scratch/clean_site.html', 'r', encoding='utf-8') as f:
    text = f.read()

text_clean = re.sub(r'data:image/[^"\'\s]+', '/site_assets/logo_0.png', text)
with open('scratch/clean_site_no_b64.html', 'w', encoding='utf-8') as f:
    f.write(text_clean)

print('Cleaned file size:', len(text_clean))
