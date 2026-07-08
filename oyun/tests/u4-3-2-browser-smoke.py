#!/usr/bin/env python3
"""Chromium acceptance for direct resource placement, ESC/back cancellation and strict power."""
from __future__ import annotations
import json, re
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
        if rel=='src/services/storage-vault.js':page.evaluate("""(()=>{window.__inputVault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__inputVault)})()""")

def main():
    result={};errors=[];console=[]
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1280,'height':900})
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
        load_shell(page)
        page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
        page.fill('#first-commander-name','Power Pilot');page.click('#first-commander-create')
        page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")

        # Resource choice must construct immediately at the node and never enter sticky placement mode.
        node=page.evaluate("""()=>{for(const [key,n] of Object.entries(__axyon.state.map.nodes)){if(n.type==='ironOre'){const [x,y]=key.split(',').map(Number);return{x,y,type:n.type};}}return null}""")
        assert node
        page.evaluate("""n=>Axyon.UI.showNodeBuilder(__axyon.state,__axyon.E,n.type,n.x,n.y)""",node)
        page.locator('#fx-inspector [data-build-node="ironMine"]').click()
        page.wait_for_function("Object.keys(__axyon.state.grid.entities).length===1")
        direct=page.evaluate("""n=>{const e=Object.values(__axyon.state.grid.entities)[0];return{mode:Axyon.FactoryCanvas.getMode(),x:e.x,y:e.y,defId:e.defId,inspectorEntity:document.getElementById('fx-inspector').dataset.entity||null}}""",node)
        assert direct['mode']=='select' and direct['x']==node['x'] and direct['y']==node['y'] and direct['defId']=='ironMine'

        # ESC closes the selected inspector, then cancels a regular placement tool.
        page.keyboard.press('Escape');page.wait_for_timeout(100)
        esc_selection=page.evaluate("""()=>({mode:Axyon.FactoryCanvas.getMode(),hidden:document.getElementById('fx-inspector').classList.contains('hidden')})""")
        assert esc_selection=={'mode':'select','hidden':True}
        page.click('#fx-build-toggle');page.locator('#fx-palette [data-place="ironFurnace"]').click()
        assert page.evaluate("Axyon.FactoryCanvas.getMode()")=='place'
        page.keyboard.press('Escape');page.wait_for_function("Axyon.FactoryCanvas.getMode()==='select'")
        esc_tool=page.evaluate("""()=>({mode:Axyon.FactoryCanvas.getMode(),paletteHidden:document.getElementById('fx-palette').classList.contains('hidden')})""")
        assert esc_tool=={'mode':'select','paletteHidden':True}

        # One browser/mobile back action cancels the active tool instead of leaving the game.
        page.click('#fx-build-toggle');page.locator('#fx-palette [data-place="ironFurnace"]').click()
        assert page.evaluate("Axyon.FactoryCanvas.getMode()")=='place'
        page.evaluate("history.back()")
        page.wait_for_function("Axyon.FactoryCanvas.getMode()==='select'")
        back=page.evaluate("""()=>({mode:Axyon.FactoryCanvas.getMode(),inspectorHidden:document.getElementById('fx-inspector').classList.contains('hidden')})""")
        assert back['mode']=='select'

        # No line means no production. A fueled and physically linked network enables it.
        power=page.evaluate("""()=>{
          const s=__axyon.state,E=__axyon.E,D=Axyon.Data,EN=Axyon.EconomyNumber;
          const find=(id,type='machine')=>{for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,id,type,x,y))return[x,y];return null};
          const mine=Object.values(s.grid.entities).find(e=>e.defId==='ironMine');
          const fc=find('ironFurnace'),fr=__axyon.runCommand('factory.place',{defId:'ironFurnace',kind:'machine',x:fc[0],y:fc[1]}),furnace=s.grid.entities[fr.data.entityId];
          E._u2.setInv(s,'ironOre',20);for(let i=0;i<30;i++)E.tick(s,.1,Date.now()+i*100);
          const before={ore:EN.toStorage(s.stats.produced.ironOre),plate:EN.toStorage(s.stats.produced.ironPlate),coal:EN.toStorage(s.inventory.coal)};
          const pc=find('coalGen','plant'),pr=__axyon.runCommand('factory.place',{defId:'coalGen',kind:'plant',x:pc[0],y:pc[1]}),plant=s.grid.entities[pr.data.entityId];
          for(let i=0;i<20;i++)E.tick(s,.1,Date.now()+4000+i*100);
          const unlinkedCoal=EN.toStorage(s.inventory.coal);
          const l1=__axyon.runCommand('factory.add-power-line',{from:plant.id,to:mine.id}),l2=__axyon.runCommand('factory.add-power-line',{from:plant.id,to:furnace.id});
          for(let i=0;i<50;i++)E.tick(s,.1,Date.now()+7000+i*100);
          return{before,unlinkedCoal,after:{ore:EN.toStorage(s.stats.produced.ironOre),plate:EN.toStorage(s.stats.produced.ironPlate),coal:EN.toStorage(s.inventory.coal)},links:[l1.ok,l2.ok],minePower:E.entityPowerStatus(s,mine.id),furnacePower:E.entityPowerStatus(s,furnace.id),landing:s.firstOrbit.landingReactorPower};
        }""")
        assert power['before']['ore']=='0' and power['before']['plate']=='0'
        assert power['unlinkedCoal']==power['before']['coal']
        assert power['links']==[True,True]
        assert float(power['after']['ore'])>0 and float(power['after']['plate'])>0 and float(power['after']['coal'])<float(power['before']['coal'])
        assert power['minePower']['powered'] and power['furnacePower']['powered'] and power['landing']==0

        page.set_viewport_size({'width':390,'height':844})
        overflow={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')};assert overflow['scroll']<=overflow['inner']
        result={'directResourceBuild':direct,'escapeSelection':esc_selection,'escapeTool':esc_tool,'mobileBack':back,'strictPower':power,'overflow':overflow,'errors':errors,'consoleErrors':console}
        if errors or console:raise AssertionError(result)
        page.screenshot(path=str(REPORTS/'U4_3_2_POWER_INPUT_MOBILE.png'),full_page=False)
        browser.close()
    (REPORTS/'U4_3_2_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_3_2_BROWSER_SMOKE.txt').write_text('PASS U4.3.2 direct resource build, ESC/back cancellation and strict connected power\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
