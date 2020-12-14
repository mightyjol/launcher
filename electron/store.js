const fs = require('fs')
const path = require('path')
const remote = require("electron").remote;
const { app } = require('electron')

let base = app ? app.getAppPath() : remote.app.getAppPath()
let configPath = path.join(base, "/config.json")
console.log(configPath)
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