import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@/': new URL('./src/', import.meta.url).pathname,
      '@/node/': new URL('./src/node/', import.meta.url).pathname,
      '@/web/': new URL('./src/web/', import.meta.url).pathname,
    },
  },
})
