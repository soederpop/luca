import container from '@/node'

// Pass a document ID as the first argument, or omit to list available docs.
// You can find the ID in a Google Docs URL:
//   https://docs.google.com/document/d/DOCUMENT_ID/edit
const documentId = process.argv[2]

async function main() {
	// GoogleAuth reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
	// On first run it opens your browser for OAuth2 consent.
	// The refresh token is saved in diskCache so subsequent runs skip the browser.
	const auth = container.feature('googleAuth', {
		scopes: [
			'https://www.googleapis.com/auth/documents.readonly',
			'https://www.googleapis.com/auth/drive.readonly',
		],
	})

	const restored = await auth.tryRestoreTokens()

	if (restored) {
		console.log(`Restored session for ${auth.state.get('email')}`)
	} else {
		console.log('No cached credentials found — opening browser for authorization...')
		await auth.authorize()
		console.log(`Authorized as ${auth.state.get('email')}`)
	}

	const docs = container.feature('googleDocs')

	// List recent Google Docs
	const allDocs = await docs.listDocs()
	console.log(`\n--- Your Google Docs (${allDocs.length}) ---`)
	for (const doc of allDocs.slice(0, 15)) {
		const modified = doc.modifiedTime
			? new Date(doc.modifiedTime).toLocaleDateString()
			: ''
		console.log(`  ${doc.name}  ${modified}`)
		console.log(`    id: ${doc.id}`)
	}
	if (allDocs.length > 15) {
		console.log(`  ... and ${allDocs.length - 15} more`)
	}

	// If a document ID was provided, read it
	if (documentId) {
		// Plain text
		const text = await docs.getAsText(documentId)
		const lines = text.split('\n')
		console.log(`\n--- Document as Plain Text (first 20 lines) ---`)
		for (const line of lines.slice(0, 20)) {
			console.log(`  ${line}`)
		}
		if (lines.length > 20) {
			console.log(`  ... and ${lines.length - 20} more lines`)
		}

		// Markdown
		const markdown = await docs.getAsMarkdown(documentId)
		const mdLines = markdown.split('\n')
		console.log(`\n--- Document as Markdown (first 30 lines) ---`)
		for (const line of mdLines.slice(0, 30)) {
			console.log(`  ${line}`)
		}
		if (mdLines.length > 30) {
			console.log(`  ... and ${mdLines.length - 30} more lines`)
		}
	} else {
		console.log('\nTip: pass a document ID to read its contents:')
		console.log('  bun run scripts/examples/using-google-docs.ts <document-id>')
	}
}

main().catch(console.error)
