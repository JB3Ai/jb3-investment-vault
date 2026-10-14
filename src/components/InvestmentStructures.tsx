import { useState } from 'react'
import { structures } from '../content/modules'
export function InvestmentStructures() {
  const [selected, setSelected] = useState(0)
  const structure = structures[selected]
  return <section className="content-module"><div className="module-heading"><h2>Three frameworks for discussion</h2></div><p className="module-note">Illustrative comparisons. No investment terms or commitments are agreed.</p><div className="structure-tabs" role="tablist" aria-label="Investment structure">{structures.map((item, index) => <button key={item.name} id={'structure-' + index} role="tab" aria-selected={index === selected} aria-controls="structure-panel" onClick={() => setSelected(index)}><span className="mono">0{index + 1}</span>{item.name}</button>)}</div><div className="structure-panel" id="structure-panel" role="tabpanel" aria-labelledby={'structure-' + selected}><h3>{structure.name}</h3><p>{structure.description}</p><ul>{structure.terms.map(term => <li key={term}>{term}</li>)}</ul><p className="module-note">{structure.consideration}</p></div></section>
}
