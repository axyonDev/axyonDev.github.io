#!/usr/bin/env python3
"""Chromium acceptance for clean authoritative reset, silent resume and threat phase gate."""
from __future__ import annotations
import json, os, re, subprocess, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
REPORTS=ROOT/'reports';REPORTS.mkdir(exist_ok=True)
SCRIPT_RE=re.compile(r'<script[^>]+src="([^"]+)"[^>]*></script>',re.I)
ALL_SCRIPT_RE=re.compile(r'<script\b[^>]*>.*?</script>',re.I|re.S)
STYLE_LINK_RE=re.compile(r'<link[^>]+rel="stylesheet"[^>]*>',re.I)

def start_server(db:Path):
    env=os.environ.copy();env['AXYON_AUTH_DB']=str(db)
    p=subprocess.Popen(['node',str(ROOT/'tests/helpers/u4-3-server-child.js')],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    deadline=time.time()+12
    while time.time()<deadline:
        line=p.stdout.readline()
        if line:
            try:
                msg=json.loads(line)
                if msg.get('type')=='ready':return p,f"http://127.0.0.1:{msg['port']}"
            except json.JSONDecodeError:pass
        if p.poll() is not None:raise RuntimeError(p.stderr.read())
    p.kill();raise RuntimeError('server start timeout')

def stop_server(p):
    if p and p.poll() is None:
        p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.wait(timeout=2)

def request(url,method='GET',body=None,actor=None):
    data=None if body is None else json.dumps(body).encode()
    headers={'accept':'application/json'}
    if data is not None:headers['content-type']='application/json'
    if actor:headers['x-axyon-actor']=actor
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=8) as r:
            return r.status,json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code,json.loads(e.read().decode())

def load_shell(page,base):
    raw=(ROOT/'index.html').read_text(encoding='utf-8');scripts=SCRIPT_RE.findall(raw);shell=STYLE_LINK_RE.sub('',ALL_SCRIPT_RE.sub('',raw))
    page.set_content(shell,wait_until='domcontentloaded')
    page.evaluate("""(base)=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});const session=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>session.has(String(k))?session.get(String(k)):null,setItem:(k,v)=>session.set(String(k),String(v)),removeItem:k=>session.delete(String(k)),clear:()=>session.clear()},configurable:true});window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;window.__testVisibility='visible';window.AXYON_AUTHORITY_URL=base;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__testVisibility});}""",base)
    page.add_style_tag(path=str(ROOT/'css/style.css'))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT/rel))
        if rel=='src/services/storage-vault.js':page.evaluate("""(()=>{window.__phaseVault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__phaseVault)})()""")

def main():
    result={};errors=[];console=[]
    with tempfile.TemporaryDirectory(prefix='axyon-phase-browser-') as td:
        server,base=start_server(Path(td)/'authority.sqlite')
        try:
            with sync_playwright() as pw:
                browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
                page=browser.new_page(viewport={'width':1280,'height':900})
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:console.append(m.text) if m.type=='error' and '409 (Conflict)' not in m.text else None)
                load_shell(page,base)
                page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
                page.fill('#first-commander-name','Groundfront Pilot');page.click('#first-commander-create')
                page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")
                actor=page.evaluate("window.Axyon.SaveService.currentProfileId()")
                state=page.evaluate("JSON.parse(JSON.stringify(window.__axyon.state))")
                status,_=request(f'{base}/v1/actors/{actor}/seed','POST',{'state':state,'revision':0},actor);assert status==201

                initial=page.evaluate("""(()=>({entities:Object.keys(__axyon.state.grid.entities).length,machines:Axyon.Economy.machineCountTotal(__axyon.state),rights:Axyon.Economy.starterFreeRemaining(__axyon.state,'ironMine'),raidAt:__axyon.state.galaxy.nextRaidAt,phase:Axyon.Economy.threatPhase(__axyon.state),offlineModal:!!document.getElementById('offline-modal')}))()""")
                assert initial=={'entities':0,'machines':0,'rights':1,'raidAt':0,'phase':'ground','offlineModal':False}

                placed=page.evaluate("""(()=>{const s=__axyon.state,E=__axyon.E,D=Axyon.Data;for(const sec of E.openSectorList(s))for(let y=sec.sy*D.map.sectorSize;y<(sec.sy+1)*D.map.sectorSize;y++)for(let x=sec.sx*D.map.sectorSize;x<(sec.sx+1)*D.map.sectorSize;x++)if(E.canPlaceAt(s,'ironMine','machine',x,y))return __axyon.runCommand('factory.place',{defId:'ironMine',kind:'machine',x,y});return null})()""")
                assert placed and placed['ok']
                page.evaluate("window.__axyon.syncAuthority()")
                page.wait_for_function("Axyon.DomainCommand.diagnostics(__axyon.state).pending===0 && Axyon.DomainCommand.diagnostics(__axyon.state).server.lastRevision===1",timeout=10000)

                # Advance authority from another client so the browser reset begins stale.
                external={'schemaVersion':1,'commandId':'external-reset-race-1','sourceId':'external-tab','sequence':1,'actorId':actor,'type':'market.set-global-keep','payload':{'pct':33},'issuedAt':int(time.time()*1000),'expectedRevision':1,'clientSessionId':'external-tab'}
                status,body=request(f'{base}/v1/actors/{actor}/commands','POST',{'command':external},actor);assert status==200 and body['ok']

                page.click('#btn-settings');page.fill('#reset-confirm-text','SIFIRLA');page.evaluate("document.getElementById('do-reset').click()")
                page.wait_for_function("Object.keys(__axyon.state.grid.entities).length===0 && Axyon.DomainCommand.diagnostics(__axyon.state).pending===0 && Axyon.DomainCommand.diagnostics(__axyon.state).server.lastRevision===3",timeout=12000)
                _,snap=request(f'{base}/v1/actors/{actor}/snapshot',actor=actor)
                reset={'localEntities':page.evaluate("Object.keys(__axyon.state.grid.entities).length"),'serverEntities':len(snap['snapshot']['state']['grid']['entities']),'serverRevision':snap['snapshot']['serverRevision'],'rights':page.evaluate("Axyon.Economy.starterFreeRemaining(__axyon.state,'ironMine')")}
                assert reset=={'localEntities':0,'serverEntities':0,'serverRevision':3,'rights':1}

                # Nine-second tab switch must be silent; ordinary time passage is not news.
                page.evaluate("window.__testVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));__axyon.state.lastSeen=Date.now()-9000")
                page.evaluate("window.__testVisibility='visible';document.dispatchEvent(new Event('visibilitychange'))")
                page.wait_for_timeout(250)
                toast=page.locator('#toast-layer').inner_text()
                assert 'Komutan geri döndü' not in toast and 'çevrimdışı ilerleme' not in toast

                page.evaluate("document.getElementById('tab-galaxy').click()");page.wait_for_timeout(100)
                ground_ui={'title':page.locator('#frontier-title').inner_text(),'scanDisabled':page.evaluate("document.getElementById('scan-target')?.disabled ?? true"),'phase':page.evaluate("Axyon.Economy.threatPhase(__axyon.state)"),'alienReports':page.evaluate("__axyon.state.galaxy.reports.filter(r=>/uzaylı|yörünge izi/i.test(r.title||'')).length")}
                assert ground_ui['title']=='Yeryüzü Cephesi' and ground_ui['scanDisabled'] and ground_ui['phase']=='ground' and ground_ui['alienReports']==0

                page.set_viewport_size({'width':390,'height':844});overflow={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')};assert overflow['scroll']<=overflow['inner']
                result={'initial':initial,'reset':reset,'silentResumeToast':toast,'groundUI':ground_ui,'overflow':overflow,'errors':errors,'consoleErrors':console}
                if errors or console:raise AssertionError(result)
                page.screenshot(path=str(REPORTS/'U4_3_1_GROUNDFRONT_RESET_MOBILE.png'),full_page=False)
                browser.close()
        finally:stop_server(server)
    (REPORTS/'U4_3_1_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_3_1_BROWSER_SMOKE.txt').write_text('PASS U4.3.1 clean authoritative reset, silent resume and ground-first threat gate\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
