import re

path = r"C:\Users\salman\.gemini\antigravity-ide\brain\4709ef6c-755b-4eb9-ba0e-30633ae94b6f\.system_generated\steps\184\content.md"
with open(path, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

# Remove giant base64 data URLs
html = re.sub(r'data:image/[^"\'\s]+', '[IMAGE_DATA]', html)

# Find CSS styles / colors / classes
styles = re.findall(r'<style[^>]*>(.*?)</style>', html, re.DOTALL)
if styles:
    with open("scratch/site_styles.css", "w", encoding="utf-8") as out:
        out.write("\n\n".join(styles))
    print(f"Wrote {len(styles)} style blocks to scratch/site_styles.css")

# Extract text without HTML
clean_text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
clean_text = re.sub(r'<style[^>]*>.*?</style>', '', clean_text, flags=re.DOTALL)
clean_text = re.sub(r'<[^>]+>', '\n', clean_text)
lines = [l.strip() for l in clean_text.splitlines() if l.strip() and not l.strip().startswith('[IMAGE_DATA]')]

with open("scratch/site_text.txt", "w", encoding="utf-8") as out:
    out.write("\n".join(lines))

print(f"Extracted {len(lines)} lines of text to scratch/site_text.txt")
