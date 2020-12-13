const fs = require('fs')

let configPath = "config.json"

fs.readFile(configPath, (err) => {
    if(err) fs.writeFile(configPath, JSON.stringify({}), () => {})
}) 
 
module.exports = {
    set: function(key, object){
        let config = JSON.parse(fs.readFileSync(configPath))
        config[key] = object
        fs.writeFileSync(configPath, JSON.stringify(config), () => {})
        return
    },
    get: function(key){
        let config = JSON.parse(fs.readFileSync(configPath))
        return config[key]
    }
}