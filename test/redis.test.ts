import { beforeEach, afterEach, describe, expect, it, spyOn, mock, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
let c: NodeContainer
let redis: ReturnType<typeof create>
let connect: Mock<any>
let command: Mock<(command: { name: string; args: string[] }) => Promise<any>>
const create = (c: NodeContainer, prefix = 'app') => c.feature('redis', { lazyConnect: true, prefix })
beforeEach(() => {
  c = new NodeContainer(); redis = create(c)
  const prototype = Object.getPrototypeOf(redis.client)
  connect = spyOn(prototype, 'connect').mockResolvedValue(undefined)
  command = spyOn(prototype, 'sendCommand').mockResolvedValue('OK')
})
afterEach(async () => { await redis.close(); connect.mockRestore(); command.mockRestore() })
const commands = () => command.mock.calls.map(([cmd]) => [cmd.name, ...cmd.args])

describe('Redis operations at the command transport', () => {
  it('prefixes keys and preserves TTL and values', async () => {
    await redis.set('plain', 'a b'); await redis.set('expiring', 'value', 60)
    expect(commands()).toEqual([['set', 'app:plain', 'a b'], ['set', 'app:expiring', 'value', 'EX', '60']])
  })
  it('returns missing values and delete counts', async () => {
    command.mockResolvedValueOnce(null).mockResolvedValueOnce(2)
    expect(await redis.get('missing')).toBeNull()
    expect(await redis.del('a', 'b')).toBe(2)
    expect(commands()).toEqual([['get', 'app:missing'], ['del', 'app:a', 'app:b']])
  })
  it.each([0, 1])('maps integer result %i to exists and expire booleans', async (value) => {
    command.mockResolvedValue(value)
    expect(await redis.exists('key')).toBe(value === 1)
    expect(await redis.expire('key', 30)).toBe(value === 1)
    expect(commands()).toEqual([['exists', 'app:key'], ['expire', 'app:key', '30']])
  })
  it('strips only its own namespace from matched keys', async () => {
    command.mockResolvedValue(['app:a', 'app:nested:b', 'other:c'])
    expect(await redis.keys('a*')).toEqual(['a', 'nested:b', 'other:c'])
    expect(commands()).toEqual([['keys', 'app:a*']])
  })
  it('leaves unprefixed keys unchanged', async () => {
    const plain = create(c, '')
    try {
      command.mockResolvedValue(['a'])
      expect(await plain.keys()).toEqual(['a'])
      expect(commands()).toEqual([['keys', '*']])
    } finally { await plain.close() }
  })
  it('serializes structured JSON and parses values without losing nulls or numbers', async () => {
    const data = { count: 0, enabled: false, value: null, items: ['a'] }
    await redis.setJSON('json', data, 10)
    expect(commands()[0]).toEqual(['set', 'app:json', JSON.stringify(data), 'EX', '10'])
    command.mockResolvedValueOnce(JSON.stringify(data)).mockResolvedValueOnce(null).mockResolvedValueOnce('invalid')
    expect(await redis.getJSON<typeof data>('json')).toEqual(data)
    expect(await redis.getJSON('missing')).toBeNull()
    await expect(redis.getJSON('invalid')).rejects.toThrow()
  })
  it('handles hash fields and missing hash values', async () => {
    await redis.hset('user', { name: 'A', role: 'dev' })
    command.mockResolvedValueOnce({ name: 'A' }).mockResolvedValueOnce(null)
    expect(await redis.hgetall('user')).toEqual({ name: 'A' })
    expect(await redis.hget('user', 'missing')).toBeNull()
    expect(commands()).toEqual([['hset', 'app:user', 'name', 'A', 'role', 'dev'], ['hgetall', 'app:user'], ['hget', 'app:user', 'missing']])
  })
  it('publishes on the original channel without a key prefix', async () => {
    command.mockResolvedValue(3)
    expect(await redis.publish('events', 'hello')).toBe(3)
    expect(commands()).toEqual([['publish', 'events', 'hello']])
  })
  it('tracks connection events and forwards errors', () => {
    const failed = mock(() => {}); redis.on('error', failed)
    redis.client.emit('connect'); expect(redis.state.get('connected')).toBe(true)
    redis.client.emit('error', new Error('socket error'))
    expect(failed).toHaveBeenCalledWith('socket error')
    expect(redis.state.get('lastError')).toBe('socket error')
    redis.client.emit('close'); expect(redis.state.get('connected')).toBe(false)
  })
  it('ping and ensureConnected handle success and server rejection', async () => {
    expect(await redis.ping()).toBe(true)
    expect(await redis.ensureConnected()).toBe(redis)
    command.mockRejectedValue(new Error('offline'))
    expect(await redis.ping()).toBe(false)
    await expect(redis.ensureConnected(1)).rejects.toThrow('did not respond')
  })
  it('subscribes without duplicating handlers or channel state', async () => {
    const received = mock(() => {}); const event = mock(() => {}); redis.on('message', event)
    await redis.subscribe(['a', 'b'], received); await redis.subscribe('a', received)
    expect(redis.state.get('subscribedChannels')).toEqual(['a', 'b'])
    redis.subscriber!.emit('message', 'a', 'hello')
    expect(received).toHaveBeenCalledTimes(1)
    expect(received).toHaveBeenCalledWith('a', 'hello')
    expect(event).toHaveBeenCalledWith('a', 'hello')
    expect(connect).toHaveBeenCalledTimes(1)
  })
  it('does not claim a subscriber connection before its connect event', async () => {
    await redis.subscribe('a')
    expect(redis.state.get('subscriberConnected')).toBe(false)
    redis.subscriber!.emit('connect'); expect(redis.state.get('subscriberConnected')).toBe(true)
    redis.subscriber!.emit('close'); expect(redis.state.get('subscriberConnected')).toBe(false)
  })
  it('removes handlers and state when unsubscribing selected channels', async () => {
    const received = mock(() => {}); const unsubscribed = mock(() => {}); redis.on('unsubscribed', unsubscribed)
    await redis.subscribe(['a', 'b'], received); await redis.unsubscribe('a')
    redis.subscriber!.emit('message', 'a', 'ignored')
    expect(received).not.toHaveBeenCalled()
    expect(redis.state.get('subscribedChannels')).toEqual(['b'])
    expect(unsubscribed).toHaveBeenCalledWith('a')
  })
  it('unsubscribe with no channels removes all subscriptions and handlers', async () => {
    const received = mock(() => {})
    await redis.subscribe(['a', 'b'], received); await redis.unsubscribe()
    expect(redis.state.get('subscribedChannels')).toEqual([])
    redis.subscriber!.emit('message', 'b', 'ignored')
    expect(received).not.toHaveBeenCalled()
  })
  it('unsubscribe without a subscriber is a no-op and close resets lifecycle state', async () => {
    await redis.unsubscribe('unused'); expect(command).not.toHaveBeenCalled()
    await redis.subscribe('a')
    const closed = mock(() => {}); redis.on('closed', closed)
    expect(await redis.close()).toBe(redis)
    expect(redis.subscriber).toBeNull()
    expect(redis.state.get('subscribedChannels')).toEqual([])
    expect(redis.state.get('connected')).toBe(false)
    expect(redis.state.get('subscriberConnected')).toBe(false)
    expect(closed).toHaveBeenCalledTimes(1)
  })
  it('does not publish subscription success when Redis rejects it', async () => {
    command.mockRejectedValue(new Error('subscribe denied'))
    await expect(redis.subscribe('a')).rejects.toThrow('subscribe denied')
    expect(redis.state.get('subscribedChannels')).toEqual([])
  })
  describe('local Docker reuse', () => {
    let list: Mock<any>
    let start: Mock<any>
    let run: Mock<any>
    let enable: Mock<any>
    beforeEach(() => {
      const docker = c.feature('docker')
      const proto = Object.getPrototypeOf(docker)
      enable = spyOn(proto, 'enable').mockResolvedValue(docker)
      list = spyOn(proto, 'listContainers').mockResolvedValue([])
      start = spyOn(proto, 'startContainer').mockResolvedValue(undefined)
      run = spyOn(proto, 'runContainer').mockResolvedValue('created')
    })
    afterEach(() => { list.mockRestore(); start.mockRestore(); run.mockRestore(); enable.mockRestore() })
    it('reuses the running named container returned by the Docker feature', async () => {
      list.mockResolvedValue([{ id: 'existing', name: 'luca-redis', status: 'Up 10 minutes' }])
      expect(await redis.ensureLocalDocker()).toBe('existing')
      expect(start).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled()
    })
    it('starts an existing stopped container instead of creating a duplicate', async () => {
      list.mockResolvedValue([{ id: 'existing', name: 'custom', status: 'Exited (0)' }])
      expect(await redis.ensureLocalDocker({ name: 'custom' })).toBe('existing')
      expect(start).toHaveBeenCalledWith('custom'); expect(run).not.toHaveBeenCalled()
    })
    it('creates a missing service with the requested port and image', async () => {
      expect(await redis.ensureLocalDocker({ name: 'custom', port: 6380, image: 'redis:7' })).toBe('created')
      expect(run).toHaveBeenCalledWith('redis:7', { name: 'custom', ports: ['6380:6379'], detach: true, restart: 'unless-stopped' })
    })
  })

})
