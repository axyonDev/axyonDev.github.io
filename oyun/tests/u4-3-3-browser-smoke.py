#!/usr/bin/env python3
"""Chromium acceptance for readable palette, defense-gated groundfront and live factory status drawer."""
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
    page.evaluate("""()=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});const session=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>session.has(String(k))?session.get(String(k)):null,setItem:(k,v)=>session.set(String(k),String(v)),removeItem:k=>session.delete(String(k)),clear:()=>session.clear()},configurable:true});window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;}""")
    page.add_style_tag(path=str(ROOT/'css/style.css'))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT/rel))
        if rel=='src/services/storage-vault.js':page.evaluate("""(()=>{window.__fiVault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__fiVault)})()""")

def main():
    errors=[];console=[];result={}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1280,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
        load_shell(page)
        page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
        page.fill('#first-commander-name','Factory Auditor');page.click('#first-commander-create')
        page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")

        # A paid palette requirement must expose icon + readable item name + amount.
        palette=page.evaluate("""()=>{const s=__axyon.state,E=__axyon.E;for(const id of ['ironFurnace','gearPress'])s.firstOrbit.starterCounts[id]=s.firstOrbit.starterAllowance[id]||0;Axyon.UI.buildPalette(s,E);const b=document.querySelector('#fx-palette-machines [data-place="ironFurnace"]');return{text:b?.innerText||'',requirements:[...b.querySelectorAll('.pi-req')].map(x=>x.innerText),icons:[...b.querySelectorAll('.pi-req>span')].map(x=>x.textContent)};}""")
        assert palette['requirements'] and any(any(c.isalpha() for c in x) for x in palette['requirements'])
        assert any(x.strip() for x in palette['icons'])

        # Build a real powered mine so the status drawer has live rows.
        setup=page.evaluate("""()=>{const s=__axyon.state,E=__axyon.E,D=Axyon.Data;const node=Object.entries(s.map.nodes).find(([,n])=>n.type==='ironOre');const [x,y]=node[0].split(',').map(Number);const mine=__axyon.runCommand('factory.place',{defId:'ironMine',kind:'machine',x,y});const find=(id,type)=>{for(const sec of E.openSectorList(s))for(let yy=sec.sy*D.map.sectorSize;yy<(sec.sy+1)*D.map.sectorSize;yy++)for(let xx=sec.sx*D.map.sectorSize;xx<(sec.sx+1)*D.map.sectorSize;xx++)if(E.canPlaceAt(s,id,type,xx,yy))return[xx,yy];};const pc=find('coalGen','plant'),plant=__axyon.runCommand('factory.place',{defId:'coalGen',kind:'plant',x:pc[0],y:pc[1]});__axyon.runCommand('factory.add-power-line',{from:plant.data.entityId,to:mine.data.entityId});for(let i=0;i<30;i++)E.tick(s,.1,Date.now()+i*100);Axyon.UI.render(s,E);return{mine:mine.data.entityId,plant:plant.data.entityId,nextRaidAt:s.galaxy.nextRaidAt,threat:E.groundThreatUnlocked(s)};}""")
        assert setup['nextRaidAt']==0 and setup['threat'] is False
        assert page.locator('#threat-display').inner_text()=='0'

        page.click('#fx-status-toggle');page.wait_for_function("!document.getElementById('fx-status-panel').classList.contains('hidden')")
        drawer=page.evaluate("""()=>({expanded:document.getElementById('fx-status-toggle').getAttribute('aria-expanded'),summary:document.getElementById('fx-status-summary').innerText,list:document.getElementById('fx-status-list').innerText,rows:document.querySelectorAll('#fx-status-list .factory-status-row').length})""")
        assert drawer['expanded']=='true' and drawer['rows']>=2
        assert 'Demir Madeni' in drawer['list'] and 'Çevrim:' in drawer['list'] and 'Enerji:' in drawer['list']
        assert 'Güç arzı' in drawer['summary'] and 'Güç çekişi' in drawer['summary']

        # defenseGrid is the gate for ground threats and UI must explain both states.
        before=page.evaluate("""()=>{Axyon.UI.renderGalaxy(__axyon.state,__axyon.E);return{timer:document.getElementById('raid-timer').innerText,desc:document.getElementById('frontier-description').innerText}}""")
        assert 'Gezegen Savunması' in before['timer'] and 'Gezegen Savunması' in before['desc']
        after=page.evaluate("""()=>{const s=__axyon.state;s.researched.defenseGrid=true;__axyon.E.initializeThreatState(s,Date.now());Axyon.UI.render(s,__axyon.E);Axyon.UI.renderGalaxy(s,__axyon.E);return{unlocked:__axyon.E.groundThreatUnlocked(s),next:s.galaxy.nextRaidAt,timer:document.getElementById('raid-timer').innerText,reports:s.galaxy.reports.map(r=>r.title)}}""")
        assert after['unlocked'] and after['next']>0 and any('savunma ağı' in x.lower() for x in after['reports'])

        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
        overflow={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')};assert overflow['scroll']<=overflow['inner']
        result={'palette':palette,'setup':setup,'drawer':drawer,'groundBefore':before,'groundAfter':after,'overflow':overflow,'errors':errors,'consoleErrors':console}
        if errors or console:raise AssertionError(result)
        page.screenshot(path=str(REPORTS/'U4_3_3_FACTORY_INTELLIGENCE_MOBILE.png'),full_page=False)
        browser.close()
    (REPORTS/'U4_3_3_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_3_3_BROWSER_SMOKE.txt').write_text('PASS U4.3.3 readable palette, defense-gated groundfront and live factory status drawer\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
