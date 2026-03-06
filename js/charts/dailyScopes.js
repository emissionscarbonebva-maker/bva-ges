import { parseCSV } from "../core/csvParser.js";

export function initDailyScopes(){

parseCSV("./data/EXPORT_daily_scopes.csv",(data,headers)=>{

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let datasets=[];

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

data.forEach(row=>{

labels.push(row[headers[0]]);

for(let i=1;i<=5;i++){

let v=parseFloat(row[headers[i]].replace(',','.'))||0;
datasets[i-1].data.push(v);

}

});

new Chart(document.getElementById("chartDaily"),{
type:'line',
data:{labels,datasets}
});

});

}
