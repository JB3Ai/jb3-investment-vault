import {describe,it,expect} from 'vitest'
import {Readable} from 'node:stream'
import type {IncomingMessage} from 'node:http'
import {PresentationPin,readPresentationPin} from './presentationPin'
describe('presentation PIN without authentication privileges',()=>{
 it('accepts the configured local PIN without returning credentials or sessions',()=>{const pin=new PresentationPin('9876');expect(pin.check('9876')).toEqual({status:200,retryAfter:0});expect(pin.check('1234').status).toBe(403)})
 it('throttles after five failures, including correct attempts during the pause',()=>{let time=1000;const pin=new PresentationPin('9876',()=>time);for(let n=0;n<4;n++)expect(pin.check('0000').status).toBe(403);expect(pin.check('0000')).toEqual({status:429,retryAfter:30});expect(pin.check('9876').status).toBe(429);time+=30001;expect(pin.check('9876').status).toBe(200)})
 it.each([null,1234,'12','12345','12ab',' 9876'])('rejects malformed input without creating a session: %s',value=>expect(new PresentationPin('9876').check(value).status).toBe(403))
 it('requires a small exact JSON request',async()=>{const request=(body:string,content='application/json')=>Object.assign(Readable.from([body]),{headers:{'content-type':content}}) as IncomingMessage;expect(await readPresentationPin(request('{"pin":"9876"}'))).toBe('9876');await expect(readPresentationPin(request('{"pin":"9876","role":"admin"}'))).rejects.toThrow();await expect(readPresentationPin(request('a'.repeat(200)))).rejects.toThrow();await expect(readPresentationPin(request('9876','text/plain'))).rejects.toThrow()})
})
