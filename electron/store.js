const fs = require('fs')
const path = require('path')
const remote = require("electron").remote;

let configPath = path.join(path.dirname(process.execPath), '..', "config.json")
if(process.env.NODE_ENV === 'development') configPath = './config.json'

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