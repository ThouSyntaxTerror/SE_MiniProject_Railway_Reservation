"""Render the Part 3 test reports and the SRS validation report (markdown in docs/) as numbered PDFs next to deliverables 01-05.

    pip install markdown selenium
    python scripts/renderReports.py

Each PDF is the same text as its markdown source, so the two cannot drift: edit the markdown, then
re-run this. Relative links are rewritten to the GitHub copy of the file so they still work inside a
PDF, and images are embedded. Uses headless Chrome's own print-to-PDF.
"""
import base64
import datetime as dt
import os
import re

import markdown
from selenium import webdriver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, 'docs')
GITHUB = 'https://github.com/ThouSyntaxTerror/SE_MiniProject_Railway_Reservation/blob/main/'
AUTHOR = 'Prepared by Muhammad Affan Dumba (PES1UG24CS280) · Team E15 · Railway Reservation System'

REPORTS = [
    {
        'out': '06_Unit_Test_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf',
        'title': 'Unit Test Report',
        'sources': ['UNIT_TEST_REPORT.md', 'FRONTEND_TEST_REPORT.md'],
        'images': [],
    },
    {
        'out': '07_System_Test_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf',
        'title': 'System Test Report',
        'sources': ['SYSTEM_TEST_REPORT.md'],
        'images': [
            ('evidence/system-test/1-search-results.png', 'UI flow 1: search results for Bengaluru → Chennai'),
            ('evidence/system-test/2-booked-banner.png', 'UI flow 2: booking confirmed with PNR'),
            ('evidence/system-test/3-my-bookings-confirmed.png', 'UI flow 3: My bookings, booking confirmed'),
            ('evidence/system-test/4-cancelled-refund.png', 'UI flow 4: cancelled, refund reference shown'),
            ('evidence/admin-matrix/chrome-1-admin-page.png', 'Administrator page reached with the keyboard (Chrome)'),
            ('evidence/refund-reference/my-bookings-refund-after-reload.png', 'Refund reference still shown after a page reload'),
        ],
    },
    {
        'out': '08_Code_and_Branch_Coverage_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf',
        'title': 'Code and Branch Coverage Report',
        'sources': ['CODE_BRANCH_COVERAGE_REPORT.md'],
        'images': [],
    },
    {
        'out': '09_SRS_Validation_Report_Muhammad_Affan_Dumba_PES1UG24CS280.pdf',
        'title': 'SRS Validation Report',
        'sources': ['SRS_VALIDATION_REPORT.md'],
        'images': [],
    },
]

CSS = """
@page { size: A4; margin: 16mm 14mm 18mm; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1b1b1b; line-height: 1.45; }
header { border-bottom: 2px solid #c4512a; margin-bottom: 14px; padding-bottom: 8px; }
header .kicker { font-size: 8.5pt; color: #6b625a; letter-spacing: .04em; text-transform: uppercase; }
header h1 { font-size: 20pt; margin: 4px 0 2px; }
header .meta { font-size: 8.5pt; color: #6b625a; }
h1 { font-size: 15pt; margin: 18px 0 6px; }
h2 { font-size: 12.5pt; margin: 16px 0 6px; border-bottom: 1px solid #e3ded6; padding-bottom: 2px; }
h3 { font-size: 11pt; margin: 12px 0 4px; }
table { border-collapse: collapse; width: 100%; margin: 6px 0 10px; font-size: 8.6pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 1px solid #d9d3ca; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #f4f0ea; }
code { font-family: Consolas, monospace; font-size: 8.6pt; background: #f4f0ea; padding: 0 2px; border-radius: 2px; }
pre { background: #f4f0ea; padding: 6px 8px; border-radius: 4px; white-space: pre-wrap; font-size: 8.6pt; }
pre code { background: none; padding: 0; }
a { color: #1c5cab; text-decoration: none; }
.source { margin-top: 26px; page-break-before: always; }
.source:first-of-type { page-break-before: auto; margin-top: 0; }
figure { margin: 10px 0 16px; page-break-inside: avoid; }
figure img { max-width: 100%; max-height: 120mm; border: 1px solid #d9d3ca; }
figcaption { font-size: 8.5pt; color: #6b625a; margin-top: 3px; }
"""


def rewrite_links(html, source_dir):
    """Relative links -> GitHub URLs; relative images -> embedded data URIs."""
    def link(m):
        href = m.group(1)
        if href.startswith(('http://', 'https://', 'mailto:', '#')):
            return m.group(0)
        target = os.path.normpath(os.path.join(source_dir, href.split('#')[0]))
        rel = os.path.relpath(target, ROOT).replace(os.sep, '/')
        return f'href="{GITHUB}{rel}"'

    def image(m):
        src = m.group(1)
        if src.startswith(('http://', 'https://', 'data:')):
            return m.group(0)
        path = os.path.normpath(os.path.join(source_dir, src))
        with open(path, 'rb') as fh:
            data = base64.b64encode(fh.read()).decode()
        return f'src="data:image/png;base64,{data}"'

    html = re.sub(r'href="([^"]+)"', link, html)
    return re.sub(r'src="([^"]+)"', image, html)


def build_html(report):
    parts = []
    for name in report['sources']:
        with open(os.path.join(DOCS, name), encoding='utf-8') as fh:
            body = markdown.markdown(fh.read(), extensions=['tables', 'fenced_code'])
        parts.append(f'<section class="source">{rewrite_links(body, DOCS)}</section>')
    if report['images']:
        figs = ['<section class="source"><h1>Appendix: screenshots</h1>']
        for src, caption in report['images']:
            figs.append(f'<figure><img src="{src}"><figcaption>{caption}</figcaption></figure>')
        figs.append('</section>')
        parts.append(rewrite_links(''.join(figs), DOCS))
    today = dt.date.today().strftime('%d %B %Y')
    sources = ', '.join(f'docs/{s}' for s in report['sources'])
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<header><div class="kicker">Software Engineering Mini Project · Team E15</div>
<h1>{report['title']}</h1>
<div class="meta">{AUTHOR}<br>Rendered {today} from {sources} on main.</div></header>
{''.join(parts)}</body></html>"""


def main():
    opts = webdriver.ChromeOptions()
    opts.add_argument('--headless=new')
    driver = webdriver.Chrome(options=opts)
    tmp = os.path.join(ROOT, 'scripts', '.render.html')
    try:
        for report in REPORTS:
            with open(tmp, 'w', encoding='utf-8') as fh:
                fh.write(build_html(report))
            driver.get('file:///' + tmp.replace(os.sep, '/'))
            pdf = driver.execute_cdp_cmd('Page.printToPDF', {
                'printBackground': True,
                'preferCSSPageSize': True,
                'displayHeaderFooter': True,
                'headerTemplate': '<span></span>',
                'footerTemplate': ('<div style="font-size:7pt;color:#6b625a;width:100%;text-align:center;">'
                                   f"{report['title']} · Team E15 · page <span class=\"pageNumber\"></span>"
                                   ' of <span class="totalPages"></span></div>'),
            })
            out = os.path.join(ROOT, report['out'])
            with open(out, 'wb') as fh:
                fh.write(base64.b64decode(pdf['data']))
            print(f"wrote {report['out']}")
    finally:
        driver.quit()
        if os.path.exists(tmp):
            os.remove(tmp)


if __name__ == '__main__':
    main()
