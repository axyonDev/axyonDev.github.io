// --- Accordion Logic ---
document.querySelectorAll('.category-header').forEach(header => {
  header.addEventListener('click', () => {
    const container = header.closest('.category-container');
    container.classList.toggle('collapsed');
  });
});

// --- Background Canvas Animation ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let W, H;
let mouse = { x: -999, y: -999 };
let stars = [], shootingStars = [], dustMotes = [], fairies = [], trailDust = [];
let t0 = null;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  for (let i = 0; i < 4; i++) spawnTrailDust(e.clientX, e.clientY);
});
window.addEventListener('touchmove', e => {
  const t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
  for (let i = 0; i < 3; i++) spawnTrailDust(t.clientX, t.clientY);
}, { passive: true });

const dustColors = [
  [180, 120, 255], [91, 200, 245], [255, 180, 240],
  [240, 200, 80], [150, 255, 200], [255, 255, 255],
];

function randColor() { return dustColors[Math.floor(Math.random() * dustColors.length)]; }

for (let i = 0; i < 200; i++) {
  stars.push({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 1.3 + 0.15,
    a: Math.random() * 0.65 + 0.1,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.0008 + 0.0002
  });
}

for (let i = 0; i < 55; i++) {
  dustMotes.push(makeDustMote(true));
}

function makeDustMote(randomY) {
  const [r, g, b] = randColor();
  return {
    x: Math.random() * W,
    y: randomY ? Math.random() * H : H + 10,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -(Math.random() * 0.5 + 0.15),
    r: Math.random() * 2.5 + 0.6,
    alpha: Math.random() * 0.6 + 0.2,
    maxAlpha: Math.random() * 0.6 + 0.2,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.003 + 0.001,
    cr: r, cg: g, cb: b,
    wobble: (Math.random() - 0.5) * 0.008,
    life: 1, maxLife: 200 + Math.random() * 400
  };
}

function spawnTrailDust(x, y) {
  const [r, g, b] = randColor();
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 1.8 + 0.3;
  trailDust.push({
    x: x + (Math.random() - 0.5) * 12,
    y: y + (Math.random() - 0.5) * 12,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 0.8,
    r: Math.random() * 3 + 1,
    alpha: 0.9,
    cr: r, cg: g, cb: b,
    decay: Math.random() * 0.025 + 0.018,
    gravity: 0.04
  });
}

for (let i = 0; i < 6; i++) {
  fairies.push(makeFairy());
}

function makeFairy() {
  const [r, g, b] = randColor();
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 5 + 4,
    alpha: Math.random() * 0.4 + 0.15,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.002 + 0.001,
    cr: r, cg: g, cb: b,
    trail: []
  };
}

function spawnShooter() {
  shootingStars.push({
    x: W * (0.3 + Math.random() * 0.7),
    y: Math.random() * H * 0.35,
    vx: -2.8 - Math.random() * 2.2,
    vy: 1.6 + Math.random() * 1.4,
    len: 100 + Math.random() * 90,
    alpha: 1,
    width: 1.2 + Math.random() * 1
  });
  setTimeout(spawnShooter, 1600 + Math.random() * 3000);
}
spawnShooter();

let auroraT = 0;

function drawAurora(t) {
  auroraT = t * 0.0003;
  const bands = [
    { y: H * 0.0, h: H * 0.45, cr: 80, cg: 40, cb: 180, a: 0.04 },
    { y: H * 0.05, h: H * 0.30, cr: 40, cg: 120, cb: 220, a: 0.035 },
    { y: H * 0.0, h: H * 0.20, cr: 180, cg: 60, cb: 200, a: 0.025 },
  ];
  bands.forEach((b, i) => {
    const wave = Math.sin(auroraT + i * 1.4) * 0.5 + 0.5;
    const grd = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    grd.addColorStop(0, `rgba(${b.cr},${b.cg},${b.cb},${b.a * wave})`);
    grd.addColorStop(0.5, `rgba(${b.cr},${b.cg},${b.cb},${b.a * wave * 0.6})`);
    grd.addColorStop(1, `rgba(${b.cr},${b.cg},${b.cb},0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, b.y, W, b.h);
  });
}

function drawSparkle(x, y, size, alpha, r, g, b) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const arms = 4;
  for (let i = 0; i < arms; i++) {
    ctx.save();
    ctx.rotate((Math.PI / arms) * i);
    const grd = ctx.createLinearGradient(0, -size, 0, size);
    grd.addColorStop(0, `rgba(${r},${g},${b},0)`);
    grd.addColorStop(0.5, `rgba(${r},${g},${b},${alpha})`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.12, size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.5);
  cg.addColorStop(0, `rgba(255,255,255,${alpha})`);
  cg.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw(ts) {
  if (!t0) t0 = ts;
  const t = ts - t0;

  ctx.clearRect(0, 0, W, H);

  drawAurora(t);

  stars.forEach(p => {
    const pulse = Math.sin(t * p.speed * 1000 + p.phase) * 0.35 + 0.65;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,210,255,${p.a * pulse})`;
    ctx.fill();
  });

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    const grd = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * (s.len / 3), s.y - s.vy * (s.len / 3));
    grd.addColorStop(0, `rgba(200,230,255,${s.alpha})`);
    grd.addColorStop(0.3, `rgba(91,200,245,${s.alpha * 0.7})`);
    grd.addColorStop(1, 'rgba(91,200,245,0)');
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - s.vx * (s.len / 3), s.y - s.vy * (s.len / 3));
    ctx.strokeStyle = grd;
    ctx.lineWidth = s.width;
    ctx.stroke();

    if (Math.random() < 0.4) {
      const [r, g, b] = dustColors[Math.floor(Math.random() * 3)];
      trailDust.push({
        x: s.x + (Math.random() - 0.5) * 6,
        y: s.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        r: Math.random() * 2 + 0.5,
        alpha: s.alpha * 0.8,
        cr: r, cg: g, cb: b,
        decay: 0.03, gravity: 0
      });
    }
    s.x += s.vx; s.y += s.vy;
    s.alpha -= 0.013;
    if (s.alpha <= 0 || s.x < -150 || s.y > H + 100) shootingStars.splice(i, 1);
  }

  fairies.forEach(f => {
    f.trail.push({ x: f.x, y: f.y });
    if (f.trail.length > 18) f.trail.shift();

    f.trail.forEach((pt, i) => {
      const a = (i / f.trail.length) * f.alpha * 0.4;
      const rr = f.r * (i / f.trail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, rr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${f.cr},${f.cg},${f.cb},${a})`;
      ctx.fill();
    });

    const pulse = Math.sin(t * f.speed * 1000 + f.phase) * 0.4 + 0.6;
    const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3.5);
    grd.addColorStop(0, `rgba(255,255,255,${f.alpha * pulse * 0.9})`);
    grd.addColorStop(0.3, `rgba(${f.cr},${f.cg},${f.cb},${f.alpha * pulse * 0.6})`);
    grd.addColorStop(1, `rgba(${f.cr},${f.cg},${f.cb},0)`);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    if (Math.random() < 0.08) {
      drawSparkle(f.x + (Math.random() - 0.5) * 8, f.y + (Math.random() - 0.5) * 8,
        3 + Math.random() * 4, f.alpha * 0.9, f.cr, f.cg, f.cb);
    }

    f.x += f.vx; f.y += f.vy;
    if (f.x < -20) f.x = W + 20;
    if (f.x > W + 20) f.x = -20;
    if (f.y < -20) f.y = H + 20;
    if (f.y > H + 20) f.y = -20;
  });

  for (let i = dustMotes.length - 1; i >= 0; i--) {
    const d = dustMotes[i];
    d.life++;
    const lifeRatio = d.life / d.maxLife;
    const fade = lifeRatio < 0.15 ? lifeRatio / 0.15 : lifeRatio > 0.8 ? 1 - (lifeRatio - 0.8) / 0.2 : 1;
    const pulse = Math.sin(t * d.speed * 1000 + d.phase) * 0.3 + 0.7;
    const a = d.maxAlpha * fade * pulse;

    const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2.5);
    grd.addColorStop(0, `rgba(255,255,255,${a * 0.8})`);
    grd.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${a * 0.5})`);
    grd.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    if (Math.random() < 0.003) {
      drawSparkle(d.x, d.y, d.r * 4, a * 1.2, d.cr, d.cg, d.cb);
    }

    d.x += d.vx + Math.sin(t * 0.0008 + d.phase) * 0.3;
    d.y += d.vy;

    if (d.life >= d.maxLife || d.y < -20) {
      dustMotes[i] = makeDustMote(false);
    }
  }

  for (let i = trailDust.length - 1; i >= 0; i--) {
    const d = trailDust[i];
    if (d.r < 0.6) { trailDust.splice(i, 1); continue; }

    const grd = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 2);
    grd.addColorStop(0, `rgba(255,255,255,${d.alpha * 0.9})`);
    grd.addColorStop(0.4, `rgba(${d.cr},${d.cg},${d.cb},${d.alpha * 0.7})`);
    grd.addColorStop(1, `rgba(${d.cr},${d.cg},${d.cb},0)`);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * 2, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    if (d.alpha > 0.5 && Math.random() < 0.25) {
      drawSparkle(d.x, d.y, d.r * 2.5, d.alpha * 0.8, d.cr, d.cg, d.cb);
    }

    d.x += d.vx; d.y += d.vy;
    d.vy += d.gravity;
    d.vx *= 0.97; d.vy *= 0.97;
    d.alpha -= d.decay;
    d.r *= 0.97;
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);