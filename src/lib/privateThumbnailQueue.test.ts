import {describe,it,expect} from 'vitest'
import {createPrivateThumbnailQueue} from './privateThumbnailQueue'
const deferred=()=>{let resolve!:(value:string)=>void;const promise=new Promise<string>(r=>resolve=r);return {promise,resolve}}
describe('Private cover loading',()=>{
 it('bounds active validation and skips stale queued covers without caching',async()=>{
  const queue=createPrivateThumbnailQueue(1),first=deferred(),started:string[]=[],a=new AbortController(),b=new AbortController(),c=new AbortController()
  const one=queue(()=>{started.push('one');return first.promise},a.signal).catch(()=> 'aborted')
  const two=queue(async()=>{started.push('two');return 'two'},b.signal).catch(()=> 'aborted')
  const three=queue(async()=>{started.push('three');return 'three'},c.signal)
  await Promise.resolve();a.abort();b.abort();await Promise.resolve()
  expect(started).toEqual(['one'])
  first.resolve('private cover');expect(await one).toBe('aborted');expect(await two).toBe('aborted');expect(await three).toBe('three');expect(started).toEqual(['one','three'])
  expect(await queue(async()=>{started.push('three');return 'fresh authorisation'},c.signal)).toBe('fresh authorisation');expect(started).toEqual(['one','three','three'])
 })
 it('releases a failed slot and preserves failure rather than serving stale data',async()=>{
  const queue=createPrivateThumbnailQueue(1),signal=new AbortController().signal
  const failed=queue(async()=>{throw Error('denied')},signal)
  const next=queue(async()=> 'new response',signal)
  await expect(failed).rejects.toThrow('denied');expect(await next).toBe('new response')
 })
})
