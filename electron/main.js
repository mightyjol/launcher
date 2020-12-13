const { app, BrowserWindow, shell, ipcMain, Menu, dialog  } = require('electron');
const { autoUpdater } = require("electron-updater");
// main
let mainWindow
let checkUpdateInterval

// prevents launching during install
// if (require('electron-squirrel-startup')) return app.quit();

// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
	// squirrel event handled and app will exit in 1000ms, so don't do anything else
	return;
}

function handleSquirrelEvent() {
	if (process.argv.length === 1) {
	  return false;
	}
  
	const ChildProcess = require('child_process');
	let path = require('path');
	const appFolder = path.resolve(process.execPath, '..');
	const rootAtomFolder = path.resolve(appFolder, '..');
	const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
	const exeName = path.basename(process.execPath);
  
	const spawn = function(command, args) {
	  let spawnedProcess, error;
  
	  try {
		spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
	  } catch (error) {}
  
	  return spawnedProcess;
	};
  
	const spawnUpdate = function(args) {
	  return spawn(updateDotExe, args);
	};
  
	const squirrelEvent = process.argv[1];
	switch (squirrelEvent) {
	  case '--squirrel-install':
	  case '--squirrel-updated':
		// Optionally do things such as:
		// - Add your .exe to the PATH
		// - Write to the registry for things like file associations and
		//   explorer context menus
		
		console.log("update complete")
		// Install desktop and start menu shortcuts
		spawnUpdate(['--createShortcut', exeName]);
  
		setTimeout(app.quit, 1000);
		return true;
  
	  case '--squirrel-uninstall':
		// Undo anything you did in the --squirrel-install and
		// --squirrel-updated handlers
  
		// Remove desktop and start menu shortcuts
		spawnUpdate(['--removeShortcut', exeName]);
		
		console.log("uninstall complete")
		setTimeout(app.quit, 1000);
		return true;
  
	  case '--squirrel-obsolete':
		// This is called on the outgoing version of your app before
		// we update to the new version - it's the opposite of
		// --squirrel-updated
		
		app.quit();
		return true;
	}
};

const path = require('path')
const url = require('url')
const fs = require('fs')

const config = require('./config/dev.json');
const basepath = process.env['APP_PATH'] = app.getAppPath();
const dev = process.env.NODE_ENV === 'development';
const loadUrl = "static/index.html";

// auto updates
const server = "https://hazel.insomniak.vercel.app"
const feed = `${server}/update/${process.platform}/${app.getVersion()}`

autoUpdater.setFeedURL(feed)

if(fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'update.exe'))){
	if(mainWindow) mainWindow.webContents.send('fromMain', 'check updates')

	checkUpdateInterval = setInterval(() => {
		autoUpdater.checkForUpdates()
	}, 5000)
}

autoUpdater.on('update-available', (event) => {
	if(mainWindow) mainWindow.webContents.send('fromMain', 'update found')
	clearInterval(checkUpdateInterval)
})

autoUpdater.on('update-not-available', (event) => {
	if(mainWindow) mainWindow.webContents.send('fromMain', 'no update')
})

autoUpdater.on('download-progress', (progressObj) => {
	if(mainWindow) mainWindow.webContents.send('fromMain', 'Downloaded ' + progressObj.percent + '%')
})

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
	const dialogOpts = {
	  type: 'info',
	  buttons: ['Restart', 'Later'],
	  title: 'Application Update',
	  message: process.platform === 'win32' ? releaseNotes : releaseName,
	  detail: 'A new version has been downloaded. Restart the application to apply the updates.'
	}
	if(mainWindow) mainWindow.webContents.send('fromMain', 'update downloaded')
	
	dialog.showMessageBox(dialogOpts).then((returnValue) => {
	  if (returnValue.response === 0) autoUpdater.quitAndInstall()
	})
})

autoUpdater.on('error', message => {
	const dialogOpts = {
		type: 'error',
		buttons: ['ok'],
		title: 'Application Update Error',
		message: "error",
		detail: message
	}
	
	dialog.showMessageBox(dialogOpts).then((returnValue) => {
	})

	if(mainWindow) mainWindow.webContents.send('fromMain', message)
})

createWindow = (preload = true) => {
	let newWindow = new BrowserWindow({
		backgroundColor: '#FFFFFF',
		minWidth: 375,
		show: false,
		frame: true,
		width: 1280,
		height: 860,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: true, // todo remove this and readonly from json in preload.js
			preload: path.join(app.getAppPath(), 'electron/preload.js')
		}
	});

	return newWindow
}

createMainWindow = () => {
	mainWindow = createWindow()
	 
	// todo check how long this takes
	let fileUrl = path.join(__dirname, loadUrl)
	// let data = fs.readFileSync(fileUrl, {encoding:'utf8', flag:'r'});

	// let result = data.replace('<base href=/ >', `<base href="${ __dirname.replaceAll('\\', '/') + '/public/' }" >`)

	// fs.writeFileSync(fileUrl, result)

	mainWindow.loadURL(url.format({
		pathname: fileUrl,
		protocol: 'file:',
		slashes: true
	}))
	

	/*if(dev)*/ mainWindow.webContents.openDevTools();
	
	mainWindow.once('ready-to-show', () => {
		//console.error('test')
		mainWindow.show();
		if(mainWindow) mainWindow.webContents.send('fromMain', 'init')
		// //TODO figure out what this is for
		// ipcMain.on('open-external-window', (event, arg) => {
		// 	shell.openExternal(arg);
		// });
	});
};

// IPC MAIN


app.on('ready', () => {
	createMainWindow();
});

app.on('window-all-closed', () => {
	app.quit();
});

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow();
	}
});