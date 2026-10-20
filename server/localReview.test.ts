import { describe, expect, it } from 'vitest'
import { localReviewAllowed } from './localReview'

const request = (headers: Record<string, string> = {}, remoteAddress = '127.0.0.1') => ({ headers: { host: '127.0.0.1:5174', 'x-vault-local-review': '1', ...headers }, socket: { remoteAddress } })
describe('local owner review boundary', () => {
  it('allows explicit loopback owner requests', () => expect(localReviewAllowed(request())).toBe(true))
  it('allows same-origin browser requests', () => expect(localReviewAllowed(request({ origin: 'http://127.0.0.1:5174', 'sec-fetch-site': 'same-origin' }))).toBe(true))
  it('denies requests without the non-simple review header', () => expect(localReviewAllowed(request({ 'x-vault-local-review': '' }))).toBe(false))
  it('denies remote clients', () => expect(localReviewAllowed(request({}, '192.168.1.3'))).toBe(false))
  it('denies DNS-rebinding hosts', () => expect(localReviewAllowed(request({ host: 'review.example.com:5174' }))).toBe(false))
  it('denies another origin including another local port', () => expect(localReviewAllowed(request({ origin: 'http://127.0.0.1:5173' }))).toBe(false))
  it('denies cross-site requests', () => expect(localReviewAllowed(request({ 'sec-fetch-site': 'cross-site' }))).toBe(false))
  it('rejects ambiguous headers', () => expect(localReviewAllowed({ ...request(), headers: { ...request().headers, 'x-vault-local-review': ['1', '1'] } })).toBe(false))
})
