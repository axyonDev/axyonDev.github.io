(function (global) {
  function show(msg, type) {
    const layer = document.getElementById('toast-layer'); if (!layer) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type || 'info'}`; t.innerHTML = msg;
    layer.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
  }
  global.Axyon = global.Axyon || {};
  global.Axyon.Toast = { show };
})(window);
