import { describe, expect, it } from 'vitest'
import { demoSections } from '../content/registry'
import { createInvestorIntake, investorSectionRequests } from '../../content-migration/investor-intake'
import { inspectPhase2 } from '../../content-migration/phase2'

describe('investor source intake without presentation or disclosure changes', () => {
  it('preserves the live registry while preparing all eleven exact section slots', () => {
    const before = JSON.stringify(demoSections)
    const intake = createInvestorIntake(demoSections)
    expect(intake.placeholders.map(s => [s.sectionId, s.number, s.title])).toEqual(demoSections.map(s => [s.id, s.number, s.title]))
    expect(JSON.stringify(demoSections)).toBe(before)
    expect(intake.placeholders.every(s => s.classification === 'awaiting-verification' && s.disclosure === 'PRIVATE' && s.approved === false)).toBe(true)
  })
  it('does not manufacture narratives, photographs, documents, opportunities or financial amounts', () => {
    const intake = createInvestorIntake(demoSections)
    for (const slot of intake.placeholders) {
      expect([slot.narratives, slot.photographs, slot.pdfs, slot.opportunities, slot.financialFigures]).toEqual([null, null, null, null, null])
    }
    expect(inspectPhase2(intake.manifest).verifiedNarrativeIds).toEqual([])
    expect(intake.manifest.accessEnabled).toBe(false)
  })
  it('retains private custody requirements for family and legal topics', () => {
    const topics = investorSectionRequests.flatMap(s => [...s.topics])
    for (const id of ['family-responsibilities', 'micore-review', 'family-property-review']) {
      expect(topics.find(t => t.id === id)?.disclosure).toBe('PRIVATE')
    }
    expect(topics.find(t => t.id === 'imed-laboratory-build')?.requestedTopic).toContain('awaiting verification')
  })
  it('rejects incomplete or reordered registries instead of attaching content to the wrong section', () => {
    expect(() => createInvestorIntake(demoSections.slice(1))).toThrow()
    expect(() => createInvestorIntake([...demoSections].reverse())).toThrow()
  })
})
