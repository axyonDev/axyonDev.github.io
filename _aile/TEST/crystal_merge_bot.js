/**
 * AXY Crystal — Merge Edition Bot v1
 * ─────────────────────────────────────────────────────────────────────
 * Oyun mekaniği: 5×7 grid, basılı tut → BFS komşular merge olur
 * Strateji: her hücre için merge skoru hesapla → en iyisini yap
 *
 * Kurulum: npm install puppeteer && node crystal_merge_bot.js
 */

const puppeteer = require('puppeteer');

const CONFIG = {
  gamePath: 'C:\\Users\\axy20\\Desktop\\TEST\\axy crystal merge.html',
  headless: false,

  // İnsan benzeri gecikme (ms)
  human: { minDelay: 350, maxDelay: 850, thinkDelay: 1400, mistakeChance: 0.02 },

  // Power-up eşikleri
  power: {
    smashMinVal: 2,     // Bu değer veya altını smash et
    smashMaxVal: 8,     // Yüksek değerli taşa smash yapma
    bombFullRate: 0.90, // Grid %90+ doluysa bomb kullan
    shuffleFullRate: 0.95, // %95+ doluysa shuffle
    freezeUseRate: 0.80,   // %80+ doluysa freeze
    undoUseRate: 0.85,     // %85+ doluysa undo
  },
};

const COLS = 5, ROWS = 7;
const PU_COST = { hint:40, undo:50, smash:50, shuffle:80, bomb:120, freeze:60 };

// ─── STATE OKUMA ─────────────────────────────────────────────────────
async function readState(page) {
  return page.evaluate(() => {
    try {
      const gOk = Array.isArray(G) && G.length > 0;
      const tEl = document.getElementById('goal-tile') ||
                  document.querySelector('.tb-val');
      // Hedefi HUD'dan al
      let goalVal = 2048;
      if (typeof TARGETS !== 'undefined' && typeof targetIdx !== 'undefined') {
        goalVal = TARGETS[targetIdx] || 2048;
      }

      // Oyun bitti mi?
      const overEl = document.getElementById('ov-gameover');
      const gameOver = overEl
        ? (overEl.classList.contains('show') ||
           overEl.style.display === 'flex' ||
           overEl.style.display === 'block')
        : false;

      // Level clear?
      const lcEl = document.getElementById('ov-lc') || document.getElementById('ov-levelclear');
      const levelClear = lcEl
        ? (lcEl.classList.contains('show') ||
           lcEl.style.display === 'flex' ||
           lcEl.style.display === 'block')
        : false;

      // Start ekranı
      const startEl = document.getElementById('ov-start');
      const onStart = startEl
        ? (startEl.classList.contains('show') ||
           startEl.style.display === 'flex' ||
           startEl.style.display === 'block')
        : false;

      return {
        grid: gOk ? JSON.parse(JSON.stringify(G)) : null,
        score: typeof score !== 'undefined' ? score : 0,
        coins: typeof coins !== 'undefined' ? coins : 0,
        goalVal,
        targetIdx: typeof targetIdx !== 'undefined' ? targetIdx : 0,
        active: typeof active !== 'undefined' ? active : false,
        busy: typeof busy !== 'undefined' ? busy : false,
        smashOn:  typeof smashOn  !== 'undefined' ? smashOn  : false,
        bombOn:   typeof bombOn   !== 'undefined' ? bombOn   : false,
        swapOn:   typeof swapOn   !== 'undefined' ? swapOn   : false,
        freezeActive: typeof freezeActive !== 'undefined' ? freezeActive : false,
        histLen:  Array.isArray(typeof hist !== 'undefined' ? hist : null)
                    ? hist.length : 0,
        gameOver,
        levelClear,
        onStart,
      };
    } catch(e) {
      return {
        grid: null, score:0, coins:0, goalVal:2048, targetIdx:0,
        active:false, busy:false, gameOver:false, levelClear:false, onStart:false,
        smashOn:false, bombOn:false, swapOn:false, freezeActive:false, histLen:0,
      };
    }
  });
}

// ─── BFS — MERGE GRUBu BUL ───────────────────────────────────────────
// Verilen (r,c) taşıyla aynı değere sahip, 8-yön bağlı tüm taşları döndürür.
function bfsGroup(g, r, c) {
  const v = g[r][c];
  if (!v) return [];
  const visited = new Set();
  const queue = [{r, c}];
  visited.add(`${r}-${c}`);
  const group = [{r, c}];

  while (queue.length) {
    const {r: qr, c: qc} = queue.shift();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nr = qr+dr, nc = qc+dc;
        const key = `${nr}-${nc}`;
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS
            && !visited.has(key) && g[nr][nc] === v) {
          visited.add(key);
          group.push({r:nr, c:nc});
          queue.push({r:nr, c:nc});
        }
      }
    }
  }
  return group;
}

// ─── HEURİSTİK: BİR MERGE HAMLESİNİN SKORU ──────────────────────────
// Oyunun kendi formülü: newV = baseV × 2^ceil(N/2)
function mergeValue(baseV, n) {
  return baseV * Math.pow(2, Math.ceil(n / 2));
}

function mergeScore(baseV, n) {
  const newV = mergeValue(baseV, n);
  const logV = Math.log2(newV);
  const count = n - 1;
  const comboBonus = count >= 8 ? 2.0 : count >= 5 ? 1.5 : count >= 3 ? 1.2 : 1.0;
  return Math.round(logV * n * comboBonus);
}

// ─── EN İYİ HAMLEYİ BUL ──────────────────────────────────────────────
function bestMove(g, goalVal) {
  let best = null;
  let bestScore = -Infinity;

  // Her hücreyi dene
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!g[r][c]) continue;

      const group = bfsGroup(g, r, c);
      if (group.length < 2) continue; // Tek taş merge olmaz

      const baseV = g[r][c];
      const n = group.length;
      const newV = mergeValue(baseV, n);

      // Temel merge skoru
      let score = mergeScore(baseV, n);

      // Hedefe ulaşma bonusu
      if (newV >= goalVal) score += 100000;
      else score += 50000 * (newV / goalVal);

      // Büyük merge bonusu (daha fazla taş temizleme = daha iyi)
      score += n * 200;

      // Değer bonusu: büyük değerleri merge etmek daha değerli
      score += Math.log2(newV) * 300;

      // Merkez tercihi: orta satırlarda merge daha iyi (gravity için)
      const centerR = (ROWS - 1) / 2;
      score += (1 - Math.abs(r - centerR) / centerR) * 50;

      if (score > bestScore) {
        bestScore = score;
        best = { r, c, group, score, newV, n, baseV };
      }
    }
  }
  return best;
}

// ─── DOLULUK ORANI ────────────────────────────────────────────────────
function fillRate(g) {
  let filled = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (g[r][c]) filled++;
  return filled / (ROWS * COLS);
}

function maxVal(g) {
  let m = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (g[r][c] > m) m = g[r][c];
  return m;
}

// ─── SMASH HEDEFİ BUL ────────────────────────────────────────────────
// Izgarada bloklayan küçük değerli, izole taşı bul
function smashTarget(g, coins) {
  if (coins < PU_COST.smash) return null;
  let worst = null, worstScore = Infinity;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      if (!v || v > CONFIG.power.smashMaxVal) continue;

      // Bu taşın merge grubu küçük mü?
      const group = bfsGroup(g, r, c);
      if (group.length >= 2) continue; // Zaten merge olabiliyorsa smash etme

      // Çevresinde çok farklı değer var mı? (blokluyor mu?)
      let isBlocking = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r+dr, nc = c+dc;
          if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&g[nr][nc]&&g[nr][nc]!==v)
            isBlocking++;
        }
      }

      const sc = v + isBlocking * 100 - r * 10; // üst satırlarda daha tehlikeli
      if (sc < worstScore) { worstScore = sc; worst = {r, c, v}; }
    }
  }
  return worst;
}

// ─── PUPPETEER YARDIMCILARI ────────────────────────────────────────────
async function clickPower(page, id) {
  await page.evaluate(btnId => {
    const b = document.getElementById(btnId);
    if (b) b.click();
  }, id);
}

// Taşa pointerdown + pointerup gönder (hold mekanizması için)
async function holdAndRelease(page, r, c, holdMs = 300) {
  const pos = await page.evaluate((row, col) => {
    const el = document.querySelector(`.block[data-r="${row}"][data-c="${col}"]`);
    if (!el) return null;
    const rc = el.getBoundingClientRect();
    return { x: rc.left + rc.width/2, y: rc.top + rc.height/2 };
  }, r, c);

  if (!pos) return false;

  await page.mouse.move(pos.x, pos.y);
  await page.mouse.down();
  await wait(holdMs + Math.random() * 80);
  await page.mouse.up();
  return true;
}

// Sadece tıkla (swap için)
async function clickBlock(page, r, c) {
  const pos = await page.evaluate((row, col) => {
    const el = document.querySelector(`.block[data-r="${row}"][data-c="${col}"]`);
    if (!el) return null;
    const rc = el.getBoundingClientRect();
    return { x: rc.left + rc.width/2, y: rc.top + rc.height/2 };
  }, r, c);
  if (pos) await page.mouse.click(pos.x, pos.y);
}

// ─── TERMİNAL ÇIKTI ───────────────────────────────────────────────────
const GRID_LINES = 9 + ROWS + 2; // panel yüksekliği
let gridPanelDrawn = false;
let milestoneLineCount = 0; // Birikmiş milestone satır sayısı

function print(g, state, moveNum, move, power) {
  const K = { r:'\x1b[0m', cy:'\x1b[36m', y:'\x1b[33m', gr:'\x1b[32m',
              d:'\x1b[2m', b:'\x1b[1m', m:'\x1b[35m', re:'\x1b[31m' };

  const gm = maxVal(g);
  const pct = Math.min(100, Math.round(gm / state.goalVal * 100));
  const bar = '█'.repeat(Math.round(pct/5)) + '░'.repeat(20-Math.round(pct/5));
  const fr = Math.round(fillRate(g) * 100);

  if (!gridPanelDrawn) {
    for (let i = 0; i < GRID_LINES; i++) process.stdout.write('\n');
    gridPanelDrawn = true;
  }

  // Cursor'ı: birikmiş milestone satırları + grid paneli kadar yukarı çık
  process.stdout.write(`\x1b[${GRID_LINES + milestoneLineCount}A`);

  const lines = [];
  lines.push(`${K.cy}╔══════════════════════════════════════════╗${K.r}`);
  lines.push(`${K.cy}║${K.b}  🤖 Crystal Merge Bot   Hamle: ${String(moveNum).padEnd(5)}${K.cy}  ║${K.r}`);
  lines.push(`${K.cy}╠══════════════════════════════════════════╣${K.r}`);
  lines.push(`${K.cy}║${K.r}  Skor: ${K.y}${String(state.score).padEnd(9)}${K.r} 🪙 ${K.gr}${String(state.coins).padEnd(6)}${K.r} ${K.cy}║${K.r}`);
  lines.push(`${K.cy}║${K.r}  Hedef:${K.gr}${String(state.goalVal).padEnd(8)}${K.r} Max: ${K.y}${String(gm).padEnd(8)}${K.r} ${K.cy}║${K.r}`);
  lines.push(`${K.cy}║${K.r}  [${K.gr}${bar}${K.r}] ${String(pct).padStart(3)}%         ${K.cy}║${K.r}`);
  lines.push(`${K.cy}║${K.r}  Doluluk: ${fr>=90?K.re:fr>=75?K.y:K.gr}%${fr}${K.r}                       ${K.cy}║${K.r}`);
  lines.push(`${K.cy}╚══════════════════════════════════════════╝${K.r}`);

  for (let r = 0; r < ROWS; r++) {
    let row = ' ';
    for (let c = 0; c < COLS; c++) {
      const v = g[r][c];
      const inMove   = move && move.group && move.group.some(t=>t.r===r&&t.c===c);
      const isCenter = move && move.r===r && move.c===c;
      if (!v)                     row += `${K.d}   · ${K.r}`;
      else if (isCenter)          row += `${K.cy}${K.b}${String(v).padStart(4)} ${K.r}`;
      else if (inMove)            row += `${K.gr}${String(v).padStart(4)} ${K.r}`;
      else if (v>=state.goalVal)  row += `${K.gr}${K.b}${String(v).padStart(4)} ${K.r}`;
      else if (v>=state.goalVal/4)row += `${K.y}${String(v).padStart(4)} ${K.r}`;
      else                        row += `${String(v).padStart(4)} `;
    }
    lines.push(row);
  }

  let status = '';
  if (power)      status = `  ${K.m}⚡ POWER: ${power}${K.r}                          `;
  else if (move)  status = `  ▼ (${move.r},${move.c}) → ${move.n} taş → ${move.newV}           `;
  else            status = `  ${K.re}⚠ Hamle bulunamadı!${K.r}                    `;
  lines.push('');
  lines.push(status);

  lines.forEach(l => process.stdout.write(l + '\x1b[K\n'));
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
function humanWait(slow = false) {
  const { minDelay, maxDelay, thinkDelay } = CONFIG.human;
  if (slow) return thinkDelay + Math.random() * 500;
  return minDelay + Math.random() * (maxDelay - minDelay);
}

// ─── MAIN ────────────────────────────────────────────────────────────
(async () => {
  console.log('🤖 Crystal Merge Bot v1 başlatılıyor...');
  const url = 'file:///' + CONFIG.gamePath.replace(/\\/g, '/');

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox','--disable-web-security','--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  console.log('✅ Sayfa yüklendi, oyun bekleniyor...');
  await wait(1500);

  // Oyunu başlat (start ekranı varsa)
  let st = await readState(page);
  if (st.onStart) {
    console.log('🎮 Start ekranı bulundu, oyun başlatılıyor...');
    // Önce "Yeni Oyun" düğmesine bas
    await page.evaluate(() => {
      const btn = document.getElementById('btn-start');
      if (btn) btn.click();
    });
    await wait(1200);
    st = await readState(page);
  }

  // Oyun aktif değilse başlat
  if (!st.active) {
    await page.evaluate(() => {
      if (typeof startGame === 'function') startGame();
    });
    await wait(1200);
  }

  console.log('✅ Hazır!\n');
  let moveNum = 0;
  let powerCD = 0;
  let noMoveCount = 0;

  // ── ZAMANLAMA SİSTEMİ ─────────────────────────────────────────────
  const gameStartTime = Date.now();
  let lastTargetTime  = Date.now();
  let lastTargetIdx   = -1;
  const milestones    = [];

  function fmtDur(ms) {
    const sn = Math.round(ms / 1000);
    if (sn < 60) return `${sn}s`;
    const dk = Math.floor(sn / 60), kalan = sn % 60;
    return kalan > 0 ? `${dk}dk ${kalan}s` : `${dk}dk`;
  }

  function fmtVal(v) {
    if (v >= 1073741824) return (v/1073741824).toFixed(v%1073741824===0?0:1)+'G';
    if (v >= 1048576)    return (v/1048576).toFixed(v%1048576===0?0:1)+'M';
    if (v >= 1024)       return (v/1024).toFixed(v%1024===0?0:1)+'K';
    return v.toString();
  }

  function nowStr() {
    const d = new Date();
    const p = n => String(n).padStart(2,'0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function checkMilestone(st) {
    if (st.targetIdx > lastTargetIdx) {
      const now      = Date.now();
      const sureBuMs = now - lastTargetTime;
      const sureTotMs= now - gameStartTime;
      for (let i = lastTargetIdx + 1; i <= st.targetIdx; i++) {
        const target = [2048,4096,8192,16384,32768,65536,131072,262144,524288,
                        1048576,2097152,4194304,8388608,16777216,33554432,67108864,
                        134217728,268435456,536870912,1073741824][i] || (Math.pow(2,11+i));
        const m = {
          target,
          sureBu    : fmtDur(sureBuMs),
          sureToplam: fmtDur(sureTotMs),
          hamle     : moveNum,
          skor      : st.score,
          zaman     : nowStr(),
        };
        milestones.push(m);

        const K = { r:'\x1b[0m', cy:'\x1b[36m', y:'\x1b[33m', gr:'\x1b[32m', b:'\x1b[1m', m:'\x1b[35m' };
        // Cursor'ı grid panelinin ALTINA taşı (milestone satırları başlangıcına)
        process.stdout.write(`\x1b[${GRID_LINES}B\x1b[1G`);
        process.stdout.write(`${K.m}${'─'.repeat(48)}${K.r}\n`);
        process.stdout.write(`${K.gr}${K.b}  🏆 HEDEF TAMAM: ${fmtVal(target).padEnd(8)}${K.r}\n`);
        process.stdout.write(`  Bu hedef : ${K.y}${m.sureBu.padEnd(10)}${K.r}  Toplam: ${K.cy}${m.sureToplam}${K.r}\n`);
        process.stdout.write(`  Hamle: ${m.hamle}   Skor: ${m.skor.toLocaleString('tr')}   Saat: ${K.cy}${m.zaman}${K.r}\n`);
        process.stdout.write(`${K.m}${'─'.repeat(48)}${K.r}\n`);
        // Bu milestone 5 satır yazdı, bunu izle
        milestoneLineCount += 5;
        // Cursor'ı grid paneli başına geri taşı (milestone + grid yukarısı)
        process.stdout.write(`\x1b[${GRID_LINES + milestoneLineCount}A\x1b[1G`);
      }
      lastTargetIdx  = st.targetIdx;
      lastTargetTime = now;
    }
  }

  function printFinalReport() {
    const K = { r:'\x1b[0m', cy:'\x1b[36m', y:'\x1b[33m', gr:'\x1b[32m',
                b:'\x1b[1m', m:'\x1b[35m', d:'\x1b[2m' };
    const toplamMs = Date.now() - gameStartTime;

    // Grid paneli + birikmiş milestone satırlarının altına geç
    process.stdout.write(`\x1b[${GRID_LINES + milestoneLineCount}B\x1b[1G`);
    process.stdout.write(`\n${K.cy}╔${'═'.repeat(52)}╗${K.r}\n`);
    process.stdout.write(`${K.cy}║${K.b}           📊 OYUN SONU RAPORU                   ${K.cy}║${K.r}\n`);
    process.stdout.write(`${K.cy}╠${'═'.repeat(52)}╣${K.r}\n`);
    process.stdout.write(`${K.cy}║${K.r}  Toplam süre : ${K.y}${fmtDur(toplamMs).padEnd(36)}${K.cy}║${K.r}\n`);
    process.stdout.write(`${K.cy}║${K.r}  Toplam hamle: ${K.y}${String(moveNum).padEnd(36)}${K.cy}║${K.r}\n`);
    process.stdout.write(`${K.cy}╠${'═'.repeat(52)}╣${K.r}\n`);
    process.stdout.write(`${K.cy}║${K.r}  ${'Hedef'.padEnd(8)} ${'Bu Hedef'.padEnd(11)} ${'Toplam'.padEnd(11)} ${'Hamle'.padEnd(7)} ${K.cy}║${K.r}\n`);
    process.stdout.write(`${K.cy}║${K.r}  ${'─'.repeat(48)} ${K.cy}║${K.r}\n`);
    if (milestones.length === 0) {
      process.stdout.write(`${K.cy}║${K.r}  ${K.d}Hiç hedefe ulaşılamadı.${K.r}                          ${K.cy}║${K.r}\n`);
    } else {
      milestones.forEach(m => {
        const hedef  = fmtVal(m.target).padEnd(8);
        const buHdf  = m.sureBu.padEnd(11);
        const toplam = m.sureToplam.padEnd(11);
        const hamle  = String(m.hamle).padEnd(7);
        process.stdout.write(`${K.cy}║${K.r}  ${K.gr}${hedef}${K.r} ${K.y}${buHdf}${K.r} ${K.cy}${toplam}${K.r} ${hamle} ${K.cy}║${K.r}\n`);
      });
    }
    process.stdout.write(`${K.cy}╚${'═'.repeat(52)}╝${K.r}\n\n`);
  }

  while (true) {
    st = await readState(page);

    // Oyun bitti
    if (st.gameOver) {
      console.log(`\n🎮 Oyun bitti! Skor: ${st.score} | Hamle: ${moveNum}`);
      printFinalReport();
      break;
    }

    // Level clear
    if (st.levelClear) {
      console.log('\n🏆 Bölüm tamamlandı! Devam...');
      await wait(1000);
      await page.evaluate(() => {
        const btn = document.getElementById('btn-next') ||
                    document.getElementById('btn-lc-next') ||
                    document.querySelector('#ov-lc button');
        if (btn) btn.click();
      });
      await wait(1500);
      noMoveCount = 0;
      continue;
    }

    if (!st.grid) { await wait(300); continue; }
    if (st.busy)  { await wait(150); continue; }
    if (!st.active) { await wait(300); continue; }

    // Hedef kontrolü — yeni bölüme geçildi mi?
    checkMilestone(st);

    const g = st.grid;
    const fr = fillRate(g);
    powerCD = Math.max(0, powerCD - 1);
    let usedPower = null;

    // ── POWER-UP MANTIĞI ────────────────────────────────────────────
    if (powerCD === 0) {

      // BOMB — grid çok doluysa
      if (!usedPower && st.coins >= PU_COST.bomb && fr >= CONFIG.power.bombFullRate) {
        console.log('\n💣 BOMB!');
        await wait(600);
        await clickPower(page, 'pu-bomb');
        await wait(400);
        // Bomb modunda bir taşa tıkla (en kalabalık bölge)
        let bestBombR = -1, bestBombC = -1, bestCount = -1;
        for (let r = 1; r < ROWS-1; r++) {
          for (let c = 1; c < COLS-1; c++) {
            if (!g[r][c]) continue;
            let cnt = 0;
            for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) if(g[r+dr]?.[c+dc]) cnt++;
            if (cnt > bestCount) { bestCount=cnt; bestBombR=r; bestBombC=c; }
          }
        }
        if (bestBombR >= 0) await clickBlock(page, bestBombR, bestBombC);
        usedPower = 'bomb'; powerCD = 4;
        await wait(700);
      }

      // SHUFFLE — neredeyse tamamen dolu
      if (!usedPower && st.coins >= PU_COST.shuffle && fr >= CONFIG.power.shuffleFullRate) {
        console.log('\n🔀 SHUFFLE!');
        await wait(500);
        await clickPower(page, 'pu-shuffle');
        usedPower = 'shuffle'; powerCD = 4;
        await wait(800);
      }

      // FREEZE — doluluk yüksekse spawn'u atla
      if (!usedPower && st.coins >= PU_COST.freeze && fr >= CONFIG.power.freezeUseRate) {
        console.log('\n❄️ FREEZE!');
        await wait(400);
        await clickPower(page, 'pu-freeze');
        usedPower = 'freeze'; powerCD = 2;
        await wait(400);
      }

      // UNDO — dolu ve hamle yok
      if (!usedPower && st.coins >= PU_COST.undo && fr >= CONFIG.power.undoUseRate && st.histLen > 0) {
        console.log('\n↩️ UNDO!');
        await wait(500);
        await clickPower(page, 'pu-undo');
        usedPower = 'undo'; powerCD = 3;
        await wait(600);
      }

      // SMASH — blokluyan izole küçük taş
      if (!usedPower) {
        const sm = smashTarget(g, st.coins);
        if (sm) {
          console.log(`\n🔨 SMASH (${sm.r},${sm.c}) val=${sm.v}`);
          await wait(500);
          await clickPower(page, 'pu-smash');
          await wait(350);
          await clickBlock(page, sm.r, sm.c);
          usedPower = 'smash'; powerCD = 3;
          await wait(600);
        }
      }
    }

    // Power kullanıldıysa state yenile
    if (usedPower) {
      await wait(400);
      const s2 = await readState(page);
      if (!s2.grid || s2.busy) { await wait(600); continue; }
    }

    // Güncel state al
    const fresh = await readState(page);
    if (!fresh.grid || fresh.busy || !fresh.active) { await wait(200); continue; }

    // En iyi hamleyi bul
    const move = bestMove(fresh.grid, fresh.goalVal);

    print(fresh.grid, fresh, moveNum, move, usedPower);

    if (!move) {
      // Hamle yok — shuffle veya shuffle olmadan bekle
      noMoveCount++;
      console.log(`\n⚠ Hamle bulunamadı (${noMoveCount}. kez). Shuffle denenecek...`);
      if (fresh.coins >= PU_COST.shuffle) {
        await clickPower(page, 'pu-shuffle');
        await wait(900);
      } else {
        await wait(500);
      }
      if (noMoveCount > 5) {
        console.log('\n❌ 5 kez hamle bulunamadı — çıkılıyor.');
        break;
      }
      continue;
    }
    noMoveCount = 0;

    // Hamle yap: merkez taşa basılı tut → bırak
    const holdTime = humanWait() + 50; // merge için 175ms eşik + biraz fazla
    await wait(holdTime * 0.4); // düşünme gecikmesi
    await holdAndRelease(page, move.r, move.c, Math.max(220, holdTime * 0.6));
    moveNum++;

    // Sonraki hamle için bekle (animasyonlar bitsin)
    const animWait = move.n >= 5 ? 700 : move.n >= 3 ? 500 : 350;
    await wait(animWait + Math.random() * 200);
  }

  console.log('\n🤖 Bot tamamlandı.');
  printFinalReport();
  await browser.close();
})();
