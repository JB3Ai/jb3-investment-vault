import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VaultSection } from '../types'
import { sectionNumber } from '../content/registry'

interface Props { label: string; sections: VaultSection[]; selected: string; onSelect: (id: string) => void }
export function AnalogKnob({ label, sections, selected, onSelect }: Props) {
  const last = useRef(0)
  if (sections.length === 0) return <div className="knob-empty">No approved {label.toLowerCase()} sections.</div>
  const index = Math.max(0, sections.findIndex(section => section.id === selected))
  const active = sections.some(section => section.id === selected)
  const select = (next: number) => onSelect(sections[Math.max(0, Math.min(sections.length - 1, next))].id)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, Home: 0, End: sections.length - 1 }
    if (event.key in moves) { event.preventDefault(); select(moves[event.key]) }
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); last.current = event.clientX - event.clientY }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const delta = event.clientX - event.clientY - last.current
    if (Math.abs(delta) >= 24) { select(index + Math.sign(delta)); last.current = event.clientX - event.clientY }
  }
  return <div className={`knob-group ${active ? 'is-active' : ''}`}>
    <h2>{label}</h2>
    <div className="dial-surround">
      <svg className="dial-scale" viewBox="0 0 240 240" aria-hidden="true">
        {Array.from({ length: 37 }, (_, i) => {
          const angle = (-225 + i * 7.5) * Math.PI / 180
          return <line key={i} x1={120 + Math.cos(angle) * 105} y1={120 + Math.sin(angle) * 105} x2={120 + Math.cos(angle) * (i % 6 === 0 ? 115 : 110)} y2={120 + Math.sin(angle) * (i % 6 === 0 ? 115 : 110)} />
        })}
      </svg>
      <div className="knob" role="slider" tabIndex={0} aria-label={`${label} section`} aria-valuemin={sections[0].number} aria-valuemax={sections.at(-1)!.number} aria-valuenow={sections[index].number} aria-valuetext={`${sections[index].title}${active ? ', selected' : ', turn to select'}`} aria-describedby={`${label}-help`} onKeyDown={onKeyDown} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
        <div className="knob-face"><div className="knob-pointer" style={{ transform: `rotate(${-135 + (index / Math.max(1, sections.length - 1)) * 270}deg)` }}><span /></div><span className="knob-center" /></div>
      </div>
      <span className="dial-min">{sectionNumber(sections[0].number)}</span><span className="dial-max">{sectionNumber(sections.at(-1)!.number)}</span>
    </div>
    <div className="knob-stepper"><button aria-label={`Previous ${label.toLowerCase()} section`} disabled={active && index === 0} onClick={() => select(active ? index - 1 : 0)}><ChevronLeft size={15} /></button><span>{sectionNumber(sections[index].number)} / {sectionNumber(sections.at(-1)!.number)}</span><button aria-label={`Next ${label.toLowerCase()} section`} disabled={active && index === sections.length - 1} onClick={() => select(active ? index + 1 : 0)}><ChevronRight size={15} /></button></div>
    <span className="sr-only" id={`${label}-help`}>Drag up or right to advance. Use arrow keys, Home or End, or the previous and next buttons.</span>
  </div>
}
