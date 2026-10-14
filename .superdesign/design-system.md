# JB3 Private Investment Vault - Design system

## Intent and current implementation
Private editorial investment presentation expressed as a precision analog instrument: charcoal quilted leather, machined metal chassis, two rotary selectors, central black OLED, champagne/amber marks. Preserve the established composition and exact approved section titles. React 19 + TypeScript + Vite 8, Tailwind v4 import plus hand-authored global CSS, Lucide, Motion and react-pdf. Native controls; no general component library.

## Effective palette and typography
Background #111110, leather #141513, metal #343530/#20211e/#171815, OLED #060807. Text #eee9df, champagne #d5b98b, amber #dba454, muted #aaa69d, rule #474238. Georgia serif editorial headings, Arial body, Consolas technical labels. No remote font dependency. Desktop console heading72px, OLED title45px/body16px; reader title38-66px; body15px/1.75; technical labels10-14px. Mobile title42px, OLED body14px, index11px. Do not enlarge tracking at the expense of label readability.

## Composition and surfaces
Max shell1600px with5.2% horizontal inset; reader1140px, briefing900px. Desktop left Context dial, center OLED, right Future dial; two-column index below. Context covers01-04 and Future05-11. Mobile <=720px puts OLED above both dials, retains two index columns, stacks reader evidence below narrative. Tablet boundary1000px; desktop refinements1001px; wide rules1450px. Chassis radius15px, bezel12px, display6px, input2px, circular knobs. Thin translucent champagne rules; physical inset and cast shadows, no generic card-grid replacement. CSS/SVG materials remain decorative.

## Components and interaction
Shared App header, utility links and footer. Reuse LeatherBackground, ConsoleFrame, AnalogKnob, OLEDPanel, SectionIndex, SectionReader. All view changes stay at `/`; preserve selected section. Rotary controls support drag, arrow/Home/End keys and labelled step buttons. Index buttons select; adjacent arrows open. Reader returns to console and advances to next section. Documents and executive briefing are explicit tool links. Reader heading receives focus; use native labels, live regions, amber focus rings and OS reduced-motion support. Print briefing uses A4/18mm and white paper with dark ink.

## Content and mode boundaries
Eleven sections in registry.ts are synthetic DEMONSTRATION material. Preserve honest pending evidence/empty gallery states and hypothetical financial labels; never invent photos, commitments or verified returns. Keep commercial pipeline separate from confirmed income. Local demonstration remains local. Preserve existing secure-mode gates, auth, tier filtering, server policies and short-lived document access. Design files must not encode credentials or session data. No live backend setup or deployment is implied by design work.

## Discovery / payload guidance
See init/theme.md Part1 for compact effective tokens, init/pages.md for complete recursive dependency candidates, init/components.md and init/layouts.md for exact shared code, init/routes.md for state navigation, init/extractable-components.md for remote component candidates. Use only the target surface and required primitives in a generation bundle. Full CSS and App dependency tree are discovery references, not mandatory payloads. Prefer this compact system plus focused files/ranges; preserve remote project/draft identities outside INIT. INIT has not created resume.json.

## Selected asymmetrical desktop composition
The user selected Asymmetrical Luxury Console v2. At desktop widths above1000px, Context and Future controls stack left and the OLED spans both rows on the right. Use champagne#e8d5c4 and the dark, floating instrument surfaces from that draft. Retain existing responsive layouts at tablet/mobile widths and all interaction/security boundaries. Version3 repairs the remote draft visibility and unsupported claims without changing its direction.
