// Runtime entry backing the synthesized node_modules/zod shim in consumer
// bundles, so consumer helpers share the exact zod instance the runtime uses.
export * from 'zod'
import { z } from 'zod'
export default z
