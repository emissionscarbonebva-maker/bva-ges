export function parseCSV(url, callback){

fetch(url)
.then(r => r.text())
.then(data => {

let rows = data.split('\n').filter(r => r.trim() !== '');

let sep = rows[0].includes(';') ? ';' : ',';

let headers = rows[0].split(sep);

let result = [];

for(let i=1;i<rows.length;i++){

let cols = rows[i].split(sep);
let obj = {};

headers.forEach((h,index) => {
obj[h.trim()] = cols[index] ? cols[index].trim() : "";
});

result.push(obj);

}

callback(result, headers);

});

}
