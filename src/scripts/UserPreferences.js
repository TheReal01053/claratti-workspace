const Store = require('../model/store');

const store = new Store({
	configName: 'user-preferences',
	defaults: {
		email: '',
		customerURL: ''
	}
})

function setEmail(email) {
	store.set('email', email)
}

function getEmail() {
	return store.get('email')
}

function setCustomerURL(customerURL) {
	store.set('customerURL', customerURL)
}

function getCustomerURL() {
	return store.get('customerURL')
}

module.exports.store = store
module.exports.setEmail = setEmail
module.exports.getEmail = getEmail
module.exports.setCustomerURL = setCustomerURL
module.exports.getCustomerURL = getCustomerURL