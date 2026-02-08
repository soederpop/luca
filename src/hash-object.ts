/**
 * Browser-compatible object hashing. Produces a deterministic string signature
 * for any JavaScript value, suitable for use as a cache key or identity check.
 *
 * Replaces the `object-hash` npm package which has Node.js-specific dependencies.
 */

function sortedEntries(obj: Record<string, any>): [string, any][] {
  return Object.keys(obj).sort().map((k) => [k, obj[k]])
}

function serialize(value: any, seen: Set<any>): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'boolean' || type === 'number' || type === 'bigint') {
    return `${type}:${value}`
  }

  if (type === 'string') {
    return `string:${value.length}:${value}`
  }

  if (type === 'symbol') {
    return `symbol:${value.toString()}`
  }

  if (type === 'function') {
    return `function:${value.name || 'anonymous'}`
  }

  // Circular reference guard
  if (seen.has(value)) return 'circular'
  seen.add(value)

  if (value instanceof Date) {
    return `date:${value.toISOString()}`
  }

  if (value instanceof RegExp) {
    return `regexp:${value.toString()}`
  }

  if (value instanceof Error) {
    return `error:${value.name}:${value.message}`
  }

  if (value instanceof Set) {
    const items = Array.from(value).map((v) => serialize(v, seen)).sort()
    return `set:[${items.join(',')}]`
  }

  if (value instanceof Map) {
    const entries = Array.from(value.entries())
      .map(([k, v]) => `${serialize(k, seen)}=>${serialize(v, seen)}`)
      .sort()
    return `map:{${entries.join(',')}}`
  }

  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    const buf = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array((value as any).buffer, (value as any).byteOffset, (value as any).byteLength)
    return `buffer:${Array.from(buf).join(',')}`
  }

  if (Array.isArray(value)) {
    const items = value.map((v) => serialize(v, seen))
    return `array:[${items.join(',')}]`
  }

  // Plain objects — sort keys for determinism
  if (type === 'object') {
    const entries = sortedEntries(value)
      .map(([k, v]) => `${k}:${serialize(v, seen)}`)
    return `object:{${entries.join(',')}}`
  }

  return `unknown:${String(value)}`
}

/**
 * Simple non-crypto hash (djb2 variant) that works in all JS environments.
 */
function djb2(str: string): string {
  let h1 = 0x811c9dc5 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h1 ^= str.charCodeAt(i)
    h1 = (h1 * 0x01000193) >>> 0 // FNV prime, keep as uint32
  }
  return h1.toString(36)
}

export default function hashObject(value: any): string {
  const serialized = serialize(value, new Set())
  return djb2(serialized)
}
