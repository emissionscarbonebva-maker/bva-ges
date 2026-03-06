async function buildDestinationChart(){

let depFile = await loadCSV('./data/EXPORT_departures_YTD.csv');
let arrFile = await loadCSV('./data/EXPORT_arrivals_YTD.csv');

let departures = depFile.data;
let arrivals = arrFile.data;

let destinationMap={};
let totalEmissions=0;
let otherCount=0;

function aggregate(data,cityField){

data.forEach(row=>{

let city = row[cityField] || "Inconnue";

let emission = toNumber(row.emissions);

if(!destinationMap[city]) destinationMap[city]=0;

destinationMap[city]+=emission;

totalEmissions+=emission;

});

}

aggregate(departures,"destination");
aggregate(arrivals,"origine");

/* CONVERSION */

let destinationArray = Object.keys(destinationMap).map(dest=>({

destination:dest,
emission:destinationMap[dest]

}));

/* TRI */

destinationArray.sort((a,b)=> b.emission-a.emission);

/* FILTRE */

let filtered=[];
let cumulative=0;
let otherTotal=0;

destinationArray.forEach(item=>{

if(

filtered.length<50 &&
cumulative/totalEmissions<0.90

){

filtered.push(item);

cumulative+=item.emission;

}
else{

otherTotal+=item.emission;
otherCount++;

}

});

/* AUTRES */

if(otherTotal>0){

filtered.push({

destination:"Autres ("+otherCount+" destinations)",
emission:otherTotal

});

}

/* LABELS */

let labels=filtered.map(d=>d.destination);

let values=filtered.map(d=>round1(d.emission));

/* GRAPH */

new Chart(document.getElementById("chartDestination"),{

type:"bar",

data:{
labels:labels,
datasets:[{

label:"Émissions (t éq CO₂)",
data:values

}]
},

options:{
responsive:true,

plugins:{
legend:{display:false},

tooltip:{
callbacks:{
label:function(context){

let value=context.parsed.y;

let percent=(value/totalEmissions*100).toFixed(1);

return value.toLocaleString('fr-FR')+
" t éq CO₂ ("+percent+"%)";

}
}
}

},

scales:{
x:{
ticks:{maxRotation:90,minRotation:45}
},

y:{
title:{
display:true,
text:"Emissions de gaz à effet de serre (t éq CO₂)"
}
}

}

}

});

}
