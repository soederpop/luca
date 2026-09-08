import { requireEnv, describeWithRequirements } from './helpers'
import { NodeContainer } from '../src/node/container'
import { InternetMail } from '../src/node/features/internet-mail'

/**
 * Live IMAP/SMTP smoke test against a real mailbox. Nothing in `bun test`
 * touches the network — this is the only place the real protocol path runs,
 * so run it after any imapflow/nodemailer upgrade.
 *
 *   INTERNET_MAIL_LIVE_ADDRESS=you@me.com \
 *   INTERNET_MAIL_LIVE_PASSWORD=<app-specific password> \
 *   bun run test:integration test-integration/internet-mail.test.ts
 *
 * The second test SENDS a message — to the configured address itself, never
 * anywhere else, since that address is the only allowlisted recipient.
 */
const address = requireEnv('INTERNET_MAIL_LIVE_ADDRESS')
const password = requireEnv('INTERNET_MAIL_LIVE_PASSWORD')
const provider = process.env.INTERNET_MAIL_LIVE_PROVIDER || 'icloud'

describeWithRequirements('internetMail live (real IMAP + SMTP)', [address, password], () => {
  const container = new NodeContainer()

  const createMail = () => new InternetMail(
    {
      provider,
      address: address.value,
      password: password.value,
      outboundEnabled: true,
      // Self-addressed only: the account is both the sole trusted sender and
      // the sole approved recipient, so a bug cannot mail a third party.
      trustedSenders: [address.value],
      approvedRecipients: [address.value],
      cursorStore: `internet-mail-live-${container.utils.uuid().slice(0, 8)}`,
      cursorScope: 'tmp',
    } as any,
    { container } as any,
  )

  it('verifies IMAP and SMTP logins independently', async () => {
    const report = await createMail().verify()
    expect(report.config.ok).toBe(true)
    expect(report.secret.ok).toBe(true)
    expect(report.imap.ok, report.imap.detail).toBe(true)
    expect(report.smtp.ok, report.smtp.detail).toBe(true)
    expect(report.ok).toBe(true)
  }, 60_000)

  it('reads the inbox without touching unread state or the cursor', async () => {
    const mail = createMail()
    const summaries = await mail.checkInbox({ limit: 3 })
    expect(Array.isArray(summaries)).toBe(true)
    // Reads never baseline — that is poll()'s job alone
    expect(await mail.readCursor()).toBeNull()
  }, 60_000)

  it('sends a self-addressed message and finds it by subject', async () => {
    const mail = createMail()
    const marker = `luca-internet-mail-smoke-${Date.now()}`
    const result = await mail.sendMessage({
      to: address.value,
      subject: marker,
      text: 'internetMail live smoke test — safe to delete',
    })
    expect(result.accepted).toEqual([address.value.toLowerCase()])

    // Delivery to self usually lands within a minute
    let found: any[] = []
    for (let attempt = 0; attempt < 12 && !found.length; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5_000))
      found = await mail.searchMessages({ subject: marker }, { limit: 5 })
    }
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].subject).toBe(marker)

    const full = await mail.readMessage(found[0].id)
    expect(full.text).toContain('safe to delete')
    expect(full.validation?.auth).toBeDefined()

    await mail.stop()
    await mail.cursorStore.delete()
  }, 180_000)
})
