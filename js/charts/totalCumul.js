import { parseCSV } from "../core/csvParser.js";
import { toNumber } from "../core/utils.js";

export function initTotalCumul(){

parseCSV("./data/EXPORT_daily_scopes.csv",(data,headers)=>{

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let cumul=[];
let total=0;

data.forEach(row=>{

let dayTotal=0;

for(let i=1;i<=5;i++){
dayTotal += toNumber(row[headers[i]]);
}

total+=dayTotal;

labels.push(row[headers[0]]);
cumul.push(total);

});

new Chart(document.getElementById("chartTotalCumul"),{
type:'line',
data:{
labels:labels,
datasets:[{
label:"Cumul total",
data:cumul
}]
},
options:{responsive:true}
});

});

}
