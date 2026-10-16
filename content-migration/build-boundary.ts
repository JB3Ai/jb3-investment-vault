import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
const privateMarker = (text: string) => /JB3_(PRIVATE_CONTENT|APPROVED_MASTER|MASTER_INTAKE)_V1/.test(text)

export function assertPublicAssets(root: string) {
  const publicDir = path.join(root, 'public')
  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (!entry.isFile() || !['favicon.svg', '_headers'].includes(entry.name)) throw new Error('Unreviewed file in public assets; private source export blocked')
    if (privateMarker(readFileSync(path.join(publicDir, entry.name), 'utf8'))) throw new Error('Private manifest in public assets')
  }
}
export function assertPublicModule(root: string, id: string, source?: string) {
  const file = id.split('?')[0]
  const normalized = file.replaceAll('\\', '/')
  if (/\/(content-migration|private-content|sources|batches)\//.test(normalized)) throw new Error('Private ingestion module/source cannot enter the frontend graph')
  if (path.isAbsolute(file)) {
    const rel = path.relative(realpathSync(root), realpathSync(file))
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('External source cannot enter frontend build')
  }
  if (source && privateMarker(source)) throw new Error('Private manifest content cannot enter frontend build')
}
export function privateContentBoundary(root: string): Plugin {
  return {
    name: 'jb3-private-content-boundary', enforce: 'pre', apply: 'build',
    buildStart() { assertPublicAssets(root) },
    transform(code, id) {
      if (id.startsWith('\0') || id.includes('/node_modules/') || id.includes('\\node_modules\\')) return
      assertPublicModule(root, id, code)
    },
    generateBundle(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (/\.(pdf|docx?|xlsx?|eml|zip)$/i.test(asset.fileName)) throw new Error('Document binary export blocked')
        const content = asset.type === 'chunk' ? asset.code : String(asset.source)
        if (privateMarker(content)) throw new Error('Private batch export blocked')
      }
    },
  }
}
