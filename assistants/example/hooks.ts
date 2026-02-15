function response(text) {
	console.log(`[assistant] Response received (${text.length} chars)`)
}

function started() {
	console.log('[assistant] Example assistant started')
}

module.exports = { response, started }
