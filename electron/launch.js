const child = require('child_process').execFile;
const store = require('./store.js');

module.exports = function(name){
    let { path:base, version } = store.get(name) 
    let path = (base || name) + '/' + version + '/' + name + '.exe'
    
    console.log("launching", path)
    child(path, function(err, data) {
        if(err){
            console.error(err);
            return;
        }
    })
}