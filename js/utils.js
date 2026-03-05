function parseCSV(url, callback){

fetch(url)
.then(r => r.text())
.then(data => {

var rows = data.split('\n').filter(r => r.trim() !== '');

var sep = rows[0].indexOf(';') !== -1 ? ';' : ',';
var headers = rows[0].split(sep);

var result = [];

for(var i=1;i<rows.length;i++){

var cols = rows[i].split(sep);
var obj = {};

headers.forEach(function(h,index){
obj[h.trim()] = cols[index] ? cols[index].trim() : "";
});

result.push(obj);

}

callback(result,headers);

});

}
