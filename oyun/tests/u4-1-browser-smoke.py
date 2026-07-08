#!/usr/bin/env python3
"""Real Chromium smoke for U4.1 command authority and UI bridge."""
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
            page.evaluate("""(()=>{window.__u41Vault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__u41Vault)})()""")

def create_commander(page):
    page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
    page.fill('#first-commander-name','U4.1 Browser')
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
        result['command']=page.evaluate("""(()=>{
          const X=window.__axyon,C=X.C,E=X.E,s=X.state,D=window.Axyon.Data,EN=window.Axyon.EconomyNumber,actor=X.S.currentProfileId();
          s.coins=EN.safe('1e30');for(const k of Object.keys(D.items))s.inventory[k]=EN.safe('1e30');for(const t of D.research)s.researched[t.id]=true;
          const before=s.galaxy.shipQueue.length,cmd=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:1},{actorId:actor,sourceId:'browser-retry',sequence:1,expectedRevision:C.revision(s),issuedAt:Date.now()});
          const first=X.executeCommandEnvelope(cmd),second=X.executeCommandEnvelope(cmd);
          const collision=C.create('shipyard.queue-ship',{shipId:'spyProbe',count:2},{actorId:actor,sourceId:'browser-retry',sequence:1,expectedRevision:0,issuedAt:cmd.issuedAt});
          const conflict=X.executeCommandEnvelope(collision);
          const stale=C.create('market.set-global-keep',{pct:10},{actorId:actor,sourceId:'browser-retry',sequence:2,expectedRevision:0,issuedAt:Date.now()});
          const staleResult=X.executeCommandEnvelope(stale);
          return{before,after:s.galaxy.shipQueue.length,first:{ok:first.ok,applied:first.applied,code:first.code},second:{ok:second.ok,duplicate:second.duplicate,code:second.code},conflict:{conflict:conflict.conflict,code:conflict.code},stale:{ok:staleResult.ok,code:staleResult.receipt?.code},revision:C.revision(s),diag:C.diagnostics(s)};
        })()""")
        c=result['command']
        if c['after']-c['before']!=1 or not c['first']['applied'] or not c['second']['duplicate'] or c['conflict']['code']!='command_id_conflict' or c['stale']['code']!='stale_revision':raise AssertionError(c)
        result['serverBridge']=page.evaluate('''(()=>{const X=window.__axyon,C=X.C;const queued=X.queueServerCommand('market.set-global-keep',{pct:33}),item=C.outboxBatch(X.state,1)[0],sentAt=Date.now()-20,receivedAt=Date.now();const ack=X.applyServerAck({schemaVersion:1,commandId:item.commandId,fingerprint:item.fingerprint,status:'accepted',serverRevision:7,serverTime:receivedAt+1200,sentAt,receivedAt});return{queued:{ok:queued.ok},ack:{ok:ack.ok,code:ack.code},pending:C.diagnostics(X.state).pending,clock:X.Clock.diagnostics(X.state)};})()''')
        if not result['serverBridge']['queued']['ok'] or not result['serverBridge']['ack']['ok'] or result['serverBridge']['pending']!=0 or not result['serverBridge']['clock']['authoritative']:raise AssertionError(result['serverBridge'])
        page.click('#btn-settings');result['status']=page.locator('#command-runtime-status').inner_text()
        if 'Komut revizyonu' not in result['status']:raise AssertionError(result['status'])
        result['persisted']=page.evaluate("""(async()=>{const X=window.__axyon;await X.S.flush();const loaded=X.S.load(),C=X.C;return{queue:loaded.galaxy.shipQueue.length,revision:C.revision(loaded),receipt:!!loaded.commandRuntime?.sources?.['browser-retry']?.receipts?.['1']}})()""")
        if result['persisted']['queue']<1 or result['persisted']['revision']<1 or not result['persisted']['receipt']:raise AssertionError(result['persisted'])
        page.set_viewport_size({'width':390,'height':844});result['overflow']={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')}
        if result['overflow']['scroll']>result['overflow']['inner']:raise AssertionError(result['overflow'])
        page.screenshot(path=str(REPORTS/'U4_1_COMMAND_AUTHORITY_MOBILE.png'),full_page=True)
        result['errors']=errors;result['consoleErrors']=console
        if errors or console:raise AssertionError({'page':errors,'console':console})
        browser.close()
    (REPORTS/'U4_1_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_1_BROWSER_SMOKE.txt').write_text('PASS U4.1 Chromium command authority\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
