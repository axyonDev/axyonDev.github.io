/** Axyon.Numbers — v4.4 U1 compatibility bridge. Runtime remains numeric until U2. */
(function(global){
  'use strict';
  const Big=global.Axyon?.EconomyNumber;
  const isDecimal=v=>!!(Big&&v instanceof Big.Decimal);
  const Numbers={
    add:(a,b)=>isDecimal(a)||isDecimal(b)?Big.add(a,b):Number(a||0)+Number(b||0),
    sub:(a,b)=>isDecimal(a)||isDecimal(b)?Big.sub(a,b):Math.max(0,Number(a||0)-Number(b||0)),
    mul:(a,b)=>isDecimal(a)||isDecimal(b)?Big.mul(a,b):Number(a||0)*Number(b||0),
    div:(a,b)=>isDecimal(a)||isDecimal(b)?Big.div(a,b):(Number(b)===0?0:Number(a||0)/Number(b)),
    pow:(b,e)=>isDecimal(b)||isDecimal(e)?Big.pow(b,e):Math.pow(Number(b||0),Number(e||0)),
    clamp:(v,lo,hi)=>isDecimal(v)||isDecimal(lo)||isDecimal(hi)?Big.clamp(v,lo,hi):Math.max(lo,Math.min(hi,v)),
    format(n){
      if(isDecimal(n)||(typeof n==='string'&&n.length>15))return Big.format(n,2);
      const v=Math.max(0,Number(n)||0);if(v<1000)return Number.isInteger(v)?v.toString():v.toFixed(1).replace(/\.0$/,'');
      const u=['K','M','B','T','Qa','Qi','Sx','Sp','Oc','No','Dc','UDc','DDc'];let i=-1,x=v;while(x>=1000&&i<u.length-1){x/=1000;i++;}return x.toFixed(2)+u[i];
    },
    formatTime(s){s=Math.max(0,Math.floor(Number(s)||0));const year=Math.floor(s/31536000);s%=31536000;const day=Math.floor(s/86400);s%=86400;const hour=Math.floor(s/3600);s%=3600;const min=Math.floor(s/60),sec=s%60;if(year>0)return`${year}y ${day}g`;if(day>0)return`${day}g ${hour}sa`;if(hour>0)return`${hour}sa ${min}dk`;if(min>0)return`${min}dk ${sec}sn`;return`${sec}sn`;},
    big:Big,
    runtimeMode:'number-compat-u1'
  };
  global.Axyon=global.Axyon||{};global.Axyon.Numbers=Object.freeze(Numbers);
})(typeof window!=='undefined'?window:globalThis);
