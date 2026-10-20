import {presentationText} from '../lib/presentationCopy'
import { Fragment } from 'react'

// Markdown is rendered as React text, never HTML. Source strings remain untouched.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part.startsWith('*') && part.endsWith('*') ? <em key={index}>{part.slice(1, -1)}</em> : <Fragment key={index}>{part}</Fragment>)
}
export function NarrativeText({ body }: { body: string }) {
  body=presentationText(body)
  return <>{body.split(/\n\s*\n/).map((block, index) => {
    if (/^---+$/.test(block.trim())) return <hr key={index} />
    if (/^#{2,6} /.test(block)) {
      const lines = block.split('\n')
      return <Fragment key={index}><h3>{inline(lines[0].replace(/^#{2,6} /, ''))}</h3>{lines.length > 1 && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inline(lines.slice(1).join('\n'))}</p>}</Fragment>
    }
    return <p key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{inline(block)}</p>
  })}</>
}
