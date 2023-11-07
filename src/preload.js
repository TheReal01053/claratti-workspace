// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const electron = require('electron')
const ipc = electron.ipcRenderer

let passwordExpired = false

window.addEventListener('DOMContentLoaded', (event) => {

	/**
	 * Reload button
	 */

	setTimeout(() => {
		var message = document.getElementsByClassName('session-expired-message')[0]
		var div = document.createElement('div')
		div.setAttribute('class', 'reloadDiv')
		div.style.paddingTop = "10px"

		message.appendChild(div)

		var reloadBtn = document.createElement('button')
		reloadBtn.setAttribute('id', 'reloadBtn')
		reloadBtn.textContent = 'Sign in'
		reloadBtn.style.backgroundColor = "#BDF0ED"
		reloadBtn.style.border = "none"
		reloadBtn.style.color = "#003D48"
		reloadBtn.style.height = "40px"
		reloadBtn.style.width = "50%"
		reloadBtn.style.textAlign = "center"
		reloadBtn.style.textDecoration = "none"
		reloadBtn.style.display = "inline-block"
		reloadBtn.style.outline = "none"
		reloadBtn.style.fontSize = "16px"
		reloadBtn.style.borderRadius = "20px"
		
		var addBtn = document.getElementsByClassName('reloadDiv')[0]

		addBtn.appendChild(reloadBtn)

		reloadBtn.addEventListener('click', () => {
			console.log('test click')
			ipc.send('reload-app', "reload application")
		})

		reloadBtn.addEventListener('mouseover', () => {
			reloadBtn.style.opacity = "0.8"
		})

		reloadBtn.addEventListener('mouseout', () => {
			reloadBtn.style.opacity = "1.0"
		})

	}, 500)

	/** Observe and DOM changes in Citrix View **/
	var observer = new MutationObserver(function(mutations) {
		mutations.forEach(function(mutation) {
			console.log(mutation.type);
			ipc.send('content-loaded', mutation.type)
		});    
	});

	var observerConfig = {
		attributes: true, 
		childList: true, 
		characterData: true 
	};
	
	var targetNode = document.body;
	observer.observe(targetNode, observerConfig);

	//button to setEmail on config window
	const setEmail = document.getElementById('setEmail')
	const errorMsg = document.getElementById('errorMsg')

	if (setEmail != null) {
		setEmail.addEventListener('click', () => {
			let email = document.getElementById("inputEmail").value.toLowerCase()
			let rememberMe = document.getElementById("rememberMe").checked
			console.log(email)
			ipc.send('setEmail', email, rememberMe)
		})
	}

	ipc.on('no-customer-found', (event, email) => {
		console.log(`no customers found with ${email}`)

		errorMsg.innerHTML = email !== '' ? `No customer exists with ${email}` : 'You must provide a work email'
		errorMsg.style.visibility = "visible";
		errorMsg.style.display = "inline";
		errorMsg.style.color = 'red';
	})

	//reply when the citrix view content has finished loading debugging purposes
	ipc.on('content-finished-loading', (event, response) => {

		var errorMsg = document.getElementsByClassName("standaloneText label error")
		var passBtn = document.getElementById("changePasswordBtn")
		if (passBtn != null) {
			passwordExpired = true
			console.log(passwordExpired)
		}
		if (errorMsg[0] != undefined) {
			if (errorMsg[0].innerHTML == "An unknown error occurred" && passwordExpired) {
				errorMsg[0].innerHTML = "The password did not meet the password complexity requirements!<br /><br />" +
										"It must contain characters from two of the following categories.<br />" + 
										"<ul>"+ 
										"<li>Must contain 8 or more characters</li>" +
										"<li>Uppercase characters A-Z</li>" +
										"<li>Lowercase characters a-z</li>" +
										"<li>Digits 0-9</li>" +
										"<li>Special characters (!, $, #, %, etc.)</li>" +
										"</ul>"

				passwordExpired = false
			}
		}

		var isLogged = document.getElementsByClassName("wsui-1v564w1")[0].innerText

		ipc.send('logged-in', isLogged)


		ipc.send("content-finished-loading", response)
	})
})

window.addEventListener('load', (event) => {
	document.getElementsByTagName('label')[2].innerText = "Authenticator Code"
})