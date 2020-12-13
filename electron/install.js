let games = {
    witch_craft: {
        versions: [
            "0.0.1"
        ]
    }
}

const {google} = require('googleapis');
const credentials = require('./google.json');
const Progress = require('progress-stream');
const fs = require('fs')
const unzip = require('unzipper');
const { resolve } = require('path');
const Store = require('electron-store');
const remote = require("electron").remote;
const dev = process.env.NODE_ENV === 'development';

//console.log(credentials)
const scopes = [
  'https://www.googleapis.com/auth/drive.readonly'
];
const auth = new google.auth.JWT(
  credentials.client_email, null,
  credentials.private_key, scopes
);

let drive = google.drive({version: 'v3', auth})
let store = new Store()

module.exports = function(name){
    console.log('installing ' + name)

    if(!games[name]) return
    let game = games[name]
    let latest = game.versions[game.versions.length - 1]

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
            console.log(file)
            let dest = fs.createWriteStream(`tmp/${name}-${file.name}`);
            let progress = Progress({time:100, length: file.size})

            drive.files.get({
                fileId: file.id,
                alt: 'media'
            },{ responseType: 'stream' }, function(err, res) {
                res.data
                  .on("end", () => {
                    installFromTmp(name, file)
                  })
                  .on("error", err => {
                    console.log("Error during download", err);
                  })
                  .pipe(progress).pipe(dest);
            } )
                 
            
            progress.on('progress', function(progress) {
                console.log('download in progress ' + progress.percentage.toFixed(2) + '%')
            });
        } else {
            console.log('No files found.');
        }
    });
}

function installFromTmp(game, file){
    createFolderIfNotExists(game)
    let progress = Progress({time:100, length: file.size})
    let filepath = `tmp/${game}-${file.name}`
    fs.createReadStream(filepath)
        .on('end', () => {
            console.log('install complete')
            
            if(dev){
                // write to local file
            }
            console.log('updating store')
            let data = {}
            data[game] = {
                installed: true,
                version: file.name.replace('.zip', ''),
                path: null
            }
            store.set(data)
            console.log('store updated')

            console.log('sending message to window')
            remote.getCurrentWebContents().send('fromMain', { event: 'install', step: 'complete' })
            console.log('unlinking file')
            fs.unlinkSync(filepath)
            console.log('file unlinked')
        })
        .pipe(progress)
        .pipe(unzip.Extract({ path: game }));

    progress.on('progress', function(progress) {
        console.log('installation in progress ' + progress.percentage.toFixed(2) + '%')
    });
}

function createFolderIfNotExists(folder){
    if (!fs.existsSync(folder)){
        fs.mkdirSync(folder);
    }
}
