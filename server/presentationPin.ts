import type {IncomingMessage} from 'node:http'
/** Loopback presentation control only. Does not create a session or grant document access. */
export class PresentationPin {
 private failures=0;private until=0
 constructor(private pin=process.env.JB3_LOCAL_PRESENTATION_PIN??'2323',private now=()=>Date.now()){}
 check(value:unknown){
  const now=this.now()
  if(now<this.until)return {status:429,retryAfter:Math.ceil((this.until-now)/1000)}
  if(this.until){this.until=0;this.failures=0}
  if(typeof value!=='string'||!/^\d{4}$/.test(value)||value!==this.pin){this.failures++;if(this.failures>=5)this.until=now+30000;return {status:this.until?429:403,retryAfter:this.until?30:0}}
  this.failures=0;return {status:200,retryAfter:0}
 }
}
export async function readPresentationPin(request:IncomingMessage){
 if(!request.headers['content-type']?.startsWith('application/json'))throw Error('JSON required')
 let size=0,body='';for await(const chunk of request){size+=Buffer.byteLength(chunk);if(size>128)throw Error('PIN request too large');body+=chunk}
 const value=JSON.parse(body);if(!value||Object.keys(value).join(',')!=='pin')throw Error('Invalid PIN request');return value.pin as unknown
}
