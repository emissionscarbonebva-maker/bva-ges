function toNumber(value){

if(!value) return 0;

let v = parseFloat(value.toString().replace(",","."));

if(isNaN(v)) return 0;

return v;

}

function round1(v){
return Math.round(v*10)/10;
}

function formatFR(v){
return Math.round(v).toLocaleString('fr-FR');
}
