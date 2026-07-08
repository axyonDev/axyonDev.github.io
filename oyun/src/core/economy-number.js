/**
 * Axyon EconomyNumber Adapter v1.0
 *
 * Single source of truth for long-running economy arithmetic. The game must not
 * construct break_eternity Decimal values outside this adapter.
 *
 * Browser: load vendor/break_eternity/break_eternity.min.js first.
 * Node: CommonJS require is supported for validation and migration tools.
 */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../../vendor/break_eternity/break_eternity.cjs.js'));
  } else {
    root.Axyon = root.Axyon || {};
    root.Axyon.EconomyNumber = factory(root.Decimal);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(Decimal) {
  'use strict';

  if (!Decimal) throw new Error('break_eternity.js Decimal is required');

  const ZERO = new Decimal(0);
  const ONE = new Decimal(1);

  function decimal(value) {
    if (value instanceof Decimal) return value.clone ? value.clone() : new Decimal(value);
    if (value === null || value === undefined || value === '') return new Decimal(0);
    if (typeof value === 'bigint') return new Decimal(value.toString());
    if (typeof value === 'object' && value && Number.isFinite(value.sign) && Number.isFinite(value.layer) && Number.isFinite(value.mag)) {
      return Decimal.fromComponents(value.sign, value.layer, value.mag);
    }
    return new Decimal(String(value).trim());
  }

  function finite(value) {
    try {
      const d = decimal(value);
      return d.isFinite() && !Number.isNaN(d.mag) && Number.isFinite(d.layer) && Number.isFinite(d.sign);
    } catch (_) {
      return false;
    }
  }

  function signed(value, fallback) {
    try {
      const d = decimal(value);
      return finite(d) ? d : decimal(fallback === undefined ? 0 : fallback);
    } catch (_) {
      return decimal(fallback === undefined ? 0 : fallback);
    }
  }

  function nonNegative(value, fallback) {
    const d = finite(value) ? decimal(value) : decimal(fallback === undefined ? 0 : fallback);
    return d.lt ? (d.lt(0) ? new Decimal(0) : d) : (d.sign < 0 ? new Decimal(0) : d);
  }

  function safe(value) {
    return nonNegative(value, 0);
  }

  function add(a, b) { return safe(a).add(safe(b)); }
  function addSigned(a, b) { return signed(a).add(signed(b)); }
  function sub(a, b) { return safe(a).sub(safe(b)).max(0); }
  function subSigned(a, b) { return signed(a).sub(signed(b)); }
  function mul(a, b) { return safe(a).mul(safe(b)); }
  function mulSigned(a, b) { return signed(a).mul(signed(b)); }
  function div(a, b) {
    const denominator = safe(b);
    return denominator.eq(0) ? new Decimal(0) : safe(a).div(denominator).max(0);
  }
  function divSigned(a, b) {
    const denominator = signed(b);
    return denominator.eq(0) ? new Decimal(0) : signed(a).div(denominator);
  }
  function pow(base, exponent) {
    const result = safe(base).pow(decimal(exponent));
    return finite(result) ? result.max(0) : new Decimal(0);
  }
  function min(a, b) { return safe(a).min(safe(b)); }
  function max(a, b) { return safe(a).max(safe(b)); }
  function floor(value) { return safe(value).floor(); }
  function clamp(value, lo, hi) { return max(lo, min(value, hi)); }

  function cmp(a, b) {
    const x = safe(a), y = safe(b);
    if (x.eq(y)) return 0;
    return x.gt ? (x.gt(y) ? 1 : -1) : (x.gte(y) ? 1 : -1);
  }

  function toStorage(value) {
    const d = safe(value);
    // break_eternity's own notation is round-trippable, including e/ee/(e^n).
    return d.toString();
  }
  function toStorageSigned(value) {
    return signed(value).toString();
  }

  function fromStorage(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
      throw new TypeError('EconomyNumber storage value must be string/number/bigint');
    }
    const d = decimal(value);
    if (!finite(d) || d.sign < 0) throw new RangeError('Invalid EconomyNumber storage value');
    return d;
  }
  function fromStorageSigned(value) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
      throw new TypeError('EconomyNumber storage value must be string/number/bigint');
    }
    const d = decimal(value);
    if (!finite(d)) throw new RangeError('Invalid signed EconomyNumber storage value');
    return d;
  }

  function isValidStorage(value) {
    try {
      if (typeof value !== 'string' || value.trim() === '') return false;
      const d = fromStorage(value);
      const roundTrip = fromStorage(toStorage(d));
      return roundTrip.eq(d);
    } catch (_) {
      return false;
    }
  }
  function isValidSignedStorage(value) {
    try {
      if (typeof value !== 'string' || value.trim() === '') return false;
      const d = fromStorageSigned(value);
      const roundTrip = fromStorageSigned(toStorageSigned(d));
      return roundTrip.eq(d);
    } catch (_) {
      return false;
    }
  }

  function toSafeNumber(value, maxValue) {
    const limit = maxValue === undefined ? Number.MAX_SAFE_INTEGER : Number(maxValue);
    const d = safe(value);
    if (d.gte(limit)) return limit;
    const n = d.toNumber();
    return Number.isFinite(n) ? Math.max(0, n) : limit;
  }

  function format(value, digits) {
    const d = safe(value);
    const precision = Number.isInteger(digits) ? Math.max(0, Math.min(6, digits)) : 2;
    if (d.lt(1000)) {
      const n = d.toNumber();
      if (Number.isInteger(n)) return String(n);
      return n.toFixed(Math.min(precision, 3)).replace(/\.?0+$/, '');
    }
    if (d.lt('1e15')) {
      const units = ['K','M','B','T'];
      let n = d.toNumber(), i = -1;
      while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
      return n.toFixed(precision) + units[i];
    }
    // Scientific/layer notation remains stable for very large values.
    return d.toStringWithDecimalPlaces ? d.toStringWithDecimalPlaces(precision) : d.toString();
  }

  function sum(values) {
    return (values || []).reduce((acc, v) => acc.add(safe(v)), new Decimal(0));
  }

  function product(values) {
    return (values || []).reduce((acc, v) => acc.mul(safe(v)), new Decimal(1));
  }

  return Object.freeze({
    Decimal,
    ZERO,
    ONE,
    decimal,
    signed,
    safe,
    finite,
    add,
    addSigned,
    sub,
    subSigned,
    mul,
    mulSigned,
    div,
    divSigned,
    pow,
    min,
    max,
    floor,
    clamp,
    cmp,
    eq: (a,b) => safe(a).eq(safe(b)),
    lt: (a,b) => safe(a).lt(safe(b)),
    lte: (a,b) => safe(a).lte(safe(b)),
    gt: (a,b) => safe(a).gt(safe(b)),
    gte: (a,b) => safe(a).gte(safe(b)),
    toStorage,
    toStorageSigned,
    fromStorage,
    fromStorageSigned,
    isValidStorage,
    isValidSignedStorage,
    toSafeNumber,
    format,
    sum,
    product,
    version: '1.1.0-u2',
    engine: 'break_eternity.js@2.1.3'
  });
});
