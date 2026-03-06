function loadCSV(path){

return new Promise(function(resolve){

parseCSV(path,function(data,headers){

resolve({
data:data,
headers:headers
});

});

});

}
