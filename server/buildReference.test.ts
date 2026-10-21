import{it,expect}from'vitest'
import{buildReference}from'./buildReference'
it('uses the actual build checkout commit and only its first five characters',()=>expect(buildReference('.',()=> '12345'+'f'.repeat(35))).toBe('12345'))
it('falls back to LOCAL for unavailable Git or invalid output without runtime lookup',()=>{expect(buildReference('.',()=>{throw Error('unavailable')})).toBe('LOCAL');expect(buildReference('.',()=> 'previous-value')).toBe('LOCAL')})
