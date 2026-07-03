/**
 * Axyon.Numbers — büyük sayı soyutlama katmanı.
 * economy.js hep bunu kullanır; ileride big-number kütüphanesi buraya takılır,
 * dışarısı değişmez.
 */
(function (global) {
  const Numbers = {
    add: (a, b) => a + b,
    sub: (a, b) => Math.max(0, a - b),
    mul: (a, b) => a * b,
    div: (a, b) => (b === 0 ? 0 : a / b),
    pow: (b, e) => Math.pow(b, e),
    clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
    format(n) {
      const v = Math.max(0, n);
      if (v < 1000) return Number.isInteger(v) ? v.toString() : v.toFixed(1);
      const u = ['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','UDc','DDc'];
      let i = -1, x = v;
      while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
      return x.toFixed(2) + u[i];
    },
    formatTime(s) {
      s = Math.floor(s);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      if (h > 0) return `${h}s ${m}d`;
      if (m > 0) return `${m}d ${sec}sn`;
      return `${sec}sn`;
    },
  };
  global.Axyon = global.Axyon || {};
  global.Axyon.Numbers = Numbers;
})(typeof window !== 'undefined' ? window : globalThis);
