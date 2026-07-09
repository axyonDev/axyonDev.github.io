#!/usr/bin/env python3
"""U4.3.4 Chromium kabul: okunabilir/çakışmasız palet kartları ve kompakt/geniş yoğunluk."""
from __future__ import annotations
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / 'css' / 'style.css'

ITEMS = "".join(
    f'<button class="fx-palette-item"><span class="pi-icon">{ic}</span><span class="pi-body">'
    f'<span class="pi-name">{nm}</span><span class="pi-requirements">'
    f'<span class="pi-req"><span aria-hidden="true">&#128998;</span><b>Demir Levha</b><em>&#215;{a}</em></span>'
    f'<span class="pi-req"><span aria-hidden="true">&#9881;</span><b>Dişli</b><em>&#215;{b}</em></span>'
    f'</span><span class="pi-meta"><span>Alan {f}m&#178;</span><span>Enerji {p} kW</span></span></span></button>'
    for ic, nm, a, b, f, p in [
        ("A", "Demir Madeni \u00b7 Mk I", 10, 5, 6, 8),
        ("B", "Silikon F\u0131r\u0131n\u0131 \u00b7 Mk I", 12, 4, 8, 25),
        ("C", "Alfa Laboratuvar\u0131 \u00b7 Mk I", 12, 2, 8, 30),
    ]
)


def shell(density: str) -> str:
    return (
        f'<!DOCTYPE html><html data-theme="dark" data-density="{density}"><head><meta charset="utf-8">'
        f'</head><body style="padding:0;display:block">'
        f'<div class="fx-palette" style="position:relative;top:0;left:0">'
        f'<div class="fx-palette-head">Yap\u0131 Se\u00e7 <button class="x">x</button></div>'
        f'<div class="fx-palette-tabs"><button class="fx-pt active">Makineler</button><button class="fx-pt">Santraller</button></div>'
        f'<div class="fx-palette-list">{ITEMS}</div></div></body></html>'
    )


def measure(page):
    return page.evaluate(
        """()=>{let overlap=false;document.querySelectorAll('.fx-palette-item').forEach(it=>{
          const n=it.querySelector('.pi-name').getBoundingClientRect();
          const r=it.querySelector('.pi-requirements').getBoundingClientRect();
          if(n.bottom>r.top+0.5) overlap=true;});
          const pal=document.querySelector('.fx-palette').getBoundingClientRect();
          const nameVisible=getComputedStyle(document.querySelector('.pi-req b')).display!=='none';
          return {overlap,palW:Math.round(pal.width),nameVisible,
            docOverflow:document.body.scrollWidth>document.documentElement.clientWidth+1};}"""
    )


def main():
    checks = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                     args=['--no-sandbox', '--disable-dev-shm-usage'])
        for density, vw in [('wide', 900), ('compact', 900), ('wide', 390), ('compact', 390)]:
            page = browser.new_page(viewport={'width': vw, 'height': 820})
            page.set_content(shell(density), wait_until='domcontentloaded')
            page.add_style_tag(path=str(CSS))
            page.wait_for_timeout(120)
            m = measure(page)
            checks.append((density, vw, m))
            page.close()
        browser.close()

    fails = []
    for density, vw, m in checks:
        # 1) hiçbir yerde ad/gereksinim çakışması olmamalı
        if m['overlap']:
            fails.append(f'{density}@{vw}: kart içi çakışma var')
        # 2) 390px'de yatay taşma olmamalı
        if vw == 390 and m['docOverflow']:
            fails.append(f'{density}@{vw}: 390px yatay taşma')
        # 3) genişte ürün adı görünür, kompaktta gizli (simge+adet)
        if density == 'wide' and not m['nameVisible']:
            fails.append(f'{density}@{vw}: geniş modda ürün adı görünmüyor')
        if density == 'compact' and m['nameVisible']:
            fails.append(f'{density}@{vw}: kompakt modda ürün adı gizlenmemiş')
    # 4) geniş desktop kompakttan geniş olmalı
    wide_w = next(m['palW'] for d, vw, m in checks if d == 'wide' and vw == 900)
    comp_w = next(m['palW'] for d, vw, m in checks if d == 'compact' and vw == 900)
    if not wide_w > comp_w:
        fails.append(f'geniş ({wide_w}) kompakttan ({comp_w}) geniş değil')

    if fails:
        print('FAIL u4-3-4-density-palette:')
        for f in fails:
            print('  -', f)
        raise SystemExit(1)
    print(f'PASS u4-3-4-density-palette: çakışmasız kartlar, 390px taşma yok, '
          f'geniş={wide_w}px > kompakt={comp_w}px, ad görünürlüğü yoğunluğa göre doğru')


if __name__ == '__main__':
    main()
