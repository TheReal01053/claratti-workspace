const { Notification } = require('electron')
const main = require('../main')

/**
 * Sends a notification to user machine supports MacOS & Windows
 * @param {} message 
 */
function sendMessage(message) {
	console.log(main.appIcon)
	const notification = {
		icon: main.appIcon,
	  	title: 'Claratti Workspace',
	  	body: message
	}
	new Notification(notification).show()
}

module.exports.sendMessage = sendMessage