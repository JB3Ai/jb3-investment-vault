import {NarrativeText} from './NarrativeText'
/** One shared renderer keeps chapter and briefing paragraphs identical. */
export function BriefingMarkdown({body}:{body:string}){return <NarrativeText body={body}/>}
