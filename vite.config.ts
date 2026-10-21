import {buildReference} from './server/buildReference.ts'
import {presentationPreview} from './server/vitePresentation.ts'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { privateContentBoundary } from './content-migration/build-boundary.ts'
import { localDownloadGateway } from './server/viteGateway.ts'
import { privateLocalReview } from './server/localReview.ts'

export default defineConfig(({ command, mode }) => {
  const env = command === 'serve' ? loadEnv(mode, process.cwd(), '') : {}
  const ownerReview = command === 'serve' && mode === 'private-local'
  if (ownerReview && !process.env.JB3_PRIVATE_CONTENT_ROOT) throw new Error('Set JB3_PRIVATE_CONTENT_ROOT to the external private-content folder')
  return {
  define:{__VAULT_BUILD_REFERENCE__:JSON.stringify(command==='build'?buildReference(process.cwd()):'LOCAL')},
  plugins: [privateContentBoundary(process.cwd()), react(), tailwindcss(), ...(command==='serve' && mode==='presentation' && process.env.JB3_PRIVATE_CONTENT_ROOT ? [presentationPreview(process.env.JB3_PRIVATE_CONTENT_ROOT)] : []), ownerReview ? privateLocalReview(process.env.JB3_PRIVATE_CONTENT_ROOT!) : localDownloadGateway({
    SUPABASE_URL: env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  })],
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'], environment: 'node' },
  server: { host: '127.0.0.1', port: ownerReview ? 5174 : 5173, strictPort: true, fs:{strict:true,deny:['.env','.env.*','*.{crt,pem}','**/.git/**','**/docs/**']} },
}})
