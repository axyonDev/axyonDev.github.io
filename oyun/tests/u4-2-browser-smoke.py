#!/usr/bin/env python3
"""Real Chromium smoke for U4.2 authoritative server bridge, command coverage and snapshot reconciliation."""
from __future__ import annotations
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'reports';REPORTS.mkdir(exist_ok=True)
SCRIPT_RE=re.compile(r'<script[^>]+src="([^"]+)"[^>]*></script>',re.I)
ALL_SCRIPT_RE=re.compile(r'<script\b[^>]*>.*?</script>',re.I|re.S)
STYLE_LINK_RE=re.compile(r'<link[^>]+rel="stylesheet"[^>]*>',re.I)

def load_shell(page):
    raw=(ROOT/'index.html').read_text(encoding='utf-8');scripts=SCRIPT_RE.findall(raw);shell=STYLE_LINK_RE.sub('',ALL_SCRIPT_RE.sub('',raw))
    page.set_content(shell,wait_until='domcontentloaded')
    page.evaluate("""(()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});const session=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>session.has(String(k))?session.get(String(k)):null,setItem:(k,v)=>session.set(String(k),String(v)),removeItem:k=>session.delete(String(k)),clear:()=>session.clear()},configurable:true});window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;window.__testVisibility='visible';try{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__testVisibility})}catch(_){}})()""")
    page.add_style_tag(path=str(ROOT/'css/style.css'))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT/rel))
        if rel=='src/services/storage-vault.js':
            page.evaluate("""(()=>{window.__u42Vault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__u42Vault)})()""")

def create_commander(page):
    page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
    page.fill('#first-commander-name','U4.2 Browser')
    page.click('#first-commander-create')
    page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")


def main():
    result={};errors=[];console=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1280,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
        load_shell(page);create_commander(page)
        result['version']=page.locator('.brand-sub').inner_text()
        if 'v4.5.6 U4.3.3' not in result['version']:raise AssertionError(result['version'])
        result['coveredCommands']=page.evaluate("""(()=>{
          const X=window.__axyon,C=X.C,E=X.E,s=X.state,D=window.Axyon.Data,EN=window.Axyon.EconomyNumber,actor=X.S.currentProfileId();
          s.coins=EN.safe('1e35');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e35');for(const t of D.research)s.researched[t.id]=true;s.market.creditEconomyUnlocked=true;s.market.legacyAccess=true;
          const before=s.storageLevel.ironOre||0,cmd=C.create('storage.upgrade',{itemId:'ironOre'},{actorId:actor,sourceId:'browser-u42',sequence:1,expectedRevision:C.revision(s),issuedAt:Date.now(),commandId:'browser-storage-u42'});
          const first=X.executeCommandEnvelope(cmd),second=X.executeCommandEnvelope(cmd);
          const auto=X.runCommand('market.toggle-item-auto-sell',{itemId:'ironOre'});
          const sector=E.openableSectors(s)[0],opened=sector?X.runCommand('sector.open',sector):{ok:false,code:'none'};
          return{before,after:s.storageLevel.ironOre||0,first:{ok:first.ok,applied:first.applied},second:{duplicate:second.duplicate},auto:{ok:auto.ok},opened:{ok:opened.ok,code:opened.code},revision:C.revision(s)};
        })()""")
        c=result['coveredCommands']
        if c['after']!=c['before']+1 or not c['first']['applied'] or not c['second']['duplicate'] or not c['auto']['ok']:raise AssertionError(c)
        result['reconciliation']=page.evaluate("""(()=>{
          const X=window.__axyon,C=X.C,E=X.E,s=X.state,actor=X.S.currentProfileId(),EN=window.Axyon.EconomyNumber;
          s.settings.theme='light';const current=C.diagnostics(s).server.lastRevision||0,server=E.createInitialState();server.coins=EN.safe('987654321');server.settings.theme='dark';
          C._test.ensureRuntime(s).outbox.push({commandId:'pending-u42',fingerprint:'12345678'});C._test.ensureRuntime(s).server.needsReconcile=true;
          const r=X.applyServerSnapshot({schemaVersion:1,actorId:actor,serverRevision:current+5,serverTime:Date.now()+1000,state:server});
          return{result:r,theme:s.settings.theme,pending:C.diagnostics(s).pending,revision:C.revision(s),needs:C.diagnostics(s).server.needsReconcile,coins:String(s.coins)};
        })()""")
        r=result['reconciliation']
        if not r['result']['ok'] or r['theme']!='light' or r['pending']!=0 or r['revision']!=r['result']['serverRevision'] or r['needs'] or r['coins']!='987654321':raise AssertionError(r)
        page.click('#btn-settings');result['status']=page.locator('#command-runtime-status').inner_text()
        if 'Komut revizyonu' not in result['status']:raise AssertionError(result['status'])
        page.set_viewport_size({'width':390,'height':844});result['overflow']={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')}
        if result['overflow']['scroll']>result['overflow']['inner']:raise AssertionError(result['overflow'])
        page.screenshot(path=str(REPORTS/'U4_2_SERVER_AUTHORITY_MOBILE.png'),full_page=True)
        result['errors']=errors;result['consoleErrors']=console
        if errors or console:raise AssertionError({'page':errors,'console':console})
        browser.close()
    (REPORTS/'U4_2_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_2_BROWSER_SMOKE.txt').write_text('PASS U4.2 Chromium authoritative server bridge\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
