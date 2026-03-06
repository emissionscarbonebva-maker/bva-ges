import { parseCSV } from "../core/csvParser.js";
import { toNumber } from "../core/utils.js";

export function initCumulScopes(){

parseCSV("./data/EXPORT_cumul_scopes.csv",(data,headers)=>{

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let datasets=[];

let seriesMeta=[];

/* construction séries */

headers.forEach(h=>{
if(h === headers[0]) return;

let last = toNumber(data[data.length-1][h]);

seriesMeta.push({label:h,last});
});

/* tri (lisibilité) */

seriesMeta.sort((a,b)=> a.last - b.last);

let colors=[
"#9467bd",
"#d62728",
"#2ca02c",
"#ff7f0e",
"#1f77b4"
];

seriesMeta.forEach((s,i)=>{

datasets.push({
label:s.label,
data:[],
borderWidth:1.5,
fill:true,
backgroundColor:colors[i]+"55",
borderColor:colors[i],
stack:"stack"
});

});

/* remplissage */

data.forEach(row=>{

labels.push(row[headers[0]]);

datasets.forEach(ds=>{

let v = toNumber(row[ds.label]);
ds.data.push(v);

});

});

/* graph */

new Chart(document.getElementById("chartCumul"),{
type:'line',
data:{labels,datasets},
options:{responsive:true}
});

});

}
