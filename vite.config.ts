import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { privateContentBoundary } from './content-migration/build-boundary.ts'

export default defineConfig({
  plugins: [privateContentBoundary(process.cwd()), react(), tailwindcss()],
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  server: { port: 5173, strictPort: true },
})
