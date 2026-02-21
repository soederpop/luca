import container from '@/node'

async function main() {
	// GoogleAuth reads GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from env.
	// On first run it opens your browser for OAuth2 consent.
	// The refresh token is saved in diskCache so subsequent runs skip the browser.
	const auth = container.feature('googleAuth', {
		scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
	})

	const restored = await auth.tryRestoreTokens()

	if (restored) {
		console.log(`Restored session for ${auth.state.get('email')}`)
	} else {
		console.log('No cached credentials found — opening browser for authorization...')
		await auth.authorize()
		console.log(`Authorized as ${auth.state.get('email')}`)
	}

	const calendar = container.feature('googleCalendar', {
		timeZone: 'America/Chicago',
	})

	// List accessible calendars
	const calendars = await calendar.listCalendars()
	console.log(`\nYou have access to ${calendars.length} calendars:`)
	for (const cal of calendars) {
		const tag = cal.primary ? ' (primary)' : ''
		console.log(`  - ${cal.summary}${tag}`)
	}

	// Today's events
	const today = await calendar.getToday()
	console.log(`\nToday's events (${today.length}):`)
	for (const event of today) {
		const time = event.start.dateTime
			? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: 'All day'
		console.log(`  ${time}  ${event.summary}`)
	}

	// Upcoming 7 days
	const upcoming = await calendar.getUpcoming(7)
	console.log(`\nNext 7 days (${upcoming.length} events):`)
	for (const event of upcoming) {
		const date = event.start.dateTime
			? new Date(event.start.dateTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
			: event.start.date || ''
		const time = event.start.dateTime
			? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			: 'All day'
		console.log(`  ${date}  ${time}  ${event.summary}`)
	}
}

main().catch(console.error)
