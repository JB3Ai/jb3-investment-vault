import type { Plugin } from 'vite'
import { downloadGateway, type GatewayEnv } from './downloadGateway.ts'
/** Development only. Server secrets stay in Vite's Node process, never define/import.meta.env. */
export function localDownloadGateway(env: GatewayEnv): Plugin {
  return {
    name: 'vault-local-download-gateway',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/vault/')) return next()
        const controller = new AbortController()
        res.on('close', () => controller.abort())
        try {
          const headers = new Headers()
          for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value)
          const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers, signal: controller.signal })
          const result = await downloadGateway(request, env)
          res.statusCode = result.status
          result.headers.forEach((value, name) => res.setHeader(name, value))
          res.end(Buffer.from(await result.arrayBuffer()))
        } catch { res.writeHead(503, { 'Cache-Control': 'no-store' }); res.end() }
      })
    },
  }
}
