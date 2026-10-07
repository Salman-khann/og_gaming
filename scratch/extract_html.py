import re
import os
import base64

source_path = r"C:\Users\salman\.gemini\antigravity-ide\brain\4709ef6c-755b-4eb9-ba0e-30633ae94b6f\.system_generated\steps\184\content.md"

with open(source_path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()

html_start = text.find("<!DOCTYPE html>")
html = text[html_start:]

# Save full clean html without cloudflare scripts
os.makedirs("scratch", exist_ok=True)
os.makedirs("public/site_assets", exist_ok=True)

# Find images
img_pattern = re.compile(r'<img([^>]+)src=["\']([^"\']+)["\']([^>]*)>', re.IGNORECASE)

img_idx = 0
def replace_img(match):
    global img_idx
    prefix = match.group(1)
    src = match.group(2)
    suffix = match.group(3)
    if src.startswith("data:image"):
        header, b64_data = src.split(",", 1)
        ext = "png"
        if "jpeg" in header or "jpg" in header:
            ext = "jpg"
        elif "webp" in header:
            ext = "webp"
        elif "svg" in header:
            ext = "svg"
        filename = f"logo_{img_idx}.{ext}" if img_idx == 0 else f"img_{img_idx}.{ext}"
        filepath = os.path.join("public/site_assets", filename)
        with open(filepath, "wb") as f_img:
            f_img.write(base64.b64decode(b64_data))
        print(f"Extracted image {img_idx}: /site_assets/{filename}")
        img_idx += 1
        return f'<img{prefix}src="/site_assets/{filename}"{suffix}>'
    return match.group(0)

clean_html = img_pattern.sub(replace_img, html)

with open("scratch/clean_site.html", "w", encoding="utf-8") as f_out:
    f_out.write(clean_html)

print(f"Total images extracted: {img_idx}")
print("Saved clean HTML to scratch/clean_site.html")
