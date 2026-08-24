import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// dial() is pure param assembly over the Telnyx client — mock the client and
// the number lookup, then assert what would hit the wire.
async function makeConnector() {
  const container = new NodeContainer()
  const connector: any = container.feature('telnyxConnector', {
    phoneNumber: '+13125550100',
  })

  let captured: { connectionId: string; params: any } | null = null
  connector.getPhoneNumber = async () => ({
    id: 'num-1',
    connection_id: 'conn-1',
    connection_name: 'ai-assistant-abc123',
  })
  connector._getClient = async () => ({
    texml: {
      initiateAICall: async (connectionId: string, params: any) => {
        captured = { connectionId, params }
        return { data: { call_sid: 'test' } }
      },
    },
  })

  return { connector, params: () => captured }
}

describe('telnyxConnector.dial', () => {
  it('resolves the assistant from the number wiring and sends greeting/context as dynamic variables', async () => {
    const { connector, params } = await makeConnector()
    await connector.dial('+13125550000', {
      greeting: 'Hi Jon',
      context: 'Morning brief call.',
    })

    const sent = params()!
    expect(sent.connectionId).toBe('conn-1')
    expect(sent.params.AIAssistantId).toBe('assistant-abc123')
    expect(sent.params.To).toBe('+13125550000')
    expect(sent.params.From).toBe('+13125550100')
    expect(sent.params.AIAssistantDynamicVariables).toEqual({
      greeting_line: 'Hi Jon',
      call_context: 'Morning brief call.',
    })
  })

  it('passes answering-machine detection options through to TeXML', async () => {
    const { connector, params } = await makeConnector()
    await connector.dial('+13125550000', {
      machineDetection: 'DetectMessageEnd',
      detectionMode: 'Premium',
      machineDetectionTimeout: 15000,
      timeoutSeconds: 45,
    })

    const sent = params()!.params
    expect(sent.MachineDetection).toBe('DetectMessageEnd')
    expect(sent.DetectionMode).toBe('Premium')
    expect(sent.MachineDetectionTimeout).toBe(15000)
    expect(sent.timeout_seconds).toBe(45)
  })

  it('omits AMD keys entirely when not requested', async () => {
    const { connector, params } = await makeConnector()
    await connector.dial('+13125550000')

    const sent = params()!.params
    expect('MachineDetection' in sent).toBe(false)
    expect('DetectionMode' in sent).toBe(false)
    expect('AIAssistantDynamicVariables' in sent).toBe(false)
  })

  it('rejects non-E.164 numbers before touching the API', async () => {
    const { connector } = await makeConnector()
    await expect(connector.dial('312-555-0000')).rejects.toThrow('E.164')
  })
})
