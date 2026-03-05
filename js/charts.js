/* ===== 1 DAILY SCOPES ===== */

parseCSV('./data/EXPORT_daily_scopes.csv',(data,headers)=>{

// Tri des dates (ancien → récent)
data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let datasets=[];
let totalSeries=[];

let colors = [
"#1f77b4",
"#ff7f0e",
"#2ca02c",
"#d62728",
"#9467bd"
];

// Création des datasets pour les 5 scopes
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
let max=0;
let maxDate="";

// ===== BOUCLE PRINCIPALE =====
data.forEach(row=>{

let date=row[headers[0]];
labels.push(date);

let dayTotal=0;

for(let i=1;i<=5;i++){

let raw=row[headers[i]];
let v = raw ? parseFloat(raw.replace(',','.')) : 0;

if(isNaN(v)) v=0;

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

// ===== INDICATEURS =====

document.getElementById("total").innerText =
Math.round(total).toLocaleString('fr-FR') + " tonnes éq CO2";

var average = labels.length > 0 ? total/labels.length : 0;

document.getElementById("average").innerText =
Math.round(average).toLocaleString('fr-FR') + " tonnes éq CO2";

/* ===== ECART TYPE ===== */

var variance = 0;

totalSeries.forEach(function(v){
variance += Math.pow(v - average,2);
});

variance = variance / totalSeries.length;

var stdDev = Math.sqrt(variance);

document.getElementById("stdDev").innerText =
Math.round(stdDev).toLocaleString('fr-FR') + " tonnes éq CO2";

// ===== AJOUT SERIE TOTAL =====
datasets.push({
label:"Total scopes",
data:totalSeries,
borderWidth:3,
fill:false,
borderColor:"#000000"
});

// ===== CREATION GRAPHIQUE =====
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
title:{
display:true,
text:"Date"
}
},
y:{
beginAtZero:true,
title:{
display:true,
text:"Emissions de gaz à effet de serre (en t éq CO2)"
}
}
}
}
});

});

  
/* ===== 2 CUMUL – VERSION PRODUCTION ===== */

parseCSV('./data/EXPORT_cumul_scopes.csv',(data,headers)=>{

if(!data || data.length === 0) return;

// Nettoyage des headers
headers = headers.map(h => h.replace(/\uFEFF/g,'').trim());

const dateKey = headers[0];
const totalKey = headers.find(h => h === "cumul_total");

// Tri chronologique
data.sort((a,b)=> new Date(a[dateKey]) - new Date(b[dateKey]));

let labels=[];
let datasets=[];

// --- Construction des séries (hors date et cumul_total) ---

let seriesMeta = [];

headers.forEach(h=>{
if(h === dateKey || h === totalKey) return;

let lastValue = parseFloat(
data[data.length - 1][h]
) || 0;

seriesMeta.push({
label: h,
lastValue: lastValue
});
});

// Tri du plus petit au plus grand (meilleure lisibilité empilement)
seriesMeta.sort((a,b)=> a.lastValue - b.lastValue);

// Palette couleurs (ordre cohérent)
let colors = [
"#9467bd",
"#d62728",
"#2ca02c",
"#ff7f0e",
"#1f77b4"
];

// Création datasets
seriesMeta.forEach((serie,index)=>{

datasets.push({
label: serie.label,
data: [],
borderWidth: 1.5,
fill: true,
backgroundColor: colors[index % colors.length] + "55",
borderColor: colors[index % colors.length],
stack: "stack1"
});

});

// --- Remplissage données ---

data.forEach(row=>{

labels.push(row[dateKey]);

datasets.forEach(ds=>{

let raw = row[ds.label];
let val = raw ? parseFloat(String(raw).replace(',','.').trim()) : 0;

if(isNaN(val)) val = 0;

ds.data.push(val);

});

});

// --- Création graphique ---

new Chart(document.getElementById("chartCumul"),{
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
tooltip:{
callbacks:{
label: function(context){

let value = context.parsed.y || 0;
let valueRounded = Math.round(value);

// calcul total empilé du jour
let total = 0;

context.chart.data.datasets.forEach(ds=>{
total += ds.data[context.dataIndex] || 0;
});

let percent = total > 0
? ((value / total) * 100).toFixed(1)
: 0;

return context.dataset.label + " : "
+ valueRounded.toLocaleString('fr-FR')
+ " t éq CO2"
+ " (" + percent + "%)";
}
}
},
zoom:{
pan:{enabled:true,mode:'x'},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}
}
},
scales:{
x:{
stacked:true,
title:{
display:true,
text:"Date"
}
},
y:{
stacked:true,
beginAtZero:true,
title:{
display:true,
text:"Emissions de gaz à effet de serre (en t éq CO2)"
}
}
}
}
});

});

/* ===== 3 AIRLINES (VERSION PERSONNALISÉE) ===== */

parseCSV('./data/EXPORT_daily_airlines.csv',(data)=>{

// Récupération dates uniques triées
let labels=[...new Set(data.map(r=>r.date))].sort();

// Récupération compagnies uniques
let compagnies=[...new Set(data.map(r=>r.compagnie))];

let datasets=[];

// 🎨 Couleurs personnalisées
let colors = {
"Ryanair": "rgb(223,186,47)",
"Wizz Air": "rgb(225,14,73)",
"HiSky": "rgb(19,62,103)",
"SkyUp": "rgb(255,58,32)",
"Volotea": "rgb(0,0,0)"
};

compagnies.forEach(comp=>{

let serie=[];

labels.forEach(d=>{
let row=data.find(r=>r.date===d && r.compagnie===comp);
let value = row ? parseFloat(row.emissions) : 0;
if(isNaN(value)) value = 0;
serie.push(value);
});

datasets.push({
label: comp,
data: serie,
borderWidth: 2,
fill: false,
borderColor: colors[comp] || "rgb(120,120,120)" // couleur par défaut si nouvelle compagnie
});

});

// ===== Création graphique personnalisée =====

new Chart(document.getElementById("chartAirlines"),{
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
tooltip:{
callbacks:{
label: function(context){

let value = context.parsed.y || 0;
let valueRounded = Math.round(value);

return context.dataset.label + " : "
+ valueRounded.toLocaleString('fr-FR')
+ " t éq CO2";

}
}
},
zoom:{
pan:{enabled:true,mode:'x'},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}
}
},
scales:{
x:{
title:{
display:true,
text:"Date"
}
},
y:{
beginAtZero:true,
title:{
display:true,
text:"Emissions de gaz à effet de serre (en t éq CO2)"
}
}
}
}
});

});

/* ===== 4 ROTATIONS JOURNALIERES (VERSION PERSONNALISÉE) ===== */

parseCSV('./data/EXPORT_daily_airlines.csv',(data)=>{

// Récupération dates uniques triées
let labels=[...new Set(data.map(r=>r.date))].sort();

// Récupération compagnies uniques
let compagnies=[...new Set(data.map(r=>r.compagnie))];

let datasets=[];

// 🎨 Couleurs personnalisées (identiques bloc 3)
let colors = {
"Ryanair": "rgb(223,186,47)",
"Wizz Air": "rgb(225,14,73)",
"HiSky": "rgb(19,62,103)",
"SkyUp": "rgb(255,58,32)",
"Volotea": "rgb(0,0,0)"
};

compagnies.forEach(comp=>{

let serie=[];

labels.forEach(d=>{
let row=data.find(r=>r.date===d && r.compagnie===comp);
let value = row ? parseFloat(row.rotations) : 0;
if(isNaN(value)) value = 0;
serie.push(value);
});

datasets.push({
label: comp,
data: serie,
borderWidth: 2,
fill: false,
borderColor: colors[comp] || "rgb(120,120,120)" // couleur par défaut
});

});

// ===== Création graphique personnalisée =====

new Chart(document.getElementById("chartRotations"),{
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
tooltip:{
callbacks:{
label: function(context){

let value = context.parsed.y || 0;
let valueRounded = Math.round(value);

return context.dataset.label + " : "
+ valueRounded.toLocaleString('fr-FR')
+ " rotations";

}
}
},
zoom:{
pan:{enabled:true,mode:'x'},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}
}
},
scales:{
x:{
title:{
display:true,
text:"Date"
}
},
y:{
beginAtZero:true,
title:{
display:true,
text:"Nombre de rotations"
}
}
}
}
});

});

/* ===== CUMUL TOTAL GLOBAL ===== */

parseCSV('./data/EXPORT_daily_scopes.csv',(data,headers)=>{

data.sort((a,b)=> new Date(a[headers[0]]) - new Date(b[headers[0]]));

let labels=[];
let cumul=[];
let total=0;

data.forEach(row=>{

let dayTotal=0;

for(let i=1;i<=5;i++){

let raw=row[headers[i]];
let v = raw ? parseFloat(raw.replace(',','.')) : 0;

if(isNaN(v)) v=0;

dayTotal+=v;
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
label:"Cumul total émissions",
data:cumul,
borderWidth:3,
fill:true,
backgroundColor:"rgba(31,60,136,0.2)",
borderColor:"#1f3c88"
}]
},

options:{
responsive:true,
plugins:{
legend:{position:'top'},
zoom:{
pan:{enabled:true,mode:'x'},
zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'}
}
},
scales:{
x:{title:{display:true,text:"Date"}},
y:{
beginAtZero:true,
title:{
display:true,
text:"Tonnes équivalent CO₂"
}
}
}
}

});

});

/* ===== CAMEMBERT SCOPES ===== */

parseCSV('./data/EXPORT_cumul_scopes.csv',(data)=>{

if(!data || data.length===0) return;

var row = data[data.length-1];

var scope12 = parseFloat(row.scope_1_2 || 0);
var total = parseFloat(row.cumul_total || 0);

if(isNaN(scope12)) scope12=0;
if(isNaN(total)) total=0;

var scope3 = total - scope12;

new Chart(
document.getElementById("chartScopes"),
{
type:"pie",

data:{
labels:[
"Scope 1 & 2",
"Scope 3"
],

datasets:[{
data:[
scope12,
scope3
]
}]
},

options:{
responsive:true,
plugins:{
legend:{
position:"bottom"
},
tooltip:{
callbacks:{
label:function(context){

var value = context.parsed;
var total = context.chart._metasets[0].total;

var percent = (value/total*100).toFixed(1);

return context.label+" : "
+ Math.round(value).toLocaleString('fr-FR')
+" t éq CO₂ ("+percent+"%)";
}
}
}
}
}

});

  });
  
/* ===============================
EMISSIONS PAR DESTINATION
Tri décroissant + limite 45 + 85%
Compatible EXPORT_departures_YTD.csv
================================ */

parseCSV('./data/EXPORT_departures_YTD.csv', function(data){

var destinationMap = {};
var totalEmissions = 0;

/* Agrégation */

data.forEach(function(row){

    var dest = row.destination || "Inconnue";

    var emission = parseFloat(row.emissions);

    if(isNaN(emission)) emission = 0;

    if(!destinationMap[dest]){
        destinationMap[dest] = 0;
    }

    destinationMap[dest] += emission;
    totalEmissions += emission;

});

/* Conversion en tableau */

var destinationArray = Object.keys(destinationMap).map(function(dest){
    return {
        destination: dest,
        emission: destinationMap[dest]
    };
});

/* Tri décroissant */

destinationArray.sort(function(a,b){
    return b.emission - a.emission;
});

/* Limitation 45 destinations OU 85% cumul */

var filteredDestinations = [];
var cumulative = 0;
var otherTotal = 0;

destinationArray.forEach(function(item){

    if(
        filteredDestinations.length < 45 &&
        cumulative / totalEmissions < 0.85
    ){
        filteredDestinations.push(item);
        cumulative += item.emission;
    }
    else{
        otherTotal += item.emission;
    }

});

/* Ajout catégorie AUTRES */

if(otherTotal > 0){

    filteredDestinations.push({
        destination:"Autres destinations",
        emission:otherTotal
    });

}

/* Labels et valeurs */

var labels = filteredDestinations.map(function(d){
    return d.destination;
});

var values = filteredDestinations.map(function(d){
    return Math.round(d.emission * 10) / 10;
});

/* Graphique */

new Chart(
    document.getElementById("chartDestination"),
    {
        type:"bar",    
      data:{
            labels:labels,
            datasets:[
                {
                    label:"Émissions (t éq CO₂)",
                    data:values
                }
            ]
        },
        options:{
            responsive:true,
            plugins:{
                legend:{display:false}
            },
            scales:{
                x:{
                    ticks:{
                        maxRotation:90,
                        minRotation:45
                    }
                },
                y:{
                    title:{
                        display:true,
                        text:"Emissions de gaz à effet de serre (en t éq CO₂)"
                    }
                }
            }
        }
    }
);

});

 
/* ===== TABLE DATA PRO V7 - STABLE ===== */

function createTable(containerId, data){

    if(!data || data.length === 0){
        document.getElementById(containerId).innerHTML =
            "<p>Aucune donnée disponible</p>";
        return;
    }

    var container = document.getElementById(containerId);
    var headers = Object.keys(data[0]);
    var activeFilters = {};
    var sortDirection = 1;
    var currentPage = 1;
    var rowsPerPage = 200;
    var filteredData = [...data];
    var debounceTimer;

    /* ================= FORMAT ================= */

function formatDistance(value){
    var n = parseFloat(String(value).replace(',','.'));
    if(isNaN(n)) return value;
    return Math.round(n).toLocaleString('fr-FR');
}

function formatEmission(value){
    var n = parseFloat(String(value).replace(',','.'));
    if(isNaN(n)) return value;
    return n.toLocaleString('fr-FR',{
        minimumFractionDigits:2,
        maximumFractionDigits:2
    });
}

function formatDateFR(value){

    if(!value) return "";

    var d = new Date(value);
    if(isNaN(d)) return value;

    var str = d.toLocaleDateString('fr-FR',{
        weekday:'long',
        day:'2-digit',
        month:'2-digit',
        year:'numeric'
    });

    return str.charAt(0).toUpperCase()+str.slice(1);
}

function formatValue(header,value){

    var lower = header.toLowerCase();

    if(lower.includes("date")) return formatDateFR(value);
    if(lower.includes("distance")) return formatDistance(value);
    if(lower.includes("emission")) return formatEmission(value);

    return value;
}

    /* ================= BUILD TABLE ================= */

    var html = "";

    html += '<div style="margin-bottom:10px; display:flex; justify-content:space-between;">';
    html += '<div><strong id="'+containerId+'-count"></strong> vols affichés</div>';
    html += '<div>';
    html += '<button id="'+containerId+'-reset">Réinitialiser</button> ';
    html += '<button id="'+containerId+'-export">Exporter</button>';
    html += '</div></div>';

    html += '<div class="table-wrapper">';
    html += '<table class="data-table"><thead>';

    /* HEADER */

    html += '<tr>';

    headers.forEach(function(h,i){
        html += '<th class="'+(i===0?'sticky-col':'')+' filtered-header" data-header="'+h+'">';
        html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
        html += '<span>'+h+'</span>';
        html += '<span class="col-menu" data-col="'+h+'" style="cursor:pointer;">⋮</span>';
        html += '</div></th>';
    });

    html += '</tr>';

    /* FILTER ROW */

    html += '<tr>';

    headers.forEach(function(h,i){
        html += '<th class="'+(i===0?'sticky-col':'')+'">';
        html += '<div style="position:relative;">';
        html += '<input type="text" data-filter="'+h+'" placeholder="Filtrer..." style="width:100%;">';
        html += '<span class="clear-filter" data-clear="'+h+'" style="position:absolute; right:6px; top:50%; transform:translateY(-50%); cursor:pointer;">✕</span>';
        html += '</div></th>';
    });

    html += '</tr></thead><tbody>';

    /* TOTAL ROW */

    html += '<tr class="total-row"></tr>';

    html += '</tbody></table></div>';

    html += '<div style="margin-top:10px; text-align:center;">';
    html += '<button id="'+containerId+'-prev">◀</button> ';
    html += '<span id="'+containerId+'-page"></span>';
    html += ' <button id="'+containerId+'-next">▶</button>';
    html += '</div>';

    container.innerHTML = html;

    var tbody = container.querySelector("tbody");
    var totalRow = tbody.querySelector(".total-row");

    /* ================= RENDER ================= */

function renderTable(){

    tbody.querySelectorAll("tr:not(.total-row)").forEach(tr=>tr.remove());

    var start = (currentPage-1)*rowsPerPage;
    var end = start + rowsPerPage;
    var pageData = filteredData.slice(start,end);

    pageData.forEach(function(row){

        var tr = document.createElement("tr");

        headers.forEach(function(h){

            var td = document.createElement("td");

            if(h.toLowerCase().includes("date") ||
               h.toLowerCase().includes("distance") ||
               h.toLowerCase().includes("emission"))
                td.className="center";

            td.innerText = formatValue(h,row[h]||"");
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    updateTotal();
    updateCount();
    updatePagination();
    updateBadges();
}

    /* ================= FILTER ================= */

function applyFilters(){

    filteredData = data.filter(function(row){

        return headers.every(function(h){

            if(!activeFilters[h]) return true;

            var value = String(row[h]||"").toLowerCase();
            return value.includes(activeFilters[h].toLowerCase());
        });
    });

    currentPage = 1;
    renderTable();
}

    /* ================= TOTAL ================= */

function updateTotal(){

    var sourceData;

    if(Object.keys(activeFilters).length===0)
        sourceData = data;
    else
        sourceData = filteredData;

    var total = 0;

    sourceData.forEach(function(row){

        headers.forEach(function(h){

            if(h.toLowerCase().includes("emission")){

                var n = parseFloat(String(row[h]).replace(',','.'));

                if(!isNaN(n)) total += n;
            }
        });
    });

    totalRow.innerHTML="";

    headers.forEach(function(h,i){

        var td=document.createElement("td");

        if(i===0){
            td.innerHTML="<strong>TOTAL</strong>";
        }
        else if(h.toLowerCase().includes("emission")){

            td.className="center";

            td.innerHTML="<strong>"+total.toLocaleString('fr-FR',{
                minimumFractionDigits:2,
                maximumFractionDigits:2
            })+"</strong>";
        }

        totalRow.appendChild(td);
    });
}

    /* ================= PAGINATION ================= */

function updatePagination(){

    var totalPages = Math.ceil(filteredData.length / rowsPerPage);

    container.querySelector("#"+containerId+"-page")
        .innerText = "Page "+currentPage+" / "+totalPages;

    document.getElementById(containerId+"-prev").onclick=function(){

        if(currentPage>1){
            currentPage--;
            renderTable();
        }
    };

    document.getElementById(containerId+"-next").onclick=function(){

        if(currentPage<totalPages){
            currentPage++;
            renderTable();
        }
    };
}

    /* ================= COUNT ================= */

function updateCount(){

    container.querySelector("#"+containerId+"-count")
        .innerText = filteredData.length.toLocaleString('fr-FR');
}

/* ================= FILTER BADGES ================= */

function updateBadges(){

    container.querySelectorAll(".filtered-header")
    .forEach(function(th){

        var header = th.getAttribute("data-header");

        if(activeFilters[header])
            th.classList.add("filtered");
        else
            th.classList.remove("filtered");

    });

}
  
    /* ================= MENU POPUP ================= */

container.querySelectorAll(".col-menu").forEach(function(btn){

    btn.addEventListener("click", function(e){

        e.stopPropagation();

        var col = btn.getAttribute("data-col");
        var index = headers.indexOf(col);

        var old = document.querySelector(".column-menu");
        if(old) old.remove();

        var menu = document.createElement("div");
        menu.className="column-menu";
        menu.style.position="fixed";
        menu.style.background="#fff";
        menu.style.border="1px solid #ccc";
        menu.style.borderRadius="8px";
        menu.style.boxShadow="0 8px 20px rgba(0,0,0,0.15)";
        menu.style.padding="6px 0";
        menu.style.zIndex="99999";

        var rect = btn.getBoundingClientRect();
        menu.style.left = rect.left+"px";
        menu.style.top  = rect.bottom+"px";

        function addItem(label,action){
            var item=document.createElement("div");
            item.innerText=label;
            item.style.padding="8px 14px";
            item.style.cursor="pointer";
            item.addEventListener("click",function(){
                action();
                menu.remove();
            });
            menu.appendChild(item);
        }

        addItem("Tri ascendant",function(){
            sortDirection=1;
            sortColumn(index);
        });

        addItem("Tri descendant",function(){
            sortDirection=-1;
            sortColumn(index);
        });

        addItem("Effacer le filtre",function(){
            delete activeFilters[col];
            container.querySelector('[data-filter="'+col+'"]').value="";
            applyFilters();
        });

        document.body.appendChild(menu);

        document.addEventListener("click",function(){
            menu.remove();
        },{once:true});
    });
});

function sortColumn(index){

    filteredData.sort(function(a,b){

        var A=a[headers[index]];
        var B=b[headers[index]];

        var numA=parseFloat(String(A).replace(',','.'));
        var numB=parseFloat(String(B).replace(',','.'));

        if(!isNaN(numA)&&!isNaN(numB))
            return (numA-numB)*sortDirection;

        return String(A).localeCompare(String(B))*sortDirection;
    });

    renderTable();
}

    /* ================= DEBOUNCE INPUT ================= */

container.querySelectorAll("[data-filter]").forEach(function(input){

    input.addEventListener("input", function(){

        clearTimeout(debounceTimer);

        debounceTimer=setTimeout(function(){

            var col=input.getAttribute("data-filter");
            activeFilters[col]=input.value.trim();

            if(!activeFilters[col]) delete activeFilters[col];

            applyFilters();

        },300);
    });
});

/* ================= CLEAR FILTER ================= */

container.querySelectorAll(".clear-filter").forEach(function(btn){

    btn.addEventListener("click", function(e){

        e.stopPropagation();

        var col = btn.getAttribute("data-clear");
        var input = container.querySelector('[data-filter="'+col+'"]');

        input.value="";
        delete activeFilters[col];

        clearTimeout(debounceTimer);

        applyFilters();
    });
});

    /* ================= RESET ================= */

document.getElementById(containerId+"-reset")
.addEventListener("click",function(){

    activeFilters={};

    container.querySelectorAll("[data-filter]").forEach(i=>i.value="");

    var dateIndex=headers.findIndex(h=>h.toLowerCase().includes("date"));

    if(dateIndex!==-1){

        data.sort(function(a,b){

            return new Date(b[headers[dateIndex]]) -
                   new Date(a[headers[dateIndex]]);
        });
    }

    filteredData=[...data];
    currentPage=1;

    renderTable();
});

    /* ================= INIT ================= */

renderTable();
}

/* ===== BADGE CSS ===== */

var style = document.createElement("style");
style.innerHTML = `
.filtered {
background:#e6f2ff !important;
position:relative;
}
.filtered::after{
content:"";
width:8px;
height:8px;
background:#007bff;
border-radius:50%;
position:absolute;
top:6px;
right:6px;
}
`;
document.head.appendChild(style);

/* ===== TABLE DEPARTURES ===== */

parseCSV('./data/EXPORT_departures_YTD.csv', function(data){
    createTable("tableDepartures", data);
});

/* ===== TABLE ARRIVALS ===== */

parseCSV('./data/EXPORT_arrivals_YTD.csv', function(data){
    createTable("tableArrivals", data);
});

});
