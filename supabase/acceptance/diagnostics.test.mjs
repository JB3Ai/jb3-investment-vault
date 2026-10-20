import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeObservation, assertionRecord } from './diagnostics.mjs'
import { publicRestHeaders } from './focused-revocation.mjs'
test('omits credentials, response bodies, paths and identities',()=>{
  const secret='sb_secret_synthetic_do_not_log'
  const safe=safeObservation({status:403,rows:0,Authorization:secret,body:secret,email:'synthetic@example.invalid',path:'private/path',jwt:secret})
  assert.deepEqual(safe,{status:403,rows:0})
  assert.equal(JSON.stringify(safe).includes(secret),false)
})
test('does not accept arbitrary strings under allowed keys',()=>{
  assert.deepEqual(safeObservation({errorCode:'sb_secret_synthetic',serverNow:'private text',status:'403',bytesReturned:'token'}),{errorCode:'unknown'})
})
test('preserves expected and actual status, expiry and counts',()=>{
  const record=assertionRecord('BRUCE_PRIVATE.expiry.rest',false,{rows:0},{status:200,rows:1,expired:true,expiresAt:'2026-10-17T00:00:00.000Z'})
  assert.equal(record.result,'FAIL'); assert.equal(record.expected.rows,0); assert.equal(record.actual.rows,1)
})
test('rejects credential-shaped assertion names',()=>{
  assert.throws(()=>assertionRecord('sb_secret_synthetic',true,{},{}))
})
test('raw REST probes explicitly select public on a shared project',()=>{
  const headers=publicRestHeaders('synthetic-public-key','synthetic-user-token')
  assert.equal(headers['Accept-Profile'],'public')
  assert.deepEqual(safeObservation(headers),{})
})
