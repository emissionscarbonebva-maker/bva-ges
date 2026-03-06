import { parseCSV } from "../core/csvParser.js";
import { toNumber, round1 } from "../core/utils.js";

export function initDestination(){

Promise.all([
parseCSV("./data/EXPORT_departures_YTD.csv", d=>d),
parseCSV("./data/EXPORT_arrivals_YTD.csv", d=>d)
]).then(([departures, arrivals])=>{

let destinationMap={};
let total=0;
let otherCount=0;

function aggregate(data, field){

data.forEach(row=>{

let city = row[field] || "Inconnue";
let emission = toNumber(row.emissions);

destinationMap[city] = (destinationMap[city]||0) + emission;
total += emission;

});

}

aggregate(departures,"destination");
aggregate(arrivals,"origine");

/* conversion */

let array = Object.keys(destinationMap).map(dest=>({
destination:dest,
emission:destinationMap[dest]
}));

array.sort((a,b)=> b.emission-a.emission);

/* filtre */

let filtered=[];
let cumulative=0;
let other=0;

array.forEach(item=>{

if(filtered.length<50 && cumulative/total<0.90){

filtered.push(item);
cumulative+=item.emission;

}else{

other+=item.emission;
otherCount++;

}

});

/* autres */

if(other>0){

filtered.push({
destination:"Autres ("+otherCount+" destinations)",
emission:other
});

}

/* labels */

let labels=filtered.map(d=>d.destination);
let values=filtered.map(d=>round1(d.emission));

/* graph */

new Chart(document.getElementById("chartDestination"),{
type:"bar",
data:{
labels:labels,
datasets:[{
label:"Émissions (t éq CO2)",
data:values
}]
},
options:{
responsive:true,
plugins:{
tooltip:{
callbacks:{
label:(ctx)=>{

let v = ctx.parsed.y;
let p = (v/total*100).toFixed(1);

return v.toLocaleString('fr-FR')+
" t éq CO2 ("+p+"%)";

}
}
}
}
}
});

});

}
