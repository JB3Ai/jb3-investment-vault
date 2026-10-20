import { expect, it } from 'vitest'
import { presentationSections } from './presentationSections'
it('retains eleven chapters without private or synthetic records', () => {
 expect(presentationSections.map(section => section.number)).toEqual([1,2,3,4,5,6,7,8,9,10,11])
 for(const section of presentationSections){expect(section.verification).toBe('PENDING');expect(section.overview).toBe('');for(const key of ['narrative','evidence','images','documents'] as const)expect(section[key]).toEqual([])}
})
