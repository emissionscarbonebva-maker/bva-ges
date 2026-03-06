import { parseCSV } from "../core/csvParser.js";
import { toNumber, formatFR } from "../core/utils.js";

export function initDailyScopes(){

parseCSV("./data/EXPORT_daily_scopes.csv",(data,headers)=>{

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let datasets=[];
let totalSeries=[];

let colors=[
"#1f77b4",
"#ff7f0e",
"#2ca02c",
"#d62728",
"#9467bd"
];

for(let i=1;i<=5;i++){

datasets.push({
label:headers[i],
data:[],
borderWidth:2,
fill:false,
borderColor:colors[i-1]
});

}

let total=0;

/* boucle */

data.forEach(row=>{

labels.push(row[headers[0]]);

let dayTotal=0;

for(let i=1;i<=5;i++){

let v = toNumber(row[headers[i]]);
datasets[i-1].data.push(v);
dayTotal+=v;

}

totalSeries.push(dayTotal);
total+=dayTotal;

});

/* indicateurs */

document.getElementById("total").innerText =
formatFR(total) + " tonnes éq CO2";

let average = total/labels.length;

document.getElementById("average").innerText =
formatFR(average) + " tonnes éq CO2";

/* ecart type */

let variance=0;
totalSeries.forEach(v=>variance+=Math.pow(v-average,2));
variance/=totalSeries.length;

let stdDev=Math.sqrt(variance);

document.getElementById("stdDev").innerText =
formatFR(stdDev) + " tonnes éq CO2";

/* serie total */

datasets.push({
label:"Total scopes",
data:totalSeries,
borderWidth:3,
fill:false,
borderColor:"#000"
});

/* graph */

new Chart(document.getElementById("chartDaily"),{
type:'line',
data:{labels,datasets},
options:{responsive:true}
});

});

}
