"""
Bundles world_time_buddy into a single standalone HTML file.
Inlines CSS, zones database, self-tests, and application logic.
Works 100% offline and directly via file:/// URL without a web server.
"""
import os, re

WORKSPACE = r"c:\Users\zqiu\Desktop\AI Playground\world_time_buddy"

css_path = os.path.join(WORKSPACE, "style.css")
zones_path = os.path.join(WORKSPACE, "zones.js")
selftest_path = os.path.join(WORKSPACE, "selftest.js")
app_path = os.path.join(WORKSPACE, "app.js")
template_path = os.path.join(WORKSPACE, "index.template.html")
index_path = os.path.join(WORKSPACE, "index.html")

# Always save template if not existing or if it contains module scripts
if not os.path.exists(template_path):
    with open(index_path, "r", encoding="utf-8") as f:
        orig = f.read()
    with open(template_path, "w", encoding="utf-8") as f:
        f.write(orig)

with open(template_path, "r", encoding="utf-8") as f:
    template = f.read()

with open(css_path, "r", encoding="utf-8") as f:
    css_content = f.read()

with open(zones_path, "r", encoding="utf-8") as f:
    zones_content = f.read()

with open(selftest_path, "r", encoding="utf-8") as f:
    selftest_content = f.read()

with open(app_path, "r", encoding="utf-8") as f:
    app_content = f.read()

# Convert selftest.js export to regular function
selftest_inlined = re.sub(r'export\s+async\s+function\s+runSelfTests', 'async function runSelfTests', selftest_content)

# Remove import statement from app.js
app_inlined = re.sub(r"import\s*\{\s*runSelfTests\s*\}\s*from\s*['\"]\.\/selftest\.js['\"];?", "", app_content)

# Replace <link rel="stylesheet" ...> with <style>...</style> using lambda to avoid escape issues
template = re.sub(r'<link\s+rel=["\']stylesheet["\'][^>]*>', lambda m: f'<style>\n{css_content}\n</style>', template)

# Replace scripts with inlined scripts
script_replacement = f"""  <!-- Inlined Windows Zones Database -->
  <script>
{zones_content}
  </script>

  <!-- Inlined DST & Golden Self-Tests -->
  <script>
{selftest_inlined}
  </script>

  <!-- Inlined Application Logic -->
  <script>
{app_inlined}
  </script>"""

template = re.sub(
    r'<!--\s*Load Curated Windows Zones.*?<!--\s*Load Main Application\s*-->\s*<script[^>]*src=["\']app\.js["\'][^>]*></script>',
    lambda m: script_replacement,
    template,
    flags=re.DOTALL
)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(template)

print(f"Successfully created standalone single-file index.html ({len(template):,} bytes)")
