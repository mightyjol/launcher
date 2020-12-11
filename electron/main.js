const { app, BrowserWindow, shell, ipcMain, Menu, autoUpdater } = require('electron');
const path = require('path');
const child = require('child_process').execFile;

const low = require("lowdb")
const Adapter = require('lowdb/adapters/FileSync')

const config = require('./config/dev.json')
const basepath = process.env['APP_PATH'] = app.getAppPath();
const dev = process.env.NODE_ENV === 'development';
const url = dev ? config.server.dev : config.server.prod;

let mainWindow

createWindow = (preload = true) => {
	let newWindow = new BrowserWindow({
		backgroundColor: '#FFFFFF',
		minWidth: 375,
		show: false,
		frame: true,
		width: 1280,
		height: 860,
	});

	return newWindow
}

createMainWindow = () => {
	mainWindow = createWindow()
	mainWindow.loadURL(url)

	/*if(dev)*/ mainWindow.webContents.openDevTools();
	
	mainWindow.once('ready-to-show', () => {
		//console.error('test')
		mainWindow.show();

		// //TODO figure out what this is for
		// ipcMain.on('open-external-window', (event, arg) => {
		// 	shell.openExternal(arg);
		// });
	});
};

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