let games = {
    witch_craft: {
        versions: [
            "0.0.1"
        ]
    }
}

const {google} = require('googleapis');
const credentials = require('./google.json');
const store = require('./store.js')
const Progress = require('progress-stream');
const fs = require('fs')
const path = require('path')
const unzip = require('unzipper');
const { BrowserWindow } = require("electron");

//console.log(credentials)
const scopes = [
  'https://www.googleapis.com/auth/drive.readonly'
];
const auth = new google.auth.JWT(
  credentials.client_email, null,
  credentials.private_key, scopes
);

let drive = google.drive({version: 'v3', auth})

module.exports = function(name){
    console.log('installing ' + name)

    if(!games[name]) return

    let mainWindow = BrowserWindow.getAllWindows()[0]
    let game = games[name]
    let latest = game.versions[game.versions.length - 1]

    mainWindow.webContents.send('fromMain', { event: 'install', step: 'start' })
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
            let dest = fs.createWriteStream(`tmp/${name}-${file.name}`);
            let progress = Progress({time:100, length: file.size})
            
            drive.files.get({
                fileId: file.id,
                alt: 'media'
            }, { responseType: 'stream' })
            .then( res => {
                console.log(res)
                res.data
                  .on("end", () => {
                    installFromTmp(name, file)
                  })
                  .on("error", err => {
                    console.log("Error during download", err);
                  })
                  .pipe(progress).pipe(dest);
            })
            .catch(e => { console.error(e) })

            progress.on('progress', function(progress) {
                mainWindow.webContents.send('fromMain', { event: 'install', step: 'download', progress: progress.percentage.toFixed(2), game: name })
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

            mainWindow.webContents.send('fromMain', { event: 'install', step: 'complete' })

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
