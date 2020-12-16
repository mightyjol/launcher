const Progress = require('progress-stream');
const fs = require('fs')
const path = require('path')
const unzip = require('unzipper');
const { app, BrowserWindow } = require("electron");

const store = require('./store.js')
const drive = require('./drive.js')
const games = require('./versions');

let dev = process.env.NODE_ENV === 'development';

let folder = {
    witch_craft: "128z_F9bIZRl3kJA5BE6VNt1Mx1jo47bG",
    witch_craft_patches: "14kPGygb0ElZIat3RaL2W4nAXpCaUOSoT"
}

let allStreams = []

function installGame(name){
    console.log('installing ' + name)

    if(!games[name]) return

    let mainWindow = BrowserWindow.getAllWindows()[0]
    let game = games[name]
    let latest = game.versions[game.versions.length - 1]

    mainWindow.webContents.send('fromMain', { event: 'install', step: 'start', game: name })
    drive.files.list({
        q: `name='${latest}.zip'`,
        pageSize: 2,
        fields: 'nextPageToken, files(id, name, size)',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const files = res.data.files;
        if (files.length) {
            createFolderIfNotExists('tmp')
            let file = files[0]
            let tmpPath = `tmp/${name}-${file.name}`
            let currentFileSize = 0
            if(fs.existsSync(tmpPath)) currentFileSize = fs.statSync(tmpPath).size
            
            if(currentFileSize >= file.size){
                return installFromTmp(name, file)
            }

            let dest = fs.createWriteStream(tmpPath, {flags:'a'});
            allStreams.push(dest)
            let progress = Progress({time:100, length: (file.size - currentFileSize)})
            
            drive.files.get({
                fileId: file.id,
                alt: 'media',
                
            }, { responseType: 'stream', headers: { Range: `bytes=${currentFileSize}-` } })
            .then( res => {
                res.data
                    .on("end", () => {
                        return installFromTmp(name, file)
                    })
                    .on("error", err => {
                        console.log("Error during download", err);
                    })
                    .pipe(progress).pipe(dest);
            })
            .catch(e => { console.error(e) })

            progress.on('progress', function(progress) { 
                let percentage = (((file.size - progress.remaining) / file.size) *100).toFixed(2)
                mainWindow.webContents.send('fromMain', { event: 'install', step: 'download', progress: percentage, game: name })
            });
        } else {
            console.log('No files found.');
        }
    });
}

function installFromTmp(game, file){
    let mainWindow = BrowserWindow.getAllWindows()[0]
    let folder = path.join(path.dirname(process.execPath), '..', game)
    if(process.env.NODE_ENV === 'development') folder = game
    createFolderIfNotExists(folder)
    let progress = Progress({time:100, length: file.size})
    let filepath = `tmp/${game}-${file.name}`

    mainWindow.webContents.send('fromMain', { event: 'install', step: 'installation-start', game })

    fs.createReadStream(filepath)
        .on('end', () => {
            let data = {
                installed: true,
                version: file.name.replace('.zip', ''),
                path: null,
                patches: []
            }
            store.set(game, data)

            mainWindow.webContents.send('fromMain', { event: 'install', step: 'complete', game })

            fs.unlinkSync(filepath)
        })
        .pipe(progress)
        .pipe(unzip.Extract({ path: folder }));

    progress.on('progress', function(progress) {
        mainWindow.webContents.send('fromMain', { event: 'install', step: 'installation', progress: progress.percentage.toFixed(2), game })
    });
}

function createFolderIfNotExists(folder){
    if (!fs.existsSync(folder)){
        fs.mkdirSync(folder);
    }
}

function getPatchFolder(game, version){
    return drive.files.list({
        q: `'${folder[game + '_patches']}' in parents and name='${version}'`,
        pageSize: 2,
        fields: 'files(id, name, size)',
    })
}

function listFilesInFolder(folderId){
    return drive.files.list({
        q: `'${folderId}' in parents`,
        pageSize: 2,
        fields: 'files(id, name, size)',
    })
}

// todo
function cleanOlderVersions(game){
    return
}

function needsUpdate(game, version){
    let mainWindow = BrowserWindow.getAllWindows()[0]
    let isLatestVersion = games[game].latest === version

    if(!isLatestVersion){
        installGame(game)
        cleanOlderVersions(game)
        return
    }

    getPatchFolder(game, version)
        .then(res => {
            let id =res.data.files[0].id
            listFilesInFolder(id).then(res =>{
                let remotePatches = res.data.files
                let existingPatches = []
                let patchesToInstall = []

                let pathToPak = [game, version, game, 'Content', 'Paks']
                let gameFolder = process.env.NODE_ENV === 'development' ? path.resolve(app.getAppPath(), ...pathToPak) : path.resolve(appFolder, '..', ...pathToPak)

                fs.readdir(
                    gameFolder,
                    (err, files) => {
                        if (err) throw err;
                        
                        for (let file of files) {
                            existingPatches.push(file)
                        }
                        
                        for(let patch of remotePatches){
                            if(!existingPatches.includes(patch.name)) patchesToInstall.push(patch)
                        }

                        if(!patchesToInstall.length){
                            return mainWindow.webContents.send('fromMain', { event: 'update', step: 'uptodate', game })
                        }

                        let downloadPromises = []
                        let allFileSize = patchesToInstall.reduce((a, b) => a + parseInt(b.size), 0)
                        let progress = Progress({time:100})
                        let patchesDownloaded = 0
                        let totalCurrentFileSize = 0

                        for(let patch of patchesToInstall){
                            let tmpPath = `tmp/patch-${version}-${patch.name}`
                            let currentFileSize = 0
                            if(fs.existsSync(tmpPath)){
                                currentFileSize = fs.statSync(tmpPath).size
                                totalCurrentFileSize += currentFileSize 
                            }

                            downloadPromises.push(
                                drive.files.get({ fileId: patch.id, alt: 'media' }, { responseType: 'stream', headers: { Range: `bytes=${currentFileSize}-` }})
                                    .then(r => {
                                        if(currentFileSize >= patch.size){
                                            patchesDownloaded++
                                            if(patchesDownloaded === patchesToInstall.length){
                                                return installMissingPatches(game, version, patchesToInstall)
                                                //return mainWindow.webContents.send('fromMain', { event: 'update', step: 'complete', game })
                                            }
                                            return
                                        }

                                        let dest = fs.createWriteStream(tmpPath)
                                        allStreams.push(dest)
                                        r.data
                                            .on('end', () => {
                                                patchesDownloaded++
                                                if(patchesDownloaded === patchesToInstall.length){
                                                    return installMissingPatches(game, version, patchesToInstall)
                                                }
                                            })
                                            .pipe(progress).pipe(dest)
                                    })
                            )
                        }
                        
                        progress.setLength(allFileSize - totalCurrentFileSize)
                        progress.on('progress', function(progress) {
                            let percentage = (((allFileSize - progress.remaining) / allFileSize) *100).toFixed(2)
                            mainWindow.webContents.send('fromMain', { event: 'update', step: 'download', progress: percentage, game })
                        });

                        Promise.all(downloadPromises)
                    }
                );
            })
        })
}

function installMissingPatches(game, version, files){
    let mainWindow = BrowserWindow.getAllWindows()[0]
    let appFolder = path.resolve(process.execPath, '..');
    let pathToPak = [game, version, game, 'Content', 'Paks']
    let gameFolder = process.env.NODE_ENV === 'development' ? path.resolve(app.getAppPath(), ...pathToPak) : path.resolve(appFolder, '..', ...pathToPak)
    
    let progress = Progress({time:100, length: files.reduce((a, b) => a + parseInt(b.size), 0)})

    mainWindow.webContents.send('fromMain', { event: 'update', step: 'installation-start', game })

    let patchesInstalled = 0
    for(let patch of files){
        let filepath = `tmp/patch-${version}-${patch.name}`
        let readable = fs.createReadStream(filepath);
        let writable = fs.createWriteStream(path.join(gameFolder, patch.name));
        allStreams.push(writable)

        // use pipe to copy readable to writable
        readable
            .on('end', () => {
                patchesInstalled++
                if(patchesInstalled === files.length) mainWindow.webContents.send('fromMain', { event: 'update', step: 'complete', game })
                fs.unlinkSync(filepath)
            })
            .pipe(progress).pipe(writable);
    }

    progress.on('progress', function(progress) {
        mainWindow.webContents.send('fromMain', { event: 'update', step: 'installation', progress: progress.percentage.toFixed(2), game })
    });
}

function endAllStreams(){
    for(let stream of allStreams){
        stream.end()
    }
    allStreams = []
    return
}

module.exports = {
    installGame,
    needsUpdate,
    endAllStreams
}