export function createLineChart(canvasId, labels, datasets){

new Chart(document.getElementById(canvasId),{

type:"line",

data:{labels,datasets},

options:{
responsive:true,
interaction:{mode:"index",intersect:false},
plugins:{
legend:{position:"top"},
zoom:{
pan:{enabled:true,mode:"x"},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:"x"}
}
}
}

});

}
