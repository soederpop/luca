// Lifecycle hooks — export functions named after assistant events.
// The luca container is available here as a global, same as tools.ts.
declare const container: any

export function started() {
	console.log('Assistant started!')
}
