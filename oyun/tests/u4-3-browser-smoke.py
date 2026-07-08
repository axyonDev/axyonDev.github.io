#!/usr/bin/env python3
"""Real Chromium + real HTTP/SQLite authority smoke for U4.3."""
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
                if msg.get('type')=='ready': return p,f"http://127.0.0.1:{msg['port']}"
            except json.JSONDecodeError: pass
        if p.poll() is not None: raise RuntimeError(p.stderr.read())
    p.kill();raise RuntimeError('server start timeout')

def stop_server(p):
    if p.poll() is None:
        p.terminate()
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill();p.wait(timeout=2)

def request(url,method='GET',body=None,actor=None):
    data=None if body is None else json.dumps(body).encode()
    headers={'accept':'application/json'}
    if data is not None:headers['content-type']='application/json'
    if actor:headers['x-axyon-actor']=actor
    with urllib.request.urlopen(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=8) as r:
        return r.status,json.loads(r.read().decode())

def load_shell(page,base):
    raw=(ROOT/'index.html').read_text(encoding='utf-8');scripts=SCRIPT_RE.findall(raw);shell=STYLE_LINK_RE.sub('',ALL_SCRIPT_RE.sub('',raw))
    page.set_content(shell,wait_until='domcontentloaded')
    page.evaluate("""(base)=>{const data=new Map();const storage={getItem:k=>data.has(String(k))?data.get(String(k)):null,setItem:(k,v)=>data.set(String(k),String(v)),removeItem:k=>data.delete(String(k)),clear:()=>data.clear(),key:i=>[...data.keys()][i]??null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:storage,configurable:true});const session=new Map();Object.defineProperty(window,'sessionStorage',{value:{getItem:k=>session.has(String(k))?session.get(String(k)):null,setItem:(k,v)=>session.set(String(k),String(v)),removeItem:k=>session.delete(String(k)),clear:()=>session.clear()},configurable:true});window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>null;window.__testVisibility='visible';window.AXYON_AUTHORITY_URL=base;try{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__testVisibility})}catch(_){}}""",base)
    page.add_style_tag(path=str(ROOT/'css/style.css'))
    for rel in scripts:
        page.add_script_tag(path=str(ROOT/rel))
        if rel=='src/services/storage-vault.js':
            page.evaluate("""(()=>{window.__u43Vault=window.Axyon.StorageVault._test.createMemoryBackend({durable:true});window.Axyon.StorageVault.configure(window.__u43Vault)})()""")

def main():
    result={};errors=[];console=[];phase={'offline':False}
    with tempfile.TemporaryDirectory(prefix='axyon-u43-browser-') as td:
        db=Path(td)/'authority.sqlite';server,base=start_server(db)
        try:
            with sync_playwright() as pw:
                browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
                page=browser.new_page(viewport={'width':1280,'height':900})
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('console',lambda m:console.append(m.text) if m.type=='error' and not (phase['offline'] and 'ERR_CONNECTION_REFUSED' in m.text) else None)
                load_shell(page,base)
                page.wait_for_function("window.__axyon && window.Axyon.SaveService.diagnostics().prepared")
                page.fill('#first-commander-name','U4.3 Network Pilot');page.click('#first-commander-create')
                page.wait_for_function("document.getElementById('commander-onboarding').classList.contains('hidden')")
                actor=page.evaluate("window.Axyon.SaveService.currentProfileId()")
                state=page.evaluate("JSON.parse(JSON.stringify(window.__axyon.state))")
                status,_=request(f'{base}/v1/actors/{actor}/seed','POST',{'state':state,'revision':0},actor);assert status==201
                result['configured']=page.evaluate("window.Axyon.ServerNetwork.diagnostics()")
                command=page.evaluate("window.__axyon.runCommand('market.set-global-keep',{pct:25})")
                assert command['ok']
                page.wait_for_function("window.Axyon.DomainCommand.diagnostics(window.__axyon.state).pending===0 && window.Axyon.DomainCommand.diagnostics(window.__axyon.state).server.lastRevision===1",timeout=10000)
                _,snap=request(f'{base}/v1/actors/{actor}/snapshot',actor=actor)
                result['firstSync']={'pending':page.evaluate("window.Axyon.DomainCommand.diagnostics(window.__axyon.state).pending"),'serverRevision':snap['snapshot']['serverRevision'],'keepPct':snap['snapshot']['state']['market']['keepPct']}
                assert result['firstSync']=={'pending':0,'serverRevision':1,'keepPct':25}

                # Kill the process after first commit. A new optimistic command must remain in local outbox.
                phase['offline']=True
                stop_server(server)
                second=page.evaluate("window.__axyon.runCommand('market.set-global-keep',{pct:75})");assert second['ok']
                offline=page.evaluate("window.__axyon.syncAuthority()")
                result['offline']={'status':offline['status'],'pending':page.evaluate("window.Axyon.DomainCommand.diagnostics(window.__axyon.state).pending")}
                assert result['offline']['status']=='offline' and result['offline']['pending']==1

                server,base2=start_server(db)
                phase['offline']=False
                page.evaluate("base=>window.Axyon.ServerNetwork.configure(base,{persist:false})",base2)
                online=page.evaluate("window.__axyon.syncAuthority()")
                page.wait_for_function("window.Axyon.DomainCommand.diagnostics(window.__axyon.state).pending===0",timeout=10000)
                _,snap2=request(f'{base2}/v1/actors/{actor}/snapshot',actor=actor)
                result['restartSync']={'status':online['status'],'revision':snap2['snapshot']['serverRevision'],'keepPct':snap2['snapshot']['state']['market']['keepPct'],'pending':page.evaluate("window.Axyon.DomainCommand.diagnostics(window.__axyon.state).pending")}
                assert result['restartSync']=={'status':'online','revision':2,'keepPct':75,'pending':0}

                page.click('#btn-settings');result['uiStatus']=page.locator('#authority-network-status').inner_text();assert 'Sunucu' in result['uiStatus']
                page.set_viewport_size({'width':390,'height':844});result['overflow']={'scroll':page.evaluate('document.documentElement.scrollWidth'),'inner':page.evaluate('window.innerWidth')};assert result['overflow']['scroll']<=result['overflow']['inner']
                page.screenshot(path=str(REPORTS/'U4_3_PERSISTENT_NETWORK_MOBILE.png'),full_page=True)
                result['errors']=errors;result['consoleErrors']=console
                if errors or console:raise AssertionError({'page':errors,'console':console})
                browser.close()
        finally: stop_server(server)
    (REPORTS/'U4_3_BROWSER_SMOKE.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    (REPORTS/'U4_3_BROWSER_SMOKE.txt').write_text('PASS U4.3 real Chromium + HTTP + SQLite restart\n'+json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
