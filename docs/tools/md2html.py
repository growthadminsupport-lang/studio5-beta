"""
Markdown -> print-ready HTML for the manual and the report. Then: node html2pdf.mjs <html> <pdf> "<title>".

    python md2html.py ../manual/user-manual.md /tmp/user-manual.pdf   # writes /tmp/user-manual.html
"""
import sys, markdown, pathlib
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2])
import re
text = src.read_text()
# Python-Markdown needs a blank line before a list; GitHub does not. Add one where missing.
lines = text.split('\n'); fixed = []
for i, l in enumerate(lines):
    if re.match(r'^(\s*)(- |\d+\. )', l) and fixed and fixed[-1].strip() and not re.match(r'^(\s*)(- |\d+\. )', fixed[-1]) and not fixed[-1].startswith('  ') and not fixed[-1].startswith('|'):
        fixed.append('')
    # Python-Markdown nests a list only at four spaces; GitHub accepts two.
    m = re.match(r'^( {2,3})(- |\d+\. )', l)
    if m:
        l = '    ' + l[len(m.group(1)):]
    fixed.append(l)
body = markdown.markdown('\n'.join(fixed), extensions=['tables', 'toc', 'sane_lists'])
css = """
@page { size: A4; margin: 18mm 16mm; }
body { font-family: 'Noto Sans', 'DejaVu Sans', sans-serif; font-size: 10.5pt; line-height: 1.5; color: #0f172a; }
h1 { color: #056559; font-size: 22pt; margin: 0 0 6pt; }
h2 { color: #056559; font-size: 15pt; margin-top: 18pt; border-bottom: 1px solid #cbd5e1; padding-bottom: 3pt; page-break-after: avoid; }
h3 { font-size: 12pt; margin-top: 12pt; page-break-after: avoid; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #eaf6f3; }
img { max-width: 100%; max-height: 120mm; display: block; margin: 8pt auto; border: 1px solid #e2e8f0; border-radius: 6px; page-break-inside: avoid; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #f2fbf9; border-left: 3px solid #056559; }
code { font-size: 9pt; background: #f1f5f9; padding: 0 3px; border-radius: 3px; }
hr { border: 0; border-top: 1px solid #e2e8f0; margin: 12pt 0; }
a { color: #056559; text-decoration: none; }
"""
html = f"<!doctype html><html><head><meta charset='utf-8'><base href='{src.parent.resolve().as_uri()}/'><style>{css}</style></head><body>{body}</body></html>"
tmp = out.with_suffix('.html'); tmp.write_text(html)
print(tmp)
