/** Axyon.LosslessJSON — numeric literals are retained until schema-aware conversion. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else{root.Axyon=root.Axyon||{};root.Axyon.LosslessJSON=factory();}
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  class NumberToken{constructor(raw){this.raw=raw;}toString(){return this.raw;}}
  function parseLossless(text){
    if(typeof text!=='string')throw new TypeError('JSON input must be a string');
    let i=0;
    const error=message=>{const start=Math.max(0,i-24),end=Math.min(text.length,i+24);throw new SyntaxError(`${message} at ${i}: ${text.slice(start,end)}`);};
    const ws=()=>{while(i<text.length&&/\s/.test(text[i]))i++;};
    function parseString(){const start=i;if(text[i]!=='"')error('Expected string');i++;let escaped=false;while(i<text.length){const ch=text[i++];if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"'){const token=text.slice(start,i);try{return JSON.parse(token);}catch(_){error('Invalid string escape');}}if(ch.charCodeAt(0)<0x20)error('Control character in string');}error('Unterminated string');}
    function parseNumber(){const start=i;if(text[i]==='-')i++;if(text[i]==='0')i++;else{if(!/[1-9]/.test(text[i]||''))error('Invalid number');while(/[0-9]/.test(text[i]||''))i++;}if(text[i]==='.'){i++;if(!/[0-9]/.test(text[i]||''))error('Invalid fraction');while(/[0-9]/.test(text[i]||''))i++;}if(text[i]==='e'||text[i]==='E'){i++;if(text[i]==='+'||text[i]==='-')i++;if(!/[0-9]/.test(text[i]||''))error('Invalid exponent');while(/[0-9]/.test(text[i]||''))i++;}return new NumberToken(text.slice(start,i));}
    function parseArray(){const out=[];i++;ws();if(text[i]===']'){i++;return out;}while(true){out.push(parseValue());ws();if(text[i]===']'){i++;return out;}if(text[i]!==',')error('Expected comma in array');i++;ws();}}
    function parseObject(){const out=Object.create(null);i++;ws();if(text[i]==='}'){i++;return out;}while(true){if(text[i]!=='"')error('Expected object key');const key=parseString();ws();if(text[i]!==':')error('Expected colon');i++;ws();if(Object.prototype.hasOwnProperty.call(out,key))error(`Duplicate key ${key}`);out[key]=parseValue();ws();if(text[i]==='}'){i++;return out;}if(text[i]!==',')error('Expected comma in object');i++;ws();}}
    function literal(word,value){if(text.slice(i,i+word.length)!==word)error(`Expected ${word}`);i+=word.length;return value;}
    function parseValue(){ws();const ch=text[i];if(ch==='"')return parseString();if(ch==='{')return parseObject();if(ch==='[')return parseArray();if(ch==='t')return literal('true',true);if(ch==='f')return literal('false',false);if(ch==='n')return literal('null',null);if(ch==='-'||/[0-9]/.test(ch||''))return parseNumber();error('Unexpected token');}
    const value=parseValue();ws();if(i!==text.length)error('Trailing data');return value;
  }
  return Object.freeze({NumberToken,parseLossless});
});
