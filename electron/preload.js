const {
    contextBridge,
    ipcRenderer
} = require("electron");
const install = require("./install.js")
const launch = require("./launch.js")
const store = require('./store.js')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
        send: (channel, data) => {
            // whitelist channels
            let validChannels = ["toMain"];
            if (validChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        receive: (channel, func) => {
            let validChannels = ["fromMain"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            }
        }
    }
);

contextBridge.exposeInMainWorld(
    "games", {
        getDataForGame: (name) => {
            return {
                ...store.get(name)
            }
        },
        install: (name) => {
            return install(name)
        },
        launch: (name) => {
            return launch(name)
        }
    }
)