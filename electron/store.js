const fs = require('fs')

let configPath = "config.json"
let defaults = {
    witch_craft: { installed: false }
}

fs.readFileSync(configPath, (err) => {
    if(err) fs.writeFileSync(configPath, JSON.stringify(defaults), () => {})
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