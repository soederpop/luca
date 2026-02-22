import container from '@soederpop/luca/node'

async function main() {
	// GoogleAuth reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
	// On first run it opens your browser for OAuth2 consent.
	// The refresh token is saved in diskCache so subsequent runs skip the browser.
	const auth = container.feature('googleAuth', {
		scopes: ['https://www.googleapis.com/auth/drive.readonly'],
	})

	const restored = await auth.tryRestoreTokens()

	if (restored) {
		console.log(`Restored session for ${auth.state.get('email')}`)
	} else {
		console.log('No cached credentials found — opening browser for authorization...')
		await auth.authorize()
		console.log(`Authorized as ${auth.state.get('email')}`)
	}

	const drive = container.feature('googleDrive')

	// List recent files
	const { files: recent } = await drive.listFiles(undefined, { pageSize: 10 })
	console.log(`\n--- 10 Most Recently Modified Files ---`)
	for (const file of recent) {
		const modified = file.modifiedTime
			? new Date(file.modifiedTime).toLocaleDateString()
			: ''
		const size = file.size ? `${(parseInt(file.size) / 1024).toFixed(1)} KB` : ''
		console.log(`  ${file.name}  ${modified}  ${size}`)
		console.log(`    type: ${file.mimeType}`)
	}

	// Browse root folder
	const root = await drive.browse('root')
	console.log(`\n--- Root Folder ---`)
	console.log(`Folders (${root.folders.length}):`)
	for (const folder of root.folders.slice(0, 10)) {
		console.log(`  📁 ${folder.name}`)
	}
	console.log(`Files (${root.files.length}):`)
	for (const file of root.files.slice(0, 10)) {
		console.log(`  📄 ${file.name}  (${file.mimeType})`)
	}

	// Search for documents
	const { files: docs } = await drive.search('report', {
		mimeType: 'application/vnd.google-apps.document',
		pageSize: 5,
	})
	console.log(`\n--- Search: "report" (Google Docs only) ---`)
	if (docs.length === 0) {
		console.log('  No matching documents found.')
	} else {
		for (const doc of docs) {
			console.log(`  ${doc.name}`)
			if (doc.webViewLink) console.log(`    ${doc.webViewLink}`)
		}
	}

	// List shared drives
	const sharedDrives = await drive.listDrives()
	console.log(`\n--- Shared Drives (${sharedDrives.length}) ---`)
	if (sharedDrives.length === 0) {
		console.log('  No shared drives found.')
	} else {
		for (const sd of sharedDrives) {
			console.log(`  ${sd.name}  (${sd.id})`)
		}
	}
}

main().catch(console.error)
