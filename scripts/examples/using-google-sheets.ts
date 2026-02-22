import container from '@soederpop/luca/node'

// Pass a spreadsheet ID as the first argument, or set DEFAULT_SPREADSHEET_ID env var.
// You can find the ID in a Google Sheets URL:
//   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
const spreadsheetId = process.argv[2] || process.env.DEFAULT_SPREADSHEET_ID

async function main() {
	if (!spreadsheetId) {
		console.error('Usage: bun run scripts/examples/using-google-sheets.ts <spreadsheet-id>')
		console.error('  or set DEFAULT_SPREADSHEET_ID env var')
		process.exit(1)
	}

	// GoogleAuth reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
	// On first run it opens your browser for OAuth2 consent.
	// The refresh token is saved in diskCache so subsequent runs skip the browser.
	const auth = container.feature('googleAuth', {
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
	})

	const restored = await auth.tryRestoreTokens()

	if (restored) {
		console.log(`Restored session for ${auth.state.get('email')}`)
	} else {
		console.log('No cached credentials found — opening browser for authorization...')
		await auth.authorize()
		console.log(`Authorized as ${auth.state.get('email')}`)
	}

	const sheets = container.feature('googleSheets', {
		defaultSpreadsheetId: spreadsheetId,
	})

	// Get spreadsheet metadata
	const meta = await sheets.getSpreadsheet()
	console.log(`\n--- Spreadsheet: "${meta.title}" ---`)
	console.log(`Locale: ${meta.locale}`)
	console.log(`Sheets (${meta.sheets.length}):`)
	for (const sheet of meta.sheets) {
		console.log(`  ${sheet.title}  (${sheet.rowCount} rows × ${sheet.columnCount} cols)`)
	}

	// Read first sheet as JSON (first row = headers)
	const firstSheet = meta.sheets[0]
	if (!firstSheet) {
		console.log('\nNo sheets found in this spreadsheet.')
		return
	}

	const data = await sheets.getAsJson(firstSheet.title)
	console.log(`\n--- "${firstSheet.title}" as JSON (first 5 rows) ---`)
	if (data.length === 0) {
		console.log('  (empty or header-only sheet)')
	} else {
		const headers = Object.keys(data[0]!)
		console.log(`  Columns: ${headers.join(', ')}`)
		for (const row of data.slice(0, 5)) {
			console.log(`  ${JSON.stringify(row)}`)
		}
		if (data.length > 5) {
			console.log(`  ... and ${data.length - 5} more rows`)
		}
	}

	// Read as CSV
	const csv = await sheets.getAsCsv(firstSheet.title)
	const csvLines = csv.split('\n')
	console.log(`\n--- "${firstSheet.title}" as CSV (first 5 lines) ---`)
	for (const line of csvLines.slice(0, 5)) {
		console.log(`  ${line}`)
	}
	if (csvLines.length > 5) {
		console.log(`  ... and ${csvLines.length - 5} more lines`)
	}

	// Read a specific range if there are enough rows
	if (firstSheet.rowCount >= 2 && firstSheet.columnCount >= 2) {
		const range = `${firstSheet.title}!A1:B5`
		const values = await sheets.getRange(range)
		console.log(`\n--- Range: ${range} ---`)
		for (const row of values) {
			console.log(`  ${row.join('\t')}`)
		}
	}
}

main().catch(console.error)
