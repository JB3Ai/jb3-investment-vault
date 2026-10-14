# Extractable DraftComponent candidates

Menu only; no remote components have been created. Keep props limited to variable state/navigation/visibility/counts. Full original source is in components.md and layouts.md. Backend credentials, signed URLs, session objects and confidential data are not design props. AppShell is an extractable pattern currently inline in App.tsx, not an existing component export.

## AppShell
- Source: `src/App.tsx`
- Category: layout
- Description: Brand header, utility navigation and footer across all views.
- Extractable props: currentView; showTools; showSignOut; currentTier (state derived only)
- Hardcoded: JB3 mark, tool labels, icons, all CSS and footer copy

## LeatherBackground
- Source: `src/components/LeatherBackground.tsx`
- Category: layout
- Description: Charcoal leather wrapper and grain.
- Extractable props: None; composition children only
- Hardcoded: Texture and CSS

## ConsoleFrame
- Source: `src/components/ConsoleFrame.tsx`
- Category: layout
- Description: Two dial groups, central OLED and index.
- Extractable props: selectedSectionId; navigation callbacks
- Hardcoded: Heading, engravings, group names and chassis CSS

## SectionIndex
- Source: `src/components/SectionIndex.tsx`
- Category: layout
- Description: Context and Future grouped section navigation.
- Extractable props: selected; onSelect; onOpen
- Hardcoded: Approved section labels, group names, number ranges, icons and CSS

## SectionReader
- Source: `src/components/SectionReader.tsx`
- Category: layout
- Description: Shared narrative/evidence layout.
- Extractable props: selectedSectionId; showNext; onBack; onNext
- Hardcoded: Section labels, evidence captions, icons and CSS

## AnalogKnob
- Source: `src/components/AnalogKnob.tsx`
- Category: basic
- Description: Accessible rotary selector and explicit stepper.
- Extractable props: selected; onSelect
- Hardcoded: Context/Future label per instance, scale marks, icons, section labels and CSS

## OLEDPanel
- Source: `src/components/OLEDPanel.tsx`
- Category: basic
- Description: Animated selected-section display and open action.
- Extractable props: selectedSectionId; onOpen
- Hardcoded: Open section label, status labels, icon and CSS

## EvidenceGallery
- Source: `src/components/EvidenceGallery.tsx`
- Category: basic
- Description: Evidence viewer with explicit empty image state.
- Extractable props: selectedImageIndex; previous/next navigation
- Hardcoded: Approved captions, image sources, icons and CSS

## SecureDocumentViewer
- Source: `src/components/SecureDocumentViewer.tsx`
- Category: basic
- Description: Document viewer control bar.
- Extractable props: page; pageCount; zoom; isExpired; onClose
- Hardcoded: Toolbar labels, icon names and CSS; never extract signed URLs
