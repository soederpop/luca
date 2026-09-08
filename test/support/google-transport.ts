import { mock } from 'bun:test'

/** Exercise the real Google SDK request builders, stopping at the auth transport. */
export function googleTransport() {
  const request = mock(async (_options: any): Promise<{ data: any }> => ({ data: {} }))
  const getAuthClient = mock(async () => ({ request }))
  return { request, auth: { getAuthClient }, getAuthClient }
}
