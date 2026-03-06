export function toNumber(value){
if(!value) return 0;
let v = parseFloat(value.toString().replace(",","."));
return isNaN(v) ? 0 : v;
}

export function formatFR(v){
return Math.round(v).toLocaleString('fr-FR');
}

export function round1(v){
return Math.round(v * 10) / 10;
}
