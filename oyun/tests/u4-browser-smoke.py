#!/usr/bin/env python3
"""Chromium smoke for U4 async vault bootstrap, durable dual-write and fallback behavior.
The restricted runner blocks navigable origins, so the native IndexedDB adapter cannot be opened here.
A durable in-memory backend exercises the same SaveService reconciliation/queue contract in real Chromium;
a second page verifies graceful localStorage fallback when IndexedDB is denied on an opaque origin.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'reports';REPORTS.mkdir(exist_ok=True)
SCRIPT_RE=re.compile(r'<script[^>]+src="([^"]+)"[^>]*></script>',re.I)
ALL_SCRIPT_RE=re.compile(r'<script\b[^>]*>.*?</script>',re.I|re.S)
STYLE_LINK_RE=re.compile(r'<link[^>]+rel="stylesheet"[^>]*>',re.I)


def load_shell(page,durable_backend:bool):
    raw=(ROOT/'index.html').read_text(encoding='utf-8')
    scripts=SCRIPT_RE.findall(raw)
    shell=STYLE_LINK_RE.sub('',ALL_SCRIPT_RE.sub('',raw))
    page.set_content(shell,wait_until='domcontentloaded')
    page.evaluate("""
    (()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size},_data:data};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;window.__testVisibility='visible';try{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__testVisibility})}catch(_){}})();
    """)
    page.add_style_tag(path=str(ROOT/'css/style.css'))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT/rel))
        if durable_backend and rel=='src/services/storage-vault.js':
            page.evaluate("""(()=>{window.__u4Vault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__u4Vault)})()""")
    return scripts


def create_commander(page,name='U4 Browser'):
    page.wait_for_function("window.__axyon && window.Axyon && window.Axyon.SaveService.diagnostics().prepared")
    page.wait_for_selector('#commander-onboarding:not(.hidden)')
    page.fill('#first-commander-name',name)
    page.click('#first-commander-create')
    page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")


def main():
    result={};page_errors=[];console_errors=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])

        # Durable contract in real Chromium using the deterministic backend.
        page=browser.new_page(viewport={'width':1280,'height':900})
        page.on('pageerror',lambda exc:page_errors.append(str(exc)))
        page.on('console',lambda msg:console_errors.append(msg.text) if msg.type=='error' else None)
        load_shell(page,True);create_commander(page)
        result['title']=page.title();result['version']=page.locator('.brand-sub').inner_text()
        result['storageStatusText']=page.locator('#storage-backend-status').inner_text()
        result['initialDiagnostics']=page.evaluate("window.__axyon.S.diagnostics()")
        if result['initialDiagnostics']['storageMode']!='indexeddb-primary':
            raise AssertionError(result['initialDiagnostics'])

        result['durableSave']=page.evaluate("""
        (async()=>{const S=window.__axyon.S,s=window.__axyon.state,EN=window.Axyon.EconomyNumber;s.coins=EN.safe('90001');const accepted=S.save(s),flush=await S.flush(),record=await S.rawVaultActiveSave();return{accepted,flush,credits:JSON.parse(record.value).economy.credits,revision:record.revision,pending:S.diagnostics().pendingVaultOps}})()
        """)
        if not result['durableSave']['accepted'] or not result['durableSave']['flush']['ok'] or result['durableSave']['credits']!='90001' or result['durableSave']['pending']!=0:
            raise AssertionError(result['durableSave'])

        # Async durable failure must be visible while local mirror retains the newest progress.
        result['vaultFailure']=page.evaluate("""
        (async()=>{const S=window.__axyon.S,s=window.__axyon.state,EN=window.Axyon.EconomyNumber;window.__u4Vault._control.failNextPut=1;s.coins=EN.safe('90002');const accepted=S.save(s);await S.flush();const d=S.diagnostics(),key=S.keys.SAVE_PREFIX+S.currentProfileId();return{accepted,blocking:d.blockingError,localCredits:JSON.parse(localStorage.getItem(key)).economy.credits,warning:!document.getElementById('save-warning').classList.contains('hidden')}})()
        """)
        if result['vaultFailure']['blocking'].get('layer')!='indexeddb' or result['vaultFailure']['localCredits']!='90002' or not result['vaultFailure']['warning']:
            raise AssertionError(result['vaultFailure'])

        page.click('#save-warning-retry')
        page.evaluate("window.__axyon.S.flush()")
        result['vaultRecovery']=page.evaluate("""
        (async()=>{const S=window.__axyon.S,record=await S.rawVaultActiveSave();return{blocking:S.diagnostics().blockingError,credits:JSON.parse(record.value).economy.credits,warning:!document.getElementById('save-warning').classList.contains('hidden')}})()
        """)
        if result['vaultRecovery']['blocking'] is not None or result['vaultRecovery']['credits']!='90002' or result['vaultRecovery']['warning']:
            raise AssertionError(result['vaultRecovery'])
        page.screenshot(path=str(REPORTS/'U4_DATA_VAULT_DESKTOP.png'),full_page=True)

        # Opaque-origin runner denies native IDB; U4 must still boot and explicitly report fallback.
        fallback=browser.new_page(viewport={'width':390,'height':844})
        fallback_errors=[]
        fallback.on('pageerror',lambda exc:fallback_errors.append(str(exc)))
        load_shell(fallback,False);create_commander(fallback,'Fallback Browser')
        result['fallbackDiagnostics']=fallback.evaluate("window.__axyon.S.diagnostics()")
        result['fallbackStatusText']=fallback.locator('#storage-backend-status').inner_text()
        result['fallbackSave']=fallback.evaluate("(()=>{const S=window.__axyon.S,s=window.__axyon.state;s.coins=window.Axyon.EconomyNumber.safe('42');return{accepted:S.save(s),raw:!!S.rawActiveSave()}})()")
        result['fallbackOverflow']={'scroll':fallback.evaluate('document.documentElement.scrollWidth'),'inner':fallback.evaluate('window.innerWidth')}
        fallback.screenshot(path=str(REPORTS/'U4_DATA_VAULT_FALLBACK_MOBILE.png'),full_page=True)
        if result['fallbackDiagnostics']['storageMode']!='localstorage-fallback' or not result['fallbackSave']['accepted'] or not result['fallbackSave']['raw'] or fallback_errors:
            raise AssertionError({'diag':result['fallbackDiagnostics'],'save':result['fallbackSave'],'errors':fallback_errors})
        if result['fallbackOverflow']['scroll']>result['fallbackOverflow']['inner']:
            raise AssertionError(result['fallbackOverflow'])
        fallback.close()

        expected=('memory vault put failure','IndexedDB')
        unexpected=[x for x in console_errors if not any(token in x for token in expected)]
        result['pageErrors']=page_errors;result['consoleErrors']=console_errors;result['unexpectedConsoleErrors']=unexpected
        if page_errors or unexpected:raise AssertionError({'page':page_errors,'console':unexpected})
        browser.close()

    (REPORTS/'U4_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_BROWSER_SMOKE.txt').write_text('\n'.join([
        'PASS U4 Chromium smoke',
        f"storage={result['initialDiagnostics']['storageMode']}",
        f"durableRevision={result['durableSave']['revision']}",
        f"recoveredCredits={result['vaultRecovery']['credits']}",
        f"fallback={result['fallbackDiagnostics']['storageMode']}",
        f"mobileOverflow={result['fallbackOverflow']['scroll']-result['fallbackOverflow']['inner']}"
    ]),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
