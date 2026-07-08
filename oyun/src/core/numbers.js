/** Axyon.Numbers — v4.4 U2 Decimal-native formatting and arithmetic bridge. */
(function(global){
  'use strict';
  const Big=global.Axyon?.EconomyNumber;
  const Decimal=Big?.Decimal;
  const isDecimal=v=>!!(Decimal&&v instanceof Decimal);
  const asDecimal=v=>Big.decimal(v===undefined||v===null||v===''?0:v);
  const signed=v=>Big.signed?Big.signed(v):asDecimal(v);
  const Numbers={
    isDecimal,
    decimal:asDecimal,
    signed,
    add:(a,b)=>Big.add(a,b),
    sub:(a,b)=>Big.sub(a,b),
    mul:(a,b)=>Big.mul(a,b),
    div:(a,b)=>Big.div(a,b),
    pow:(b,e)=>Big.pow(b,e),
    min:(a,b)=>Big.min(a,b),
    max:(a,b)=>Big.max(a,b),
    clamp:(v,lo,hi)=>Big.clamp(v,lo,hi),
    cmp:(a,b)=>Big.cmp(a,b),eq:(a,b)=>Big.eq(a,b),lt:(a,b)=>Big.lt(a,b),lte:(a,b)=>Big.lte(a,b),gt:(a,b)=>Big.gt(a,b),gte:(a,b)=>Big.gte(a,b),
    floor:v=>Big.floor(v),
    abs:v=>{const d=signed(v);return d.abs?d.abs():asDecimal(Math.abs(Number(v)||0));},
    toNumber:(v,max)=>Big.toSafeNumber(v,max),
    toStorage:v=>Big.toStorage(v),
    format(n){return Big.format(n,2);},
    formatSigned(n,digits=2){
      const d=signed(n),neg=d.lt(0),a=d.abs();
      return `${neg?'-':''}${Big.format(a,digits)}`;
    },
    formatTime(s){s=Math.max(0,Math.floor(Number(s)||0));const year=Math.floor(s/31536000);s%=31536000;const day=Math.floor(s/86400);s%=86400;const hour=Math.floor(s/3600);s%=3600;const min=Math.floor(s/60),sec=s%60;if(year>0)return`${year}y ${day}g`;if(day>0)return`${day}g ${hour}sa`;if(hour>0)return`${hour}sa ${min}dk`;if(min>0)return`${min}dk ${sec}sn`;return`${sec}sn`;},
    big:Big,
    runtimeMode:'decimal-native-u2'
  };
  global.Axyon=global.Axyon||{};global.Axyon.Numbers=Object.freeze(Numbers);
})(typeof window!=='undefined'?window:globalThis);
