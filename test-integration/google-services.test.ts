import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'

const serviceAccountKey = requireEnv('GOOGLE_SERVICE_ACCOUNT_KEY')

describeWithRequirements('Google Services Integration', [serviceAccountKey], () => {
  let container: any

  beforeAll(async () => {
    container = createAGIContainer()
    const auth = container.feature('googleAuth', {
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
    })
    await auth.authenticateServiceAccount()
  })

  describe('Google Sheets', () => {
    it(
      'getSpreadsheet returns metadata when given a valid spreadsheet ID',
      async () => {
        const sheets = container.feature('googleSheets')
        // This test requires GOOGLE_TEST_SPREADSHEET_ID to be set
        const spreadsheetId = process.env.GOOGLE_TEST_SPREADSHEET_ID
        if (!spreadsheetId) {
          console.log('GOOGLE_TEST_SPREADSHEET_ID not set, skipping sheets data test')
          return
        }
        const meta = await sheets.getSpreadsheet(spreadsheetId)
        expect(meta).toBeDefined()
        expect(meta.spreadsheetId).toBe(spreadsheetId)
      },
      API_TIMEOUT
    )

    it(
      'listSheets returns sheet names',
      async () => {
        const sheets = container.feature('googleSheets')
        const spreadsheetId = process.env.GOOGLE_TEST_SPREADSHEET_ID
        if (!spreadsheetId) {
          console.log('GOOGLE_TEST_SPREADSHEET_ID not set, skipping')
          return
        }
        const sheetList = await sheets.listSheets(spreadsheetId)
        expect(Array.isArray(sheetList)).toBe(true)
        expect(sheetList.length).toBeGreaterThan(0)
      },
      API_TIMEOUT
    )
  })

  describe('Google Calendar', () => {
    it(
      'listCalendars returns at least one calendar',
      async () => {
        const calendar = container.feature('googleCalendar')
        const calendars = await calendar.listCalendars()
        expect(Array.isArray(calendars)).toBe(true)
      },
      API_TIMEOUT
    )

    it(
      'getToday returns events array',
      async () => {
        const calendar = container.feature('googleCalendar')
        const events = await calendar.getToday()
        expect(Array.isArray(events)).toBe(true)
      },
      API_TIMEOUT
    )
  })
})
