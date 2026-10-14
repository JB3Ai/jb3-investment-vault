# Complete local dependency trees

All views are state-driven at `/`. Traced relative static imports and dynamic import() recursively from actual source. Type-only imports included. External packages omitted; CSS imported by main.tsx is included. Shared bootstrap tree covers the shell and data dependencies for every view. SectionModules is composed inside SectionReader by App rather than imported by SectionReader, so its complete tree is separately shown. These trees are candidate context, not an instruction to upload all files. Exclude auth/data access files when they are unnecessary to the design surface.

## / - Application bootstrap (all views)
Entry: `src/main.tsx`

```text
- src/main.tsx
  - src/App.tsx
    - src/components/LeatherBackground.tsx
    - src/components/VaultEntry.tsx
    - src/components/ConsoleFrame.tsx
      - src/types.ts
      - src/components/AnalogKnob.tsx
        - src/types.ts
        - src/content/registry.ts
          - src/types.ts
      - src/components/OLEDPanel.tsx
        - src/types.ts
        - src/content/registry.ts
          - src/types.ts
      - src/components/SectionIndex.tsx
        - src/content/registry.ts
          - src/types.ts
        - src/types.ts
    - src/components/SectionReader.tsx
      - src/types.ts
      - src/content/registry.ts
        - src/types.ts
    - src/components/SectionModules.tsx
      - src/components/HistoricalTimeline.tsx
        - src/content/modules.ts
      - src/components/EvidenceGallery.tsx
        - src/types.ts
      - src/components/OpportunityPipeline.tsx
        - src/content/modules.ts
        - src/lib/finance.ts
      - src/components/FinancialDashboard.tsx
        - src/lib/finance.ts
      - src/components/InvestmentStructures.tsx
        - src/content/modules.ts
      - src/types.ts
    - src/components/DocumentLibrary.tsx
      - src/lib/demoPdf.ts
      - src/lib/supabase.ts
      - src/types.ts
      - src/components/SecureDocumentViewer.tsx
    - src/components/ExecutiveBriefing.tsx
      - src/types.ts
    - src/components/AuthPanel.tsx
      - src/lib/supabase.ts
    - src/lib/supabase.ts
    - src/lib/useVault.ts
      - src/types.ts
      - src/content/registry.ts
        - src/types.ts
      - src/lib/supabase.ts
  - src/components/ErrorBoundary.tsx
  - src/styles.css
```

## / - Entry
Entry: `src/components/VaultEntry.tsx`

```text
- src/components/VaultEntry.tsx
```

## / - Console
Entry: `src/components/ConsoleFrame.tsx`

```text
- src/components/ConsoleFrame.tsx
  - src/types.ts
  - src/components/AnalogKnob.tsx
    - src/types.ts
    - src/content/registry.ts
      - src/types.ts
  - src/components/OLEDPanel.tsx
    - src/types.ts
    - src/content/registry.ts
      - src/types.ts
  - src/components/SectionIndex.tsx
    - src/content/registry.ts
      - src/types.ts
    - src/types.ts
```

## / - Section reader (eleven sections)
Entry: `src/components/SectionReader.tsx`

```text
- src/components/SectionReader.tsx
  - src/types.ts
  - src/content/registry.ts
    - src/types.ts
```

## / - Reader interactive modules (composition sibling)
Entry: `src/components/SectionModules.tsx`

```text
- src/components/SectionModules.tsx
  - src/components/HistoricalTimeline.tsx
    - src/content/modules.ts
  - src/components/EvidenceGallery.tsx
    - src/types.ts
  - src/components/OpportunityPipeline.tsx
    - src/content/modules.ts
    - src/lib/finance.ts
  - src/components/FinancialDashboard.tsx
    - src/lib/finance.ts
  - src/components/InvestmentStructures.tsx
    - src/content/modules.ts
  - src/types.ts
```

## / - Document library including lazy PDF viewer
Entry: `src/components/DocumentLibrary.tsx`

```text
- src/components/DocumentLibrary.tsx
  - src/lib/demoPdf.ts
  - src/lib/supabase.ts
  - src/types.ts
  - src/components/SecureDocumentViewer.tsx
```

## / - Executive briefing
Entry: `src/components/ExecutiveBriefing.tsx`

```text
- src/components/ExecutiveBriefing.tsx
  - src/types.ts
```

## / - Secure sign-in gate
Entry: `src/components/AuthPanel.tsx`

```text
- src/components/AuthPanel.tsx
  - src/lib/supabase.ts
```
