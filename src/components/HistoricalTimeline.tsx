import { useState } from 'react'
import { ArrowDownRight, CalendarDays } from 'lucide-react'
import { timeline } from '../content/modules'
export function HistoricalTimeline() {
  const [year, setYear] = useState(0)
  const event = timeline[year]
  return <section className="content-module"><div className="module-heading"><h2>A chronology of evidence</h2><span className="metadata">2024 — 2025</span></div>
    <p className="module-note">Editorial placeholders. Select a year to review the evidence still required.</p>
    <div className="timeline-tabs" role="tablist" aria-label="Historical year">{timeline.map((item, i) => <button role="tab" aria-selected={i === year} aria-controls="timeline-panel" id={'year-' + item.year} key={item.year} onClick={() => setYear(i)}><span className="timeline-dot" />{item.year}<ArrowDownRight size={18} /></button>)}</div>
    <div id="timeline-panel" role="tabpanel" aria-labelledby={'year-' + event.year} className="timeline-panel"><CalendarDays size={24} /><div><span className="metadata">SOURCE EVIDENCE PENDING</span><h3>{event.title}</h3><p>{event.description}</p><ul>{event.required.map(item => <li key={item}>{item}</li>)}</ul></div></div>
  </section>
}
