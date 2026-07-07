#!/usr/bin/env python3
"""Real Chromium smoke tests for AXYON: Orbital Ascendancy U3.1 hotfix.
Direct localhost/file navigation may be blocked in restricted runners, so this harness loads
real project HTML/CSS/JS into Chromium with an in-memory localStorage implementation.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
REPORTS.mkdir(exist_ok=True)

SCRIPT_RE = re.compile(r'<script[^>]+src="([^"]+)"[^>]*></script>', re.I)
ALL_SCRIPT_RE = re.compile(r'<script\b[^>]*>.*?</script>', re.I | re.S)
STYLE_LINK_RE = re.compile(r'<link[^>]+rel="stylesheet"[^>]*>', re.I)


def load_shell(page, html_name: str, css_name: str):
    raw = (ROOT / html_name).read_text(encoding="utf-8")
    scripts = SCRIPT_RE.findall(raw)
    shell = ALL_SCRIPT_RE.sub("", raw)
    shell = STYLE_LINK_RE.sub("", shell)
    page.set_content(shell, wait_until="domcontentloaded")
    page.evaluate(
        """
        (()=>{
          const data=new Map();
          const storage={
            getItem:k=>data.has(String(k))?data.get(String(k)):null,
            setItem:(k,v)=>data.set(String(k),String(v)),
            removeItem:k=>data.delete(String(k)),
            clear:()=>data.clear(),
            key:i=>[...data.keys()][i]??null,
            get length(){return data.size;},
            _data:data
          };
          Object.defineProperty(window,'localStorage',{value:storage, configurable:true});
          window.alert=()=>{}; window.confirm=()=>true; window.prompt=()=>null;
          window.__testVisibility='visible';
          try{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__testVisibility});}catch(_){}
        })();
        """
    )
    page.add_style_tag(path=str(ROOT / css_name))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT / rel))
    return scripts


def boot_game(page):
    load_shell(page, "index.html", "css/style.css")
    page.wait_for_function("window.__axyon && window.Axyon && window.Axyon.FactoryCanvas")
    page.wait_for_selector("#commander-onboarding:not(.hidden)")
    page.fill("#first-commander-name", "Browser Test")
    page.select_option("#first-planet-type", "temperate")
    page.click("#first-commander-create")
    page.wait_for_function("!document.getElementById('commander-onboarding').classList.contains('hidden') === false")
    page.wait_for_timeout(120)


def main():
    errors: list[str] = []
    console_errors: list[str] = []
    result: dict[str, object] = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        boot_game(page)

        result["title"] = page.title()
        result["brand"] = page.locator(".brand-name").inner_text()
        result["version"] = page.locator(".brand-sub").inner_text()

        # U3 infrastructure view and desktop overflow.
        page.click('[data-tab="infrastructure"]')
        page.wait_for_timeout(100)
        result["capacityCards"] = page.locator("#capacity-grid .capacity-card").count()
        result["desktopScrollWidth"] = page.evaluate("document.documentElement.scrollWidth")
        result["desktopInnerWidth"] = page.evaluate("window.innerWidth")
        page.screenshot(path=str(REPORTS / "U3_1_DESKTOP_INFRASTRUCTURE_FINAL.png"), full_page=True)

        # Real pointer-event pinch test on the visible factory canvas.
        page.click('[data-tab="factory"]')
        page.wait_for_timeout(100)
        page.evaluate("window.Axyon.FactoryCanvas.resize()")
        pinch = page.evaluate(
            """
            (()=>{
              const c=document.getElementById('factory-canvas'),r=c.getBoundingClientRect(),FC=window.Axyon.FactoryCanvas;
              c.setPointerCapture=()=>{};c.releasePointerCapture=()=>{};
              const before=FC.getCamera().zoom;
              const fire=(type,id,x,y,buttons)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',button:0,buttons,isPrimary:id===1,clientX:r.left+x,clientY:r.top+y}));
              fire('pointerdown',1,Math.max(40,r.width*.30),Math.max(40,r.height*.40),1);
              fire('pointerdown',2,Math.max(120,r.width*.55),Math.max(40,r.height*.40),1);
              fire('pointermove',2,Math.max(220,r.width*.78),Math.max(40,r.height*.40),1);
              const after=FC.getCamera().zoom;
              fire('pointerup',2,Math.max(220,r.width*.78),Math.max(40,r.height*.40),0);
              fire('pointerup',1,Math.max(40,r.width*.30),Math.max(40,r.height*.40),0);
              return {before,after,changed:Math.abs(after-before)>0.01,rect:{width:r.width,height:r.height}};
            })()
            """
        )
        result["pinch"] = pinch
        if not pinch["changed"]:
            raise AssertionError("Pinch gesture did not change camera zoom")

        # Background resume: exactly one 10-minute offline application.
        bg = page.evaluate(
            """
            (()=>{
              const s=window.__axyon.state,UI=window.Axyon.UI;
              window.__testVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));
              s.lastSeen=Date.now()-600000;
              window.__testVisibility='visible';document.dispatchEvent(new Event('visibilitychange'));
              const first={visible:!document.getElementById('offline-modal').classList.contains('hidden'),text:document.getElementById('offline-text').textContent,lastSeen:s.lastSeen};
              UI.hideModal('offline-modal');
              const earned=window.Axyon.EconomyNumber.toStorage(s.totalEarned);
              document.dispatchEvent(new Event('visibilitychange'));
              return {first,secondVisible:!document.getElementById('offline-modal').classList.contains('hidden'),earnedAfterSecond:window.Axyon.EconomyNumber.toStorage(s.totalEarned),earned};
            })()
            """
        )
        result["background"] = bg
        if not bg["first"]["visible"] or "10dk" not in bg["first"]["text"] or bg["secondVisible"] or bg["earned"] != bg["earnedAfterSecond"]:
            raise AssertionError(f"Background resume regression: {bg}")

        # Visible save failure bridge.
        save_warning = page.evaluate(
            """
            (()=>{
              const original=localStorage.setItem;
              localStorage.setItem=()=>{throw new DOMException('quota smoke','QuotaExceededError')};
              const ok=window.__axyon.S.save(window.__axyon.state);
              localStorage.setItem=original;
              const node=document.getElementById('save-warning');
              return {ok,visible:!node.classList.contains('hidden'),text:document.getElementById('save-warning-text').textContent};
            })()
            """
        )
        result["saveWarning"] = save_warning
        if save_warning["ok"] or not save_warning["visible"]:
            raise AssertionError(f"Save warning bridge failed: {save_warning}")

        # U3.1 manual recovery closes the warning without a page reload.
        page.click("#save-warning-retry")
        page.wait_for_timeout(60)
        recovery = page.evaluate(
            """(()=>({visible:!document.getElementById('save-warning').classList.contains('hidden'),blocking:window.__axyon.S.diagnostics().blockingError,raw:!!window.__axyon.S.rawActiveSave()}))()"""
        )
        result["saveRecovery"] = recovery
        if recovery["visible"] or recovery["blocking"] is not None or not recovery["raw"]:
            raise AssertionError(f"Save recovery failed: {recovery}")

        # ARIA state and 44px touch targets are real computed DOM properties.
        aria_before = page.locator("#ticker-toggle").get_attribute("aria-expanded")
        page.click("#ticker-toggle")
        aria_after = page.locator("#ticker-toggle").get_attribute("aria-expanded")
        touch_targets = page.evaluate(
            """(()=>{const icon=document.querySelector('.icon-btn')?.getBoundingClientRect(),zoom=document.querySelector('.fx-zoom')?.getBoundingClientRect();return{icon:{w:icon?.width||0,h:icon?.height||0},zoom:{w:zoom?.width||0,h:zoom?.height||0}}})()"""
        )
        result["tickerAria"] = {"before": aria_before, "after": aria_after}
        result["touchTargets"] = touch_targets
        if aria_before != "false" or aria_after != "true":
            raise AssertionError(f"Ticker ARIA state failed: {aria_before}->{aria_after}")
        if min(touch_targets["icon"].values()) < 44 or min(touch_targets["zoom"].values()) < 44:
            raise AssertionError(f"Touch target below 44px: {touch_targets}")

        # 1,000 entity viewport-culling draw smoke.
        perf = page.evaluate(
            """
            (()=>{
              const s=window.__axyon.state,FC=window.Axyon.FactoryCanvas;
              for(let i=0;i<1000;i++)s.grid.entities['perf-'+i]={id:'perf-'+i,type:'machine',defId:'ironMine',x:i%300,y:Math.floor(i/300)};
              FC.setState(s);const bounds=FC.viewBounds(),area=(bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY);
              const t0=performance.now();for(let i=0;i<120;i++)FC.draw();const ms=performance.now()-t0;
              return {ms,perFrame:ms/120,bounds,visibleCellArea:area,totalCellArea:90000};
            })()
            """
        )
        result["viewportPerformance"] = perf
        if perf["visibleCellArea"] >= perf["totalCellArea"] or perf["perFrame"] > 33:
            raise AssertionError(f"Viewport culling/performance failed: {perf}")

        # Updated 8-tab desktop layout.
        tab_rows = page.evaluate(
            """
            (()=>{const ys=[...document.querySelectorAll('.tabs [data-tab]')].map(x=>Math.round(x.getBoundingClientRect().top));return {count:ys.length,rows:new Set(ys).size,ys};})()
            """
        )
        result["desktopTabs"] = tab_rows
        if tab_rows["count"] != 8 or tab_rows["rows"] != 1:
            raise AssertionError(f"Desktop tabs wrapped: {tab_rows}")

        # Mobile rendering and safe-area-compatible layout. Clear deliberate test warnings first.
        page.evaluate("document.getElementById('save-warning')?.classList.add('hidden');document.querySelectorAll('.toast').forEach(x=>x.remove());window.Axyon.HelpSystem?.hide?.()")
        page.set_viewport_size({"width":390,"height":844})
        page.wait_for_timeout(150)
        page.click('[data-tab="infrastructure"]')
        page.wait_for_timeout(80)
        result["mobileScrollWidth"] = page.evaluate("document.documentElement.scrollWidth")
        result["mobileInnerWidth"] = page.evaluate("window.innerWidth")
        result["mobileTouchAction"] = page.locator("#factory-canvas").evaluate("e=>getComputedStyle(e).touchAction")
        page.screenshot(path=str(REPORTS / "U3_1_MOBILE_INFRASTRUCTURE_FINAL.png"), full_page=True)
        if result["mobileScrollWidth"] > result["mobileInnerWidth"]:
            raise AssertionError("Mobile horizontal overflow")

        # Encyclopedia U3 infrastructure section in a second real Chromium page.
        codex_errors: list[str] = []
        codex = browser.new_page(viewport={"width":1440,"height":1000})
        codex.on("pageerror", lambda exc: codex_errors.append(str(exc)))
        load_shell(codex, "encyclopedia.html", "css/encyclopedia.css")
        codex.wait_for_function("document.querySelectorAll('#codex-infrastructure .codex-card').length > 0")
        result["codexInfrastructureCards"] = codex.locator("#codex-infrastructure .codex-card").count()
        result["codexValidation"] = codex.locator("#codex-validation").inner_text()
        codex.locator("#infrastructure").scroll_into_view_if_needed()
        codex.screenshot(path=str(REPORTS / "U3_1_ENCYCLOPEDIA_INFRASTRUCTURE.png"), full_page=True)
        result["codexErrors"] = codex_errors
        if codex_errors or "Veri ağı doğrulandı" not in result["codexValidation"]:
            raise AssertionError(f"Codex regression: {codex_errors} {result['codexValidation']}")
        codex.close()

        result["pageErrors"] = errors
        # Expected quota error is logged by the deliberate failure test; filter it from unexpected console errors.
        unexpected_console=[x for x in console_errors if "quota smoke" not in x and "QuotaExceededError" not in x]
        result["consoleErrors"] = console_errors
        result["unexpectedConsoleErrors"] = unexpected_console
        if errors or unexpected_console:
            raise AssertionError(f"Browser errors: page={errors}, console={unexpected_console}")
        browser.close()

    (REPORTS / "U3_1_BROWSER_SMOKE_FINAL.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
