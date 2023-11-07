const {app, Tray, Menu, dialog, BrowserView, globalShortcut, BrowserWindow} = require('electron')
const electron = require('electron')
const url = require('url')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')
const notification = require('./scripts/SendMessage')
const store = require('./scripts/UserPreferences')
const customer = require('./model/Customers')
const ipc = electron.ipcMain

app.commandLine.appendSwitch('auto-detect', 'false')
app.commandLine.appendSwitch('no-proxy-server')

//user can only have one instance of the application open at a time
const gotTheLock = app.requestSingleInstanceLock()

//determines if user is running windows OS
var isWin = process.platform === "win32"

//isMac true or false whether the user OS is MacOS
const isMac = process.platform === 'darwin'

//checks if app is in idle state | true by default
let isActive = true

//checks if the user has logged into Citrix for timeout handler
let isLogged = false

//appIcon checks if the OS is MacOS if it is supplies a .icns otherwise .ico
const appIcon = isMac ? path.join(__dirname, "assets/cloud.icns") : path.join(__dirname, "assets/cloud2.ico") 

//customer citrix access point URL is set based on users email provided
let customerURL = "https://claratti.cloud.com"

//customerFound (relays back to renderer if a customer was found or not for error message)
let customerFound = false

//the customer email is set if the user chooses not to remember their email on initial setup
let customerEmail = ""

//the current view the user is on eg: home, load, citrix
let currView = ""

//check to see whether the citrix view login content has loaded so we can set the view
let contentLoaded = false

//auto-update options
let options  = {
	title: "Claratti Workspace",
	type: "question",
	buttons: ["Yes","No"],
	message: "A new version of Claratti Workspace is available would you like to update?"
}

//session time out options
let sOptions  = {
	title: "Claratti Workspace",
	type: "question",
	buttons: ["Keep me logged in"],
	message: "Your session will be logged out in 5 minutes due to inactivity, Do you wish to remain logged in?"
}

//determines whether or not the user has chosen to update or not within current session
let canUpdate = true

//determines whether the application is closed to system tray
let isClosed = false
//window displayed
let window

let tray

//idle timer
let idle, timeout 

if (isWin) {
    app.setAppUserModelId("Claratti Workspace Notification")
}

if (!gotTheLock) {
	app.quit()
} else {
	app.on('second-instance', (event, commandLine, workingDirectory) => {
		if (window) {

			if (window.isMinimized()) {
				window.restore()
			} 
			else if (tray != null) {
				window.restore()
				tray.destroy()
			}
			window.focus()
		}
	})
}

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
log.info('App starting...')

function createWindow() {

	let screenSize = electron.screen.getPrimaryDisplay().workAreaSize
	const screenWidth = screenSize.width * 0.70
	const screenHeight = screenSize.height * 0.85

	window = new BrowserWindow({
		width: screenWidth, 
		height: screenHeight, 
		minHeight: 540,
		minWidth: 955,
		title: "Claratti Workspace",
		modal: true,
		autoHideMenuBar: true,
		icon: appIcon,
		show: false
	})

	setTimeout(() => {
		if (!isMac)
			tray = createMenuTray("")

			//show window after 5 seconds fix for the few seconds of white screen until the content loads
	}, 5000)

	setTimeout(() => {
			//show window after 2.5 seconds fix for the few seconds of white screen until the content loads
			window.show()
	}, 2000)
}

function createViews() {
	/**
	 * BrowserViews
	 */
	const boundWidth = window.getBounds().width
	const boundHeight = window.getBounds().height

  	const loadView = new BrowserView()
	
	const homeView = new BrowserView({ 
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	})

 	const citrixView = new BrowserView({
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	})

	const connect = new BrowserView({
		webPreferences: {
			preload: path.join(__dirname, "preload.js")
		}
	})

	if (!window.isMinimized()) {
		globalShortcut.register('Control+Shift+I', () => {
			if (currView === 'citrix') {
				citrixView.webContents.openDevTools()
			} else {
				homeView.webContents.openDevTools()
			}	
		})
	}

	/** 
	 * Home view
	 *	This will only ever be visible if the user hasn't configured their email for routing customer.  
	 **/

	var noEmail = store.getEmail() === '' && customerEmail === ''

	// if no email is configured set the view to the home view and have the user provide their work email 
	// this is so we can route them to the correct Citrix customer portal
	if (noEmail) {
		console.log("user needs to reconfigure their email")
		currView = "home"
		
		window.addBrowserView(homeView)
		homeView.setBounds({ x: 0, y: 0, width: boundWidth, height: boundHeight })
		homeView.webContents.loadURL(url.format({
				pathname: path.join(__dirname, 'templates', 'index.html'),
				protocol: 'file:',
				slashes: true,
			})
		)

		homeView.setAutoResize({
			width: true,
			height: true,
		})

	} else {

		if (store.getCustomerURL() == undefined) {
			setPreferences(store.getEmail(), store.getEmail() == "" ? true : false)
			console.log(store.getEmail())
		}

		window.addBrowserView(citrixView)

		/** loader view **/
		window.addBrowserView(loadView)
		loadView.setBounds({ x: 0, y: 0, width: boundWidth, height: boundHeight })
		loadView.webContents.loadURL(
			url.format({
			pathname: path.join(__dirname, 'templates', 'loader.html'),
			protocol: 'file:',
			slashes: true,
			})
		)

		currView = "citrix"

		loadView.setAutoResize({
			width: true,
			height: true,
		})

		/** citrix view **/

		citrixView.setBounds({ x: 0, y: 0, width: boundWidth - 7, height: boundHeight - 30 })
		
		/**
		 * fix customer URL not loading correctly ... 
		 */

		customerURL = store.getCustomerURL() != "" ? store.getCustomerURL() : "https://claratti.cloud.com"

		if (customerURL.match("https://hallclaratti.cloud.com")) {
			store.setCustomerURL("https://hallcontracting.cloud.com")
			customerURL = store.getCustomerURL()
			console.log("setting hall contracing URL")
		}
		
		var receiverURL = customerURL.replace("https://", "")
		connect.webContents.loadURL(`receiver://${receiverURL}/Citrix/Store/clientAssistant/reportDetectionStatus/`);

		citrixView.webContents.loadURL(customerURL)
		citrixView.setAutoResize({
			width: true,
			height: true,
		})

		var intervalId = setInterval(() => {
			if (contentLoaded) {
				window.setBrowserView(citrixView) 
				clearInterval(intervalId)
			}
			console.log("checking if content loaded...")
		}, 1000)
	}

	window.on('page-title-updated', (evt) => {
		evt.preventDefault()
	})

	window.on('restore', (event) => {
		window.show()
		console.log("Restore application from system tray.")
		if (tray != null) {
			tray.destroy()
			isClosed = false
		}
	})

	window.on('close', (event) => {
		if (!isMac) {
			if (!app.isQuitting && !isClosed) {
				console.log("Closing application within CreateWindow method.")
				if (tray != null)
					tray.destroy()
				event.preventDefault()
				window.hide()
				tray = createMenuTray("Claratti Workspace has been closed to the system tray.")
				isClosed = true
			}
		} else {
			app.isQuitting = true
			destroy()
			app.quit()
		}
	})

	autoUpdater.checkForUpdates()
	
	window.on('blur', () => {
		console.log(isActive + " " + isLogged)
		if (isActive && isLogged) {
			createIdle()
			console.log("blurred")
 		}	
		if (isLogged)
			isActive = false	
	})

	return window
}

function createIdle() {
	timeout = setTimeout(() => {
		console.log("dialog sent....")

		if (isClosed) {
			window.show()
			isClosed = false
		}

		dialog.showMessageBox(window, sOptions, (response) => {
		

		}).then(res => {
			const result = res.response
			console.log(result)
		
			if (result == 0) {
				clearTimeout(idle)
				clearTimeout(timeout)
				isActive = true
				console.log("user has decided to stay logged in")
			}
			clearTimeout(timeout)
		})
		//1500000
	}, 1500000)
	idle = setTimeout(() => {
		
		 console.log("window has been idle for 30 minutes, restarting.") 
		 app.relaunch()
		 app.exit()
		 clearTimeout(idle)
	}, 1800000)
}

function createMenuTray(message) {
	if (tray != null) 
		tray.destroy()
	//let message = "Claratti Workspace has been closed to the system tray."

	if (message != "")
		notification.sendMessage(message)

	console.log("Hide to system tray.")
	let trayIcon = new Tray(appIcon)
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show', click: () => {
            	window.show()
				isClosed = false
				tray = createMenuTray("")
            }
        },
        {
            label: 'Quit', click: () => {
                app.isQuitting = true
				destroy()
                app.quit()
            }
        }
    ])

    trayIcon.on('double-click', (event) => {
		window.show()
		tray.destroy()
		isClosed = false
		tray = createMenuTray("")
    })

    trayIcon.setToolTip('Claratti Workspace')
    trayIcon.setContextMenu(contextMenu)
    return trayIcon
}

app.whenReady().then(() => {
	
	createWindow()
	createViews()

	app.on('activate', () => {
	  if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

ipc.on('setEmail', (event, email, rememberMe) => {
	setPreferences(email, rememberMe)
	setTimeout(() => {
		if (!customerFound) {
			event.reply('no-customer-found', email)
		}
	}, 1000)
})

ipc.on('logged-in', (event, username) => {
	var letters = /^[A-Za-z]+$/;
	if (username.match(letters)) {
		isLogged = true
		console.log("user has logged in")
	}
})

ipc.on('reload-app', (event, response) => {
	console.log(response)
	contentLoaded = false
	createViews()
})

function setPreferences(email, rememberMe) {
	/*for (let i = 0; i < customer.customers.length; i++) {
		let customerName = customer.customers[i][0]

		if (email.includes(customerName)) {
			customerFound = true
			if (rememberMe) 
				store.setEmail(email)
			else
				customerEmail = email

			customerURL = customer.customers[i][1]
			console.log(customerURL)
			store.setCustomerURL(customerURL)
			createViews()
			break;
		} else {
			customerFound = false
		}
	}*/

	for (let i = 0; i < customer.customers.length; i++) { 

		let website = customer.customers[i][0].toString().split(',')
		
		for (domain in website) {
			console.log(website[domain])

			if (email.includes(website[domain])) {
				customerFound = true
				if (rememberMe) 
					store.setEmail(email)
				else
					customerEmail = email
	
				customerURL = customer.customers[i][1]
				console.log(customerURL)
				store.setCustomerURL(customerURL)
				createViews()
				break;
			} else {
				console.log("CUSTOMER NOT FOUND")
				customerFound = false
			}
		}
	}
}

function destroy() {
	if (tray != null) 
		tray.destroy()
}

ipc.on('content-loaded', (event, targetNode) => {
	setTimeout(() => {
		contentLoaded = true
	}, 4000)
	event.reply('content-finished-loading', "the citrix content has finished loading....")
})

ipc.on('content-finished-loading', (event, response) =>{
	console.log(response)
})
  
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit()
})

/** AUTO UPDATING **/

autoUpdater.on('checking-for-update', () => {
	console.log('Checking for update...' + app.getVersion())
  })
autoUpdater.on('update-available', info => {
	console.log('Update available.')
})

autoUpdater.on('update-not-available', info => {
	console.log('Update not available.')
})

autoUpdater.on('error', err => {
	console.log(`Error in auto-updater: ${err.toString()}`)
})

autoUpdater.on('download-progress', progressObj => {
	console.log(
	  `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred} + '/' + ${progressObj.total} + )`
	)
})

autoUpdater.on('update-downloaded', info => {
	console.log('Update downloaded will install now')
})
  
autoUpdater.on('update-downloaded', info => {

	if (canUpdate) {
		dialog.showMessageBox(window, options, (response) => {
			console.log(response)
		}).then(res => {
			const result = res.response
			console.log(result)
	
			if (result == 0) {
				autoUpdater.quitAndInstall()
				console.log('User has updated Claratti Workspace')
			} else {
				console.log('User preferred not to update just yet.')
				canUpdate = false
			}
		})
	}
})

module.exports.isMac = isMac
module.exports.appIcon = appIcon