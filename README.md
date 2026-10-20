# JB³ Private Investment Vault

A local-first React + Vite + TypeScript investor presentation with a minimal analog console. The current edition contains **synthetic demonstration material only**.

## Run locally

Node.js 24 is the tested runtime. In PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. No environment file or credentials are needed for the demonstration.

## Available checks

```powershell
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run deploy:check
```

Browser tests start local servers on ports 5173 (demonstration), 5174 (unconfigured secure mode) and 5175 (synthetic authenticated-reader fixtures). They do not connect to the hosted project. The PDF engine is lazy loaded; its larger bundle is downloaded only when opening a document.

## Included

- Approved Asymmetrical Luxury Console v2 with stacked desktop controls, a right-hand OLED and the preserved mobile layout.
- Eleven sections, drag/touch/keyboard rotary selection, step controls and direct index.
- Spacious section reader with provenance, verification, disclosure and update metadata.
- Interactive 2024–2025 editorial timeline and laboratory evidence-gallery placeholders.
- Editable synthetic opportunity stages and stage filter.
- Adjustable hypothetical ZAR forecast with cash balances, charts and monthly table.
- Three illustrative investment structures.
- A genuine locally generated sample PDF, pagination and zoom.
- Printable executive briefing.
- Optional real Supabase sign-in and server-authorised content/document retrieval.
- Private storage migration, short-lived document URLs, role policy tests.
- Cloudflare Workers static-assets configuration and GitHub Actions checks.

## Content editing

`src/content/registry.ts` defines all eleven safe demo sections.
`src/content/modules.ts` contains the editable timeline, opportunity stage registry, examples and structure comparison.
`src/lib/finance.ts` holds the transparent hypothetical model and default assumptions.
Types are in `src/types.ts`; presentation components live in `src/components/`.

Do not place confidential content in these files, the Git repository, or `public/`. Everything shipped in a client bundle is public. Real source documents and approved narratives remain in external private custody. Financial and supporting-evidence approvals remain separate from narrative approval.

The opportunity register is session-local. Forecast controls reset when leaving the section. The model excludes tax, financing costs, capital expenditure and collection timing. It does not calculate or promise investment returns.

The [private content ingestion workflow](docs/PRIVATE_CONTENT_INGESTION.md) provides a local-only importer, canonical master/PDF contracts, provenance and approval validation, and separate `BRUCE_PRIVATE`, `COMMERCIAL` and `LEGAL_RESTRICTED` classifications. Source documents and staged batches must remain outside this repository. The secure reader requests approved narratives through authentication, exact grants and both release gates; demonstration mode retains its synthetic registry. Confidential release remains disabled pending live security testing.

## Security modes

Default: `VITE_VAULT_MODE=demo`. This is publicly readable synthetic content.

Optional: `VITE_VAULT_MODE=secure`, with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
Copy `.env.example` to `.env.local` before configuring the owner-approved Supabase environment. Both `.env` and `.env.local` are ignored by Git. A publishable key is not a secret; never substitute a service-role or secret key. Sessions are held in memory rather than localStorage.

Secure mode never falls back to demo access if configuration, authentication or membership checks fail. Content is fetched from Postgres only after authentication. Both SQL release switches begin **disabled**. See [SECURITY.md](SECURITY.md) before enabling either.

Focused testing on 17 October 2026 isolated the expiry failure: REST/origin authorization denies an expired grant, while the SDK's generic Storage route can still return a CDN HIT. Upload cacheControl zero also failed. Both gates are false and the Vault is empty. The owner-authorised [protected download gateway](docs/PROTECTED_DOWNLOAD_GATEWAY.md) is implemented locally: PDF/image adapters use same-origin UUID endpoints with fresh Auth/database checks and server-only object retrieval. Deployment and the restrictive Storage policy remain unapproved and unapplied; confidential release is still blocked. See the [acceptance report](docs/LIVE_SECURITY_ACCEPTANCE.md) for live evidence and remaining holds. Installed migrations `20261016101851` and `20261016101857` remain unchanged; do not reapply or repair history.

## Deployment and source control

Source repository: [JB3Ai/jb3-investment-vault](https://github.com/JB3Ai/jb3-investment-vault), branch `main`. It includes a lockfile, ignore rules and `.github/workflows/checks.yml`. Publishing source code does not deploy the application or enable confidential access.
`wrangler.jsonc` publishes only `dist/` as Worker static assets with SPA fallback; `public/_headers` supplies CSP and other response headers.
The configuration was dry-run checked. Nothing was deployed, per the request to keep the build local.

After explicit future deployment authorisation and security verification, `npm.cmd run deploy` builds and invokes Wrangler. Cloudflare authentication and a chosen target account are prerequisites.

## Build records

[Pass report](docs/BUILD_REPORT.md) · [Design and visual review](docs/DESIGN.md) · [Security handoff](SECURITY.md)
