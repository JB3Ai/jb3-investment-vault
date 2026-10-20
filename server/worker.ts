import { presentationRelease, type PresentationEnv } from './presentationRelease'
import { downloadGateway, type GatewayEnv } from './downloadGateway'
interface Env extends GatewayEnv, PresentationEnv { ASSETS: { fetch(request: Request): Promise<Response> } }
export default {
  async fetch(request: Request, env: Env) {
    if (new URL(request.url).pathname.startsWith('/api/vault/presentation/')) return presentationRelease(request, env)
    if (new URL(request.url).pathname.startsWith('/api/vault/')) return downloadGateway(request, env)
    return env.ASSETS.fetch(request)
  },
}
