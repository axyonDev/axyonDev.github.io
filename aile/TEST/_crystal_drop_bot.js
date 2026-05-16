/**
 * Crystal Drop Bot v4 — Akıllı Strateji
 * npm install puppeteer && node crystal_drop_bot.js
 */
const puppeteer = require('puppeteer');

const CONFIG = {
  gamePath: 'C:\\Users\\axy20\\Desktop\\TEST\\Axy Sum_ Crystal Drop.html',
  headless: false,
  maxMoves: 0,
  searchDepth: 3,       // kaç hamle ileriye bak (3 = iyi denge)
  human: { minDelay: 400, maxDelay: 950, thinkDelay: 1600, mistakeChance: 0.03 },
  power: { x2MinVal: 32, smashMaxVal: 16, smashMinHeight: 7,
           swapMinVal: 64, undoFullCols: 2, bombFullCols: 4 },
};

const COLS = 5, ROWS = 8;
const POWER_COST = { smash:100, swap:100, x2:50, undo:50, bomb:500 };

// ─── STATE ───────────────────────────────────────────────────────────────────
async function readState(page) {
  return page.evaluate(() => {
    try {
      const raw = typeof grid !== 'undefined' ? grid : null;
      const ok = Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]);
      const goalEl = document.getElementById('goal-tile');
      const goalVal = goalEl ? (parseInt(goalEl.textContent.trim()) || 256) : 256;
      const gemsEl = document.getElementById('gems-count');
      return {
        grid: ok ? JSON.parse(JSON.stringify(raw)) : null,
        nextVal: typeof nextVal !== 'undefined' ? nextVal : 2,
        nextNextVal: typeof nextNextVal !== 'undefined' ? nextNextVal : 2,
        nextX2: typeof nextX2 !== 'undefined' ? nextX2 : false,
        score: typeof score !== 'undefined' ? score : 0,
        dropLocked: typeof dropLocked !== 'undefined' ? dropLocked : false,
        gameOver: document.getElementById('overlay')?.classList.contains('show') || false,
        milestonePopup: document.getElementById('milestone-popup')?.classList.contains('show') || false,
        goalVal,
        gems: gemsEl ? (parseInt(gemsEl.textContent) || 0) : 0,
        level: typeof level !== 'undefined' ? level : 1,
        historyLen: Array.isArray(typeof history !== 'undefined' ? history : null) ? history.length : 0,
      };
    } catch(e) {
      return { grid:null, nextVal:2, nextNextVal:2, nextX2:false, score:0,
               dropLocked:false, gameOver:false, milestonePopup:false,
               goalVal:256, gems:0, level:1, historyLen:0 };
    }
  });
}

// ─── SİMÜLASYON ──────────────────────────────────────────────────────────────
function gravity(g) {
  for (let c = 0; c < COLS; c++) {
    let w = ROWS-1;
    for (let r = ROWS-1; r >= 0; r--)
      if (g[r][c]) { g[w][c]=g[r][c]; if(w!==r) g[r][c]=0; w--; }
    for (let r=w; r>=0; r--) g[r][c]=0;
  }
}

function mergeOnce(g) {
  let merged = false;
  for (let c=0;c<COLS;c++)
    for (let r=ROWS-1;r>0;r--)
      if (g[r][c] && g[r][c]===g[r-1][c]) { g[r][c]*=2; g[r-1][c]=0; merged=true; }
  for (let r=0;r<ROWS;r++)
    for (let c=0;c<COLS-1;c++)
      if (g[r][c] && g[r][c]===g[r][c+1]) { g[r][c]*=2; g[r][c+1]=0; merged=true; }
  return merged;
}

function drop(g, col, val) {
  let tRow = -1;
  for (let r=ROWS-1;r>=0;r--) if(!g[r][col]){tRow=r;break;}
  if (tRow===-1) return null;
  const ng = g.map(r=>[...r]);
  ng[tRow][col] = val;
  let ms=0, mc=0, maxC=val;
  for (let i=0;i<12;i++) {
    gravity(ng);
    if (!mergeOnce(ng)) break;
    mc++;
    for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++)
      if (ng[r][c]>maxC){maxC=ng[r][c];ms+=ng[r][c];}
  }
  gravity(ng);
  return {g:ng, ms, mc, maxC};
}

// ─── HEURİSTİK PUANLAMA ───────────────────────────────────────────────────────
function heuristic(g, goalVal) {
  let score = 0;
  let emptyCells = 0;
  let maxV = 0;

  for (let r=0;r<ROWS;r++)
    for (let c=0;c<COLS;c++) {
      if (!g[r][c]) { emptyCells++; continue; }
      if (g[r][c]>maxV) maxV=g[r][c];
    }

  // 1. BOŞ HÜCRE BONUSU — en önemli faktör (hareket serbestisi)
  score += emptyCells * 40;

  // 2. MAX DEĞER BONUSU
  score += Math.log2(maxV+1) * 80;
  if (maxV >= goalVal) score += 5000;
  else score += 1500 * (maxV / goalVal);

  // 3. MONOTONİCİTY — büyük değerler altta, küçükler üstte
  for (let c=0;c<COLS;c++) {
    let mono = 0;
    for (let r=ROWS-1;r>0;r--) {
      if (!g[r][c]) continue;
      if (g[r][c] >= (g[r-1][c]||0)) mono += Math.log2(g[r][c]+1);
      else mono -= Math.log2(g[r][c]+1) * 1.5;
    }
    score += mono * 5;
  }

  // 4. SMOOTHNESS — komşu hücreler arasındaki fark küçük olsun
  // (birleşme fırsatı = iyi)
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    if (!g[r][c]) continue;
    // Sağ komşu
    if (c+1<COLS && g[r][c+1]) {
      if (g[r][c]===g[r][c+1]) score += g[r][c] * 3; // merge fırsatı!
      else score -= Math.abs(Math.log2(g[r][c]) - Math.log2(g[r][c+1])) * 8;
    }
    // Alt komşu
    if (r+1<ROWS && g[r+1][c]) {
      if (g[r][c]===g[r+1][c]) score += g[r][c] * 3;
      else score -= Math.abs(Math.log2(g[r][c]) - Math.log2(g[r+1][c])) * 8;
    }
  }

  // 5. KOLON YOĞUNLAŞMA — aynı değerler aynı kolonda olsun
  // Her kolonun "en baskın değerini" bul, diğerleri ceza
  const colVals = Array.from({length:COLS}, (_,c) => {
    const vals = {};
    for (let r=0;r<ROWS;r++) if(g[r][c]) vals[g[r][c]]=(vals[g[r][c]]||0)+1;
    return vals;
  });
  for (const vals of colVals) {
    const counts = Object.values(vals);
    if (counts.length > 0) score += Math.max(...counts) * 15;
  }

  // 6. DOLULUK CEZASI — dolu ya da neredeyse dolu kolonlar tehlikeli
  for (let c=0;c<COLS;c++) {
    let h=0; for (let r=0;r<ROWS;r++) if(g[r][c]) h++;
    if (h===ROWS)   score -= 3000; // tamamen dolu
    else if (h>=ROWS-1) score -= 800;
    else if (h>=ROWS-2) score -= 200;
  }

  // 7. MAX DEĞER KÖŞEDE Mİ? (köşe stratejisi bonusu)
  if (g[ROWS-1][0]===maxV || g[ROWS-1][COLS-1]===maxV) score += 150;

  return score;
}

// ─── DERİN ARAMA (minimax benzeri, 3 kat) ────────────────────────────────────
function search(g, val, nextVal, goalVal, depth) {
  let bestCol = -1, bestScore = -Infinity;

  for (let c=0;c<COLS;c++) {
    const res = drop(g, c, val);
    if (!res) continue;

    let score = res.ms * 3 + res.mc * 40;

    // Hedefe ulaştıysa büyük bonus
    if (res.maxC >= goalVal) score += 8000;
    else score += 2000 * (res.maxC / goalVal);

    // Heuristik değerlendirme
    score += heuristic(res.g, goalVal) * 0.8;

    // Daha derine in
    if (depth > 1 && nextVal > 0) {
      // Bir sonraki taşın en iyi hamlesini bul
      let bestNext = -Infinity;
      for (let c2=0;c2<COLS;c2++) {
        const res2 = drop(res.g, c2, nextVal);
        if (!res2) continue;
        let s2 = res2.ms*2 + res2.mc*30 + heuristic(res2.g, goalVal)*0.6;
        if (res2.maxC >= goalVal) s2 += 5000;

        // 3. kat: basit heuristik
        if (depth > 2) {
          let bestNext2 = -Infinity;
          for (let c3=0;c3<COLS;c3++) {
            const res3 = drop(res2.g, c3, nextVal===2?4:nextVal/2);
            if (!res3) continue;
            const s3 = res3.ms + heuristic(res3.g, goalVal)*0.4;
            if (s3>bestNext2) bestNext2=s3;
          }
          s2 += bestNext2 * 0.4;
        }

        if (s2>bestNext) bestNext=s2;
      }
      score += bestNext * 0.55;
    }

    if (score > bestScore) { bestScore=score; bestCol=c; }
  }

  // Hiçbir yer yoksa en az dolu kolon
  if (bestCol===-1) {
    let minH=Infinity;
    for (let c=0;c<COLS;c++){
      let h=0; for(let r=0;r<ROWS;r++) if(g[r][c])h++;
      if(h<minH){minH=h;bestCol=c;}
    }
  }
  return { col: bestCol, score: bestScore };
}

// ─── POWER-UP ─────────────────────────────────────────────────────────────────
function colHeight(g,c){let h=0;for(let r=0;r<ROWS;r++)if(g[r][c])h++;return h;}
function topRow(g,c){for(let r=0;r<ROWS;r++)if(g[r][c])return r;return -1;}
function maxVal(g){let m=0;for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++)if(g[r][c]>m)m=g[r][c];return m;}
function fullCols(g){let n=0;for(let c=0;c<COLS;c++){let h=0;for(let r=0;r<ROWS;r++)if(g[r][c])h++;if(h===ROWS)n++;}return n;}

function shouldX2(g, nextVal, gems, goalVal) {
  if (gems<POWER_COST.x2 || nextVal<CONFIG.power.x2MinVal) return false;
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++)
    if(g[r][c]===nextVal || g[r][c]===nextVal*2) return true;
  return nextVal >= goalVal/4;
}

function smashTarget(g, gems) {
  if (gems<POWER_COST.smash) return null;
  let worst=null, worstS=Infinity;
  for (let c=0;c<COLS;c++) {
    const h=colHeight(g,c);
    if (h<CONFIG.power.smashMinHeight) continue;
    const tr=topRow(g,c); if(tr===-1) continue;
    const v=g[tr][c]; if(v>CONFIG.power.smashMaxVal) continue;
    const bs=v-h*10;
    if(bs<worstS){worstS=bs;worst={r:tr,c};}
  }
  return worst;
}

function swapTarget(g, gems, goalVal) {
  if (gems<POWER_COST.swap) return null;
  const minV=Math.max(CONFIG.power.swapMinVal, goalVal/8);
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS-2;c++)
      if(g[r][c]>=minV && g[r][c]===g[r][c+2] && g[r][c+1])
        return {r1:r,c1:c+1,r2:r,c2:c+2};
  for(let c=0;c<COLS;c++)
    for(let r=0;r<ROWS-2;r++)
      if(g[r][c]>=minV && g[r][c]===g[r+2][c] && g[r+1][c])
        return {r1:r+1,c1:c,r2:r+2,c2:c};
  return null;
}

// ─── PUPPETEER ────────────────────────────────────────────────────────────────
async function clickPower(page,type){
  await page.evaluate(t=>{ const b=document.getElementById(`pu-${t}`); if(b)b.click(); },type);
}
async function clickBlock(page,r,c){
  const pos=await page.evaluate((row,col)=>{
    const el=document.querySelector(`.block[data-r="${row}"][data-c="${col}"]`);
    if(!el)return null;
    const rc=el.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  },r,c);
  if(pos) await page.mouse.click(pos.x,pos.y);
}
async function clickCol(page,col){
  await page.evaluate(i=>{ const b=document.querySelectorAll('.col-btn'); if(b[i])b[i].click(); },col);
}

// ─── TERMİNAL ────────────────────────────────────────────────────────────────
function print(g, state, moveNum, col, isHard, power) {
  const K={r:'\x1b[0m',cy:'\x1b[36m',y:'\x1b[33m',gr:'\x1b[32m',
           d:'\x1b[2m',b:'\x1b[1m',m:'\x1b[35m',re:'\x1b[31m'};
  console.clear();
  const val=state.nextX2?state.nextVal*2:state.nextVal;
  const gm=maxVal(g);
  const pct=Math.min(100,Math.round(gm/state.goalVal*100));
  const bar='█'.repeat(Math.round(pct/5))+'░'.repeat(20-Math.round(pct/5));
  console.log(`${K.cy}╔══════════════════════════════════════════╗${K.r}`);
  console.log(`${K.cy}║${K.b}  🤖 Crystal Drop Bot   Hamle: ${String(moveNum).padEnd(6)}${K.cy}  ║${K.r}`);
  console.log(`${K.cy}╠══════════════════════════════════════════╣${K.r}`);
  console.log(`${K.cy}║${K.r}  Skor: ${K.y}${String(state.score).padEnd(9)}${K.r} 💎 ${K.gr}${String(state.gems).padEnd(6)}${K.r}   ${K.cy}║${K.r}`);
  console.log(`${K.cy}║${K.r}  Hedef:${K.gr}${String(state.goalVal).padEnd(8)}${K.r} Max: ${K.y}${String(gm).padEnd(8)}${K.r} ${K.cy}║${K.r}`);
  console.log(`${K.cy}║${K.r}  [${K.gr}${bar}${K.r}] ${String(pct).padStart(3)}%         ${K.cy}║${K.r}`);
  console.log(`${K.cy}║${K.r}  Sonraki:${K.b}${K.y}${String(val).padEnd(5)}${K.r} → ${K.d}${state.nextNextVal}${K.r}               ${K.cy}║${K.r}`);
  console.log(`${K.cy}╚══════════════════════════════════════════╝${K.r}`);
  for(let r=0;r<ROWS;r++){
    process.stdout.write(' ');
    for(let c=0;c<COLS;c++){
      const v=g[r][c];
      if(!v)                        process.stdout.write(`${K.d}  · ${K.r}`);
      else if(v>=state.goalVal)     process.stdout.write(`${K.gr}${K.b}${String(v).padStart(3)} ${K.r}`);
      else if(v>=state.goalVal/2)   process.stdout.write(`${K.y}${String(v).padStart(3)} ${K.r}`);
      else                          process.stdout.write(`${String(v).padStart(3)} `);
    }
    process.stdout.write('\n');
  }
  const cs=[0,1,2,3,4].map(c=>c===col?`${K.cy}${K.b} C${c}${K.r}`:`${K.d} C${c}${K.r}`).join(' ');
  console.log(` ${cs}`);
  if(power)      console.log(`\n  ${K.m}⚡ POWER: ${power.toUpperCase()}${K.r}`);
  else if(isHard)console.log(`\n  ${K.m}🤔 Zor karar...${K.r}`);
  else           console.log(`\n  ▼ Kolon ${col} → ${val}`);
}

function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }
function humanWait(hard){
  const{minDelay,maxDelay,thinkDelay}=CONFIG.human;
  if(hard) return thinkDelay+Math.random()*700;
  const t=Math.random();
  return t<0.12?minDelay*0.6:t>0.88?maxDelay*1.3:minDelay+Math.random()*(maxDelay-minDelay);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
(async()=>{
  console.log('🤖 Crystal Drop Bot v4 başlatılıyor...');
  const url='file:///'+CONFIG.gamePath.replace(/\\/g,'/');
  const browser=await puppeteer.launch({
    headless:CONFIG.headless,
    args:['--no-sandbox','--disable-web-security','--allow-file-access-from-files'],
  });
  const page=await browser.newPage();
  await page.setViewport({width:480,height:900});
  await page.goto(url,{waitUntil:'networkidle0'});
  await page.waitForSelector('.col-btn',{timeout:10000});
  console.log('✅ Hazır!\n');
  await wait(1200);

  let moveNum=0, powerCD=0;

  // ── ZAMANLAMA SİSTEMİ ─────────────────────────────────────────────
  const gameStartTime = Date.now();
  let lastTargetTime  = Date.now();
  let lastGoalVal     = -1;
  const milestones    = [];

  function fmtDur(ms) {
    const sn = Math.round(ms / 1000);
    if (sn < 60) return `${sn}s`;
    const dk = Math.floor(sn / 60), kalan = sn % 60;
    return kalan > 0 ? `${dk}dk ${kalan}s` : `${dk}dk`;
  }

  function nowStr() {
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function checkMilestone(goalVal, score) {
    // goalVal değişti = yeni bölüme geçildi
    if (lastGoalVal !== -1 && goalVal !== lastGoalVal) {
      const now       = Date.now();
      const sureBuMs  = now - lastTargetTime;
      const sureTotMs = now - gameStartTime;
      const K = { r:'\x1b[0m', cy:'\x1b[36m', y:'\x1b[33m', gr:'\x1b[32m', b:'\x1b[1m', m:'\x1b[35m' };
      const m = {
        target    : lastGoalVal,
        sureBu    : fmtDur(sureBuMs),
        sureToplam: fmtDur(sureTotMs),
        hamle     : moveNum,
        skor      : score,
        zaman     : nowStr(),
      };
      milestones.push(m);
      console.log(`\n${K.m}${'─'.repeat(48)}${K.r}`);
      console.log(`${K.gr}${K.b}  🏆 HEDEF TAMAM: ${String(lastGoalVal).padEnd(8)}${K.r}`);
      console.log(`  Bu hedef : ${K.y}${m.sureBu}${K.r}`);
      console.log(`  Toplam   : ${K.cy}${m.sureToplam}${K.r}  (${m.hamle} hamle, skor: ${m.skor.toLocaleString('tr')})`);
      console.log(`  Saat     : ${K.cy}${m.zaman}${K.r}`);
      console.log(`${K.m}${'─'.repeat(48)}${K.r}\n`);
      lastTargetTime = now;
    }
    lastGoalVal = goalVal;
  }

  function printFinalReport() {
    const K = { r:'\x1b[0m', cy:'\x1b[36m', y:'\x1b[33m', gr:'\x1b[32m',
                b:'\x1b[1m', m:'\x1b[35m', d:'\x1b[2m' };
    const toplamMs = Date.now() - gameStartTime;
    console.log(`\n${K.cy}╔${'═'.repeat(52)}╗${K.r}`);
    console.log(`${K.cy}║${K.b}           📊 OYUN SONU RAPORU                   ${K.cy}║${K.r}`);
    console.log(`${K.cy}╠${'═'.repeat(52)}╣${K.r}`);
    console.log(`${K.cy}║${K.r}  Toplam süre : ${K.y}${fmtDur(toplamMs).padEnd(36)}${K.cy}║${K.r}`);
    console.log(`${K.cy}║${K.r}  Toplam hamle: ${K.y}${String(moveNum).padEnd(36)}${K.cy}║${K.r}`);
    console.log(`${K.cy}╠${'═'.repeat(52)}╣${K.r}`);
    console.log(`${K.cy}║${K.r}  ${'Hedef'.padEnd(8)} ${'Bu Hedef'.padEnd(11)} ${'Toplam'.padEnd(11)} ${'Hamle'.padEnd(7)} ${K.cy}║${K.r}`);
    console.log(`${K.cy}║${K.r}  ${'─'.repeat(48)} ${K.cy}║${K.r}`);
    if (milestones.length === 0) {
      console.log(`${K.cy}║${K.r}  ${K.d}Hiç hedefe ulaşılamadı.${K.r}                          ${K.cy}║${K.r}`);
    } else {
      milestones.forEach(m => {
        const hedef  = String(m.target).padEnd(8);
        const buHdf  = m.sureBu.padEnd(11);
        const toplam = m.sureToplam.padEnd(11);
        const hamle  = String(m.hamle).padEnd(7);
        console.log(`${K.cy}║${K.r}  ${K.gr}${hedef}${K.r} ${K.y}${buHdf}${K.r} ${K.cy}${toplam}${K.r} ${hamle} ${K.cy}║${K.r}`);
      });
    }
    console.log(`${K.cy}╚${'═'.repeat(52)}╝${K.r}`);
  }

  while(true){
    const st=await readState(page);
    if(st.gameOver){ console.log(`\n🎮 Bitti! Skor:${st.score} Hamle:${moveNum}`); printFinalReport(); break; }
    if(!st.grid)   { await wait(300); continue; }
    if(st.dropLocked){ await wait(150); continue; }

    // Zamanlama: goalVal değişti mi?
    checkMilestone(st.goalVal, st.score);

    // Milestone claim
    if(st.milestonePopup){
      console.log('\n🏆 Hedefe ulaşıldı! Claim yapılıyor...');
      await wait(1100);
      await page.evaluate(()=>{ if(typeof claimMilestone==='function') claimMilestone(); });
      console.log('💎 Claim OK — devam!');
      await wait(500);
      continue;
    }

    const val=st.nextX2?st.nextVal*2:st.nextVal;
    const{grid:g,gems,goalVal,nextNextVal,historyLen}=st;
    powerCD=Math.max(0,powerCD-1);
    let usedPower=null;

    // ── POWERLAR ────────────────────────────────────────────────────────────
    if(powerCD===0){
      // BOMB — 4+ kolon dolu
      if(!usedPower && gems>=POWER_COST.bomb && fullCols(g)>=CONFIG.power.bombFullCols){
        console.log('\n💣 BOMB!'); await wait(700);
        await clickPower(page,'bomb'); usedPower='bomb'; powerCD=5; await wait(600);
      }
      // UNDO — 2+ kolon dolu
      if(!usedPower && gems>=POWER_COST.undo && historyLen>0 && fullCols(g)>=CONFIG.power.undoFullCols){
        console.log('\n↩️ UNDO'); await wait(500);
        await clickPower(page,'undo'); usedPower='undo'; powerCD=3; await wait(500);
      }
      // SMASH — tehlikeli kolon + işe yaramaz blok
      if(!usedPower){
        const st2=smashTarget(g,gems);
        if(st2){
          console.log(`\n💥 SMASH (${st2.r},${st2.c}) val=${g[st2.r][st2.c]}`);
          await wait(600);
          await clickPower(page,'smash'); await wait(350);
          await clickBlock(page,st2.r,st2.c); usedPower='smash'; powerCD=3; await wait(600);
        }
      }
      // SWAP — aynı değerli blokları birleştir
      if(!usedPower){
        const sw=swapTarget(g,gems,goalVal);
        if(sw){
          console.log(`\n🔄 SWAP`); await wait(600);
          await clickPower(page,'swap'); await wait(350);
          await clickBlock(page,sw.r1,sw.c1); await wait(280);
          await clickBlock(page,sw.r2,sw.c2); usedPower='swap'; powerCD=4; await wait(700);
        }
      }
      // X2 — büyük taş, eşleşme var
      if(!usedPower && !st.nextX2 && shouldX2(g,st.nextVal,gems,goalVal)){
        console.log(`\n⚡ X2 nextVal=${st.nextVal}`);
        await clickPower(page,'x2'); usedPower='x2'; powerCD=2; await wait(300);
      }
    }

    // Power sonrası state değişmiş olabilir
    if(usedPower && usedPower!=='x2'){
      await wait(400);
      const s2=await readState(page);
      if(!s2.grid||s2.dropLocked){ await wait(500); continue; }
    }

    const fresh=await readState(page);
    if(!fresh.grid||fresh.dropLocked){ await wait(200); continue; }
    const fVal=fresh.nextX2?fresh.nextVal*2:fresh.nextVal;

    // Derin arama
    const{col:chosen,score:topScore}=search(fresh.grid,fVal,fresh.nextNextVal,fresh.goalVal,CONFIG.searchDepth);

    // Zor karar — top2 farkı az
    const scores=[0,1,2,3,4].map(c=>drop(fresh.grid,c,fVal)?search(fresh.grid,fVal,fresh.nextNextVal,fresh.goalVal,1).score:-Infinity).sort((a,b)=>b-a);
    const isHard=scores.length>1&&(scores[0]-scores[1])<80;

    // %3 hata
    let finalCol=chosen;
    if(Math.random()<CONFIG.human.mistakeChance){
      const avail=[0,1,2,3,4].filter(c=>{
        let h=0;for(let r=0;r<ROWS;r++)if(fresh.grid[r][c])h++;return h<ROWS&&c!==chosen;
      });
      if(avail.length) finalCol=avail[Math.floor(Math.random()*avail.length)];
    }

    print(fresh.grid,fresh,moveNum,finalCol,isHard,usedPower);
    await humanWait(isHard&&!usedPower);
    await clickCol(page,finalCol);
    moveNum++;

    if(CONFIG.maxMoves>0&&moveNum>=CONFIG.maxMoves){ console.log('\n⏹ Bitti.'); printFinalReport(); break; }
  }
  console.log('\n🤖 Tamamlandı.');
  printFinalReport();
})();
