import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { assertPublicModule } from '../content-migration/build-boundary'
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sources(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [path.join(dir, e.name)] : [])
}
describe('protected download export boundary', () => {
  it('rejects server code and credential references in the browser graph', () => {
    expect(() => assertPublicModule(process.cwd(), path.resolve('server/downloadGateway.ts'))).toThrow(/server/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('supabase/acceptance/gateway-probes.ts'))).toThrow(/server/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('scripts/inspect-cloudflare.mjs'))).toThrow(/server/)
    expect(() => assertPublicModule(process.cwd(), path.resolve('src/main.tsx'), 'env.SUPABASE_SECRET_KEY')).toThrow(/credential/)
  })
  it('has no runtime browser Storage signing/download API or secret reference', () => {
    for (const file of sources('src')) {
      const code = readFileSync(file, 'utf8')
      expect(code, file).not.toMatch(/\.storage\b|createSignedUrl|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|\/storage\/v1\//)
    }
  })
  it('routes the gateway before static assets without declaring any secret value', () => {
    const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'))
    expect(config.assets.run_worker_first).toEqual(['/api/vault/*'])
    expect(config.main).toBe('server/worker.ts')
    expect(config.account_id).toBe('18ab41342b712e6d2a83057299705832')
    expect(config.workers_dev).toBe(true)
    expect(config.preview_urls).toBe(false)
    expect(config.cache).toEqual({ enabled: false, cross_version_cache: false })
    expect(config.routes).toBeUndefined()
    expect(config.vars).toBeUndefined()
  })
})
