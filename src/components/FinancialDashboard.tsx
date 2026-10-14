import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { forecast, initialAssumptions, zar, type Assumptions } from '../lib/finance'
export function FinancialDashboard() {
  const [values, setValues] = useState<Assumptions>(initialAssumptions)
  const rows = useMemo(() => forecast(values), [values])
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0)
  const totalCosts = rows.reduce((sum, row) => sum + row.costs, 0)
  const max = Math.max(...rows.map(row => row.revenue), values.monthlyCosts, 1)
  const controls: { key: keyof Assumptions; label: string; min: number; max: number; step: number; unit: string }[] = [
    { key: 'monthlyRevenue', label: 'Starting monthly revenue', min: 0, max: 1000000, step: 10000, unit: 'ZAR' },
    { key: 'monthlyCosts', label: 'Monthly operating costs', min: 0, max: 1000000, step: 10000, unit: 'ZAR' },
    { key: 'growthPercent', label: 'Monthly revenue growth', min: 0, max: 20, step: .5, unit: '%' },
    { key: 'openingCash', label: 'Opening cash', min: 0, max: 5000000, step: 50000, unit: 'ZAR' },
  ]
  return <section className="content-module financial-dashboard"><div className="module-heading"><h2>A model, with the assumptions visible.</h2><span className="metadata">HYPOTHETICAL ONLY</span></div>
    <div className="income-categories"><div><span>Confirmed income</span><strong>Not supplied</strong><small>No verified actuals loaded</small></div><div><span>Prospective opportunities</span><strong>Excluded</strong><small>Pipeline is separate from this model</small></div><div><span>Forecast basis</span><strong>Illustrative</strong><small>No investment returns represented</small></div></div>
    <div className="financial-controls">{controls.map(control => <label key={control.key} htmlFor={control.key}><span>{control.label}<output htmlFor={control.key}>{control.unit === 'ZAR' ? zar(values[control.key]) : values[control.key] + '%'}</output></span><input id={control.key} type="range" min={control.min} max={control.max} step={control.step} value={values[control.key]} onChange={e => setValues({ ...values, [control.key]: Number(e.target.value) })} /></label>)}</div>
    <div className="module-toolbar"><label>Forecast horizon<select aria-label="Forecast horizon" value={values.months} onChange={e => setValues({ ...values, months: Number(e.target.value) })}><option value={6}>6 months</option><option value={12}>12 months</option><option value={24}>24 months</option></select></label><button className="text-button" onClick={() => setValues(initialAssumptions)}><RotateCcw size={14} />Reset assumptions</button></div>
    <div className="forecast-totals" aria-live="polite"><div><span>Modelled revenue</span><strong>{zar(revenue)}</strong></div><div><span>Operating surplus / deficit</span><strong>{zar(revenue - totalCosts)}</strong></div><div><span>Closing cash</span><strong className={rows.at(-1)!.cash < 0 ? 'negative' : ''}>{zar(rows.at(-1)!.cash)}</strong></div></div>
    <figure className="forecast-chart"><figcaption><span>Monthly hypothetical revenue</span><span className="mono">{values.months} MONTHS / ZAR</span></figcaption><div className="chart-bars" aria-hidden="true">{rows.map(row => <div key={row.month} title={'Month ' + row.month + ': ' + zar(row.revenue)}><span style={{ height: Math.max(1, row.revenue / max * 100) + '%' }} /><small>{row.month}</small></div>)}</div></figure>
    <details className="forecast-details"><summary>View the monthly model and calculation method</summary><p className="module-note">Revenue = starting monthly revenue × (1 + monthly growth)^(month − 1). Cash = opening cash + cumulative revenue − cumulative costs. Tax, finance costs, capital expenditure and collection timing are excluded.</p><div className="table-scroll"><table className="data-table"><thead><tr><th>Month</th><th>Revenue</th><th>Costs</th><th>Closing cash</th></tr></thead><tbody>{rows.map(row => <tr key={row.month}><td>{row.month}</td><td>{zar(row.revenue)}</td><td>{zar(row.costs)}</td><td>{zar(row.cash)}</td></tr>)}</tbody></table></div></details>
  </section>
}
