import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { demoOpportunities, pipelineStages, type PipelineStage } from '../content/modules'
import { zar } from '../lib/finance'
export function OpportunityPipeline() {
  const [rows, setRows] = useState(demoOpportunities)
  const [filter, setFilter] = useState('All stages')
  const visible = rows.filter(row => filter === 'All stages' || row.stage === filter)
  return <section className="content-module"><div className="module-heading"><h2>Opportunity register</h2><span className="metadata">SYNTHETIC EXAMPLES</span></div><p className="module-note">Edit stages to explore the workflow. Changes stay in this session and do not represent signed business.</p>
    <div className="module-toolbar"><label>Filter by stage<select value={filter} onChange={e => setFilter(e.target.value)}><option>All stages</option>{pipelineStages.map(stage => <option key={stage}>{stage}</option>)}</select></label><button className="text-button" onClick={() => { setRows(demoOpportunities); setFilter('All stages') }}><RotateCcw size={14} />Reset</button></div>
    <div className="table-scroll"><table className="data-table"><caption className="sr-only">Synthetic commercial opportunity examples</caption><thead><tr><th>Opportunity</th><th>Stage</th><th>Illustrative value</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}><td>{row.name}<small>{row.sector}</small></td><td><select aria-label={'Stage for ' + row.name} value={row.stage} onChange={e => setRows(rows.map(item => item.id === row.id ? { ...item, stage: e.target.value as PipelineStage } : item))}>{pipelineStages.map(stage => <option key={stage}>{stage}</option>)}</select></td><td className="numeric">{zar(row.value)}</td></tr>)}</tbody></table>{visible.length === 0 && <p className="empty-state">No demonstration opportunities at this stage.</p>}</div><p className="module-note">These prospective example values are excluded from the financial forecast. Stage names are editable in the content registry.</p>
  </section>
}
