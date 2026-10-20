import {readFile} from 'node:fs/promises'
import path from 'node:path'
import type {Plugin} from 'vite'
import {presentationRelease} from './presentationRelease'
// Loopback development transport for the same deployment projection and gateway.
export function presentationPreview(root:string):Plugin{return {name:'presentation-release-preview',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 if(!req.url?.startsWith('/api/vault/presentation/'))return next()
 try{
 const ledger=JSON.parse(await readFile(path.join(root,'presentation-release/deployment.private.json'),'utf8'))
 const store={async get(key:string,type:'text'|'arrayBuffer'){
  const file=key===ledger.release+'/content'?ledger.content:ledger.uploads.find((a:{key:string})=>a.key===key)?.file
  if(!file)return null
  const b=await readFile(file);return type==='text'?b.toString('utf8'):b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)
 }}
 const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:new Headers(Object.entries(req.headers).flatMap(([k,v])=>typeof v==='string'?[[k,v]]:[]))})
 const result=await presentationRelease(request,{VAULT_PRESENTATION:store as never,VAULT_PRESENTATION_RELEASE:ledger.release})
 res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await result.arrayBuffer()))
 }catch{res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end()}
 })}}}
