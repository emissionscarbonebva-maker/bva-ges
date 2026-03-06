async function buildDailyScopesChart(){

let file = await loadCSV('./data/EXPORT_daily_scopes.csv');

let data = file.data;
let headers = file.headers;

/* TRI DES DATES */

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let datasets=[];
let totalSeries=[];

/* DATASETS */

for(let i=1;i<=5;i++){

datasets.push({

label:headers[i],
data:[],
borderWidth:2,
fill:false,
borderColor:COLORS.scopes[i-1]

});

}

let total=0;
let max=0;
let maxDate="";

/* BOUCLE */

data.forEach(row=>{

let date=row[headers[0]];
labels.push(date);

let dayTotal=0;

for(let i=1;i<=5;i++){

let v = toNumber(row[headers[i]]);

datasets[i-1].data.push(v);

dayTotal+=v;

}

totalSeries.push(dayTotal);

total+=dayTotal;

if(dayTotal>max){

max=dayTotal;
maxDate=date;

}

});

/* INDICATEURS */

document.getElementById("total").innerText =
formatFR(total) + " tonnes éq CO2";

let average = total/labels.length;

document.getElementById("average").innerText =
formatFR(average) + " tonnes éq CO2";

/* ECART TYPE */

let variance=0;

totalSeries.forEach(v=>{

variance+=Math.pow(v-average,2);

});

variance=variance/totalSeries.length;

let stdDev=Math.sqrt(variance);

document.getElementById("stdDev").innerText =
formatFR(stdDev) + " tonnes éq CO2";

/* SERIE TOTAL */

datasets.push({

label:"Total scopes",
data:totalSeries,
borderWidth:3,
fill:false,
borderColor:"#000000"

});

/* GRAPH */

new Chart(document.getElementById("chartDaily"),{

type:'line',

data:{
labels:labels,
datasets:datasets
},

options:{
responsive:true,
interaction:{mode:'index',intersect:false},

plugins:{
legend:{position:'top'},
zoom:{
pan:{enabled:true,mode:'x'},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}
}
},

scales:{
x:{
title:{display:true,text:"Date"}
},
y:{
beginAtZero:true,
title:{display:true,text:"Emissions de gaz à effet de serre (t éq CO2)"}
}
}

}

});

}
