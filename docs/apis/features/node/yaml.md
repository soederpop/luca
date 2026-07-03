# YAML (features.yaml)

> Stability: `core`

The YAML feature provides utilities for parsing and stringifying YAML data. This feature wraps the js-yaml library to provide convenient methods for converting between YAML strings and JavaScript objects. It's automatically attached to Node containers for easy access. The API is two methods: `parse()` (YAML string → object) and `stringify()` (object → YAML string). The parser handles nested objects, arrays, numbers, and booleans automatically, and nulls serialize cleanly on the way back out. A parse → modify → stringify round-trip preserves data intact, which makes this the standard tool for reading a config file, mutating a value, and writing it back.

## Usage

```ts
container.feature('yaml')
```

## Methods

### stringify

Converts a JavaScript object to a YAML string. This method serializes JavaScript data structures into YAML format, which is human-readable and commonly used for configuration files. Deeply nested and mixed-type structures serialize cleanly — nulls, booleans, numbers, and nested arrays of objects all round-trip without special handling.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any` | ✓ | The data to convert to YAML format |

**Returns:** `string`

```ts
const config = {
 name: 'MyApp',
 version: '1.0.0',
 settings: {
   debug: true,
   ports: [3000, 3001]
 }
}

const yamlString = yaml.stringify(config)
console.log(yamlString)
// Output:
// name: MyApp
// version: 1.0.0
// settings:
//   debug: true
//   ports:
//     - 3000
//     - 3001
```



### parse

Parses a YAML string into a JavaScript object. This method deserializes YAML content into JavaScript data structures. It supports all standard YAML features including nested objects, arrays, and various data types.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `yamlStr` | `string` | ✓ | The YAML string to parse |

**Returns:** `T`

```ts
const yamlContent = `
 name: MyApp
 version: 1.0.0
 settings:
   debug: true
   ports:
     - 3000
     - 3001
`

// Parse with type inference
const config = yaml.parse(yamlContent)
console.log(config.name) // 'MyApp'

// Parse with explicit typing
interface AppConfig {
 name: string
 version: string
 settings: {
   debug: boolean
   ports: number[]
 }
}

const typedConfig = yaml.parse<AppConfig>(yamlContent)
console.log(typedConfig.settings.ports) // [3000, 3001]
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.yaml**

```ts
const yml = container.feature('yaml')

// Parse YAML string to object — nested objects, arrays, numbers,
// and booleans are all handled automatically.
const config = yml.parse(`
 name: my-app
 version: 2.1.0
 database:
   host: localhost
   port: 5432
 features:
   - auth
   - logging
`)
console.log(config.database.host) // 'localhost'
console.log(config.features)      // ['auth', 'logging']

// Convert an object back to a human-readable YAML string.
const output = yml.stringify({
 server: { host: '0.0.0.0', port: 3000 },
 cors: { origins: ['https://example.com'] },
})

// Round-trip: parse → modify → stringify preserves data intact.
const parsed = yml.parse('replicas: 3\nmemory: 256Mi\n')
parsed.replicas = 5
const updated = yml.stringify(parsed)
const reparsed = yml.parse(updated)
console.log(reparsed.replicas) // 5 — survives the cycle
```



**stringify**

```ts
const config = {
 name: 'MyApp',
 version: '1.0.0',
 settings: {
   debug: true,
   ports: [3000, 3001]
 }
}

const yamlString = yaml.stringify(config)
console.log(yamlString)
// Output:
// name: MyApp
// version: 1.0.0
// settings:
//   debug: true
//   ports:
//     - 3000
//     - 3001
```



**parse**

```ts
const yamlContent = `
 name: MyApp
 version: 1.0.0
 settings:
   debug: true
   ports:
     - 3000
     - 3001
`

// Parse with type inference
const config = yaml.parse(yamlContent)
console.log(config.name) // 'MyApp'

// Parse with explicit typing
interface AppConfig {
 name: string
 version: string
 settings: {
   debug: boolean
   ports: number[]
 }
}

const typedConfig = yaml.parse<AppConfig>(yamlContent)
console.log(typedConfig.settings.ports) // [3000, 3001]
```

