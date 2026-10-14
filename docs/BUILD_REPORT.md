# Build report — 13 October 2026

The build remains local by explicit instruction. No remote Supabase project, GitHub repository or Cloudflare deployment was modified.

## Pass 1 — console and navigation

Created: package/configuration files; `src/types.ts`; `src/content/registry.ts`; entry, leather background, console frame, OLED, analog knobs, section index and reader components; application shell and styles.

Working: cinematic entry, all eleven sections, direct index, mouse/pointer/touch movement, keyboard arrows/Home/End, step buttons, reading view, return/next navigation, responsive layout, reduced motion, provenance/disclosure labels.

Checks: structural assertions, TypeScript and Vite production build passed. Desktop/mobile browser verification subsequently passed.
Limitations: content is demonstration only. No authentication claim is made by the entry screen.
Security: no confidential document was added to public assets.
Developer commands: `npm.cmd ci`, `npm.cmd run dev`.

## Pass 2 — content and investment modules

Created: timeline, evidence gallery, opportunity register, financial dashboard, investment structure comparison, document library/PDF reader, printable executive briefing, pure financial calculation module and tests, module data registry and browser tests.

Working: 2024/2025 selection, pending-photo navigation, stage changes and filters, adjustable assumptions, monthly forecast table and chart, scenario reset, three structure tabs, real PDF rendering/zoom, printable eleven-section briefing.

Checks: production build and three financial tests passed. Browser tests cover the module interactions, PDF rendering, printing and mobile overflow.
Fixes: React-PDF 11 defaults to Suspense; a binary source recreated during suspended mounts caused repeated worker loads. Explicit non-Suspense document loading preserves stable state and displays the loading/error UI. The rerun verifies a visible rendered PDF canvas.
Limitations: no actual photographs, financial actuals, legal terms or source evidence supplied. Pipeline edits stay in session. The PDF example is generated locally. The forecast is hypothetical and omits tax, financing, capital expenditure and collection timing.
Security: no fabricated evidence or confidential asset in the bundle.
Developer commands: `npm.cmd run build`, `npm.cmd test`, `npm.cmd run test:e2e`.

## Pass 3 — security and deployment preparation

Created: optional Supabase client/Auth flow, membership/content loading, authorised document retrieval, fail-closed secure-mode screen, error boundary, server RLS migration, local Supabase configuration, PostgreSQL policy tests, Cloudflare Worker static-assets configuration/headers, GitHub Actions checks, security and setup documentation.

Working locally: database policy enforcement, disabled release gate, rejected self-promotion/writes, private bucket configuration, signed-URL client wiring, local Git repository on main.
Checks: 12 unit/database-policy tests passed (3 financial + 9 policy). Browser verification covers desktop/mobile interaction and missing secure configuration; a separate real touch-event test passed. Cloudflare dry run passed.
Limitations: no live sign-in, invitation delivery, real Storage signing/expiry or live RLS integration test. Docker daemon was unavailable; embedded PostgreSQL substitutes only the SQL engine and minimal Auth/Storage schema fixtures. The PDF engine remains a sizeable lazy-loaded chunk (~633 kB minified), separate from initial application loading.
Security: the vault access switch starts false, and all shipped content remains synthetic. Read SECURITY.md for the remaining production gate and signed-URL limitations.
Developer commands: none required to use the demonstration. A dedicated Supabase environment, real access tests and explicit release authorisation are prerequisites for confidential use. No deployment or push performed.

## Verification evidence

- `src/lib/finance.test.ts`: cash accumulation, growth, negative cash, bounded inputs.
- `src/lib/security.test.ts`: actual migration executed in embedded PostgreSQL.
- `tests/navigation.spec.ts`: all eleven sections and keyboard navigation.
- `tests/modules.spec.ts`: timeline, gallery, pipeline, forecast, PDF, print, pointer and touch.
- `tests/secure-mode.spec.ts`: missing secure configuration denies access.
- `docs/console-desktop.png` and `docs/console-mobile.png`: final rendered visual captures.
- `docs/console-concept.png`: design reference generated with the built-in image tool.

The in-app browser timed out twice; Playwright Chromium was used for browser verification. Desktop viewport: 1536×1024; mobile: 390×844 with device scale factor 3. Screenshots include full-page continuation.

## Source-control state

Local Git initialised on `main`; no commits, remote, or push. Lockfile pins installed versions. The user's existing empty `j` file remains untouched.
