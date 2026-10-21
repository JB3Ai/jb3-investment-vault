import {execFileSync} from 'node:child_process'
export function buildReference(root:string,readHead:()=>string=()=>execFileSync('git',['rev-parse','--verify','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()):string{
 try{const head=readHead();return /^[a-f0-9]{40}$/i.test(head)?head.slice(0,5).toLowerCase():'LOCAL'}catch{return 'LOCAL'}
}
