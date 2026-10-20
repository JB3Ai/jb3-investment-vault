// Local-only verification. Never import into the frontend or Worker. No credential output.
import { loadEnvFile } from 'node:process'
import { readFileSync, readdirSync, realpathSync, lstatSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
try {
  loadEnvFile('.env.local')
  const root = realpathSync(process.cwd())
  const role = value => { try { return JSON.parse(Buffer.from(value.split('.')[1], 'base64url')).role } catch { return null } }
  const secrets = [...new Set(Object.entries(process.env).filter(([name, value]) => value && (/SUPABASE_(SECRET_KEY|SERVICE_ROLE_KEY)$/.test(name) || value.startsWith('sb_secret_') || value.startsWith('sbp_') || role(value) === 'service_role')).map(([,value]) => value))]
  if (!secrets.length) throw new Error('No configured credential available for comparison')
  const workerDir = process.argv[2] || 'tmp/release-readiness/worker'
  const groups = ['dist', 'public', workerDir]
  let files = 0, secretMatches = 0, privateMatches = 0
  function walk(dir, group) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir,e.name), info=lstatSync(file), real=realpathSync(file)
      if (info.isSymbolicLink() || path.relative(root,real).startsWith('..') || path.isAbsolute(path.relative(root,real))) throw new Error('External export path')
      if (e.isDirectory()) { walk(file,group); continue }
      const bytes=readFileSync(file); files++
      if (secrets.some(value => bytes.includes(Buffer.from(value)))) secretMatches++
      const text=bytes.toString('utf8')
      if (/JB3_(PRIVATE_CONTENT|APPROVED_MASTER|MASTER_INTAKE)_V1|JB3_Bruce_Vault_Master_Content|JB3_Bruce_Personal_Business_One_Pagers/.test(text)) privateMatches++
      if (group === 'public' && !['favicon.svg','_headers'].includes(e.name)) privateMatches++
      if (group === 'dist' && /SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(text)) secretMatches++
    }
  }
  for (const dir of groups) walk(path.resolve(dir),dir)
  // Inspect current nonignored files, staged blobs, and every locally reachable object.
  // Credential values never appear in Git arguments, logs, output or temporary files.
  const git=(args,input)=>execFileSync('git',['--no-optional-locks',...args],{input,windowsHide:true,stdio:['pipe','pipe','pipe'],maxBuffer:256*1024*1024})
  function sensitive(bytes) {
    if(secrets.some(value=>bytes.includes(Buffer.from(value))))return true
    const text=bytes.toString('utf8')
    for(const value of text.match(/sb_secret_[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)??[]) {
      if(role(value)==='service_role')return true
      if(/^(sb_secret_|sbp_)/.test(value)&&!/^sb_secret_(synthetic|fixture|test)|^sbp_(synthetic|fixture|test)/.test(value))return true
    }
    return false
  }
  let gitFiles=0,gitBlobs=0,gitSecretMatches=0
  const names=git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean)
  for(const name of new Set(names)) {
    if(!existsSync(name))continue
    const real=realpathSync(name)
    if(lstatSync(name).isSymbolicLink()||path.relative(root,real).startsWith('..'))throw new Error('External Git path')
    gitFiles++;if(sensitive(readFileSync(name)))gitSecretMatches++
  }
  const staged=git(['ls-files','--stage','-z']).toString().split('\0').filter(Boolean).map(line=>line.split(' ')[1])
  const history=git(['rev-list','--objects','--all']).toString().trim().split('\n').filter(Boolean).map(line=>line.split(' ')[0])
  const ids=[...new Set([...staged,...history])]
  const data=git(['cat-file','--batch'],ids.join('\n')+'\n')
  let offset=0
  while(offset<data.length) {
    const end=data.indexOf(10,offset);if(end<0)throw new Error('Incomplete Git object')
    const header=data.subarray(offset,end).toString().split(' '),size=Number(header[2]);if(!Number.isSafeInteger(size)||size<0)throw new Error('Unreadable Git object')
    const start=end+1,finish=start+size;if(finish>=data.length)throw new Error('Truncated Git object')
    if(header[1]==='blob'){gitBlobs++;if(sensitive(data.subarray(start,finish)))gitSecretMatches++}
    offset=finish+1
  }
  const passed = secretMatches === 0 && privateMatches === 0 && gitSecretMatches === 0 && gitBlobs > 0
  console.log(JSON.stringify({check:'release-export-boundary',passed,files,secretMatches,privateMatches,gitFiles,gitBlobs,gitSecretMatches}))
  process.exitCode = passed ? 0 : 1
} catch {
  console.log(JSON.stringify({check:'release-export-boundary',passed:false,error:'scan-incomplete'}))
  process.exitCode = 1
}
