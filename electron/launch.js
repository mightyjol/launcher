const child = require('child_process').execFile;
const path = require('path')
const store = require('./store.js');

module.exports = function(name){
    let { path:base, version } = store.get(name) 
    let launchPath = path.join(
        base || path.join(path.dirname(process.execPath), '..', name),
        version, 
        name + '.exe'
    )
    if(process.env.NODE_ENV === 'development') launchPath = path.join(name, version, name + '.exe')
    
    console.log("launching", launchPath)
    child(launchPath, function(err, data) {
        if(err){
            console.error(err);
            return;
        }
    })
}