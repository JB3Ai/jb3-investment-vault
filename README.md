# JB³ Private Investment Vault

A local-first React + Vite + TypeScript investor presentation with a minimal analog console. The current edition contains **synthetic demonstration material only**.

## Run locally

Node.js 24 is the tested runtime. In PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:5173. No environment file or credentials are needed for the demonstration.
The existing empty file `j` is preserved.

## Available checks

```powershell
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run deploy:check
```

Browser tests start local servers on ports 5173 (demonstration) and 5174 (unconfigured secure mode). The PDF engine is lazy loaded; its larger bundle is downloaded only when opening a document.

## Included

- Cinematic entry, CSS/SVG leather texture, machined controls and central OLED.
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

Do not place confidential content in these files, the Git repository, or `public/`. Everything shipped in a client bundle is public. No supplied asset valuations, contracts, certifications, founder history, photographs or financial actuals were available; those remain explicitly pending.

The opportunity register is session-local. Forecast controls reset when leaving the section. The model excludes tax, financing costs, capital expenditure and collection timing. It does not calculate or promise investment returns.

## Security modes

Default: `VITE_VAULT_MODE=demo`. This is publicly readable synthetic content.

Optional: `VITE_VAULT_MODE=secure`, with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
Copy `.env.example` to `.env.local` before configuring a dedicated approved environment. A publishable key is not a secret; never substitute a service-role key. Sessions are held in memory rather than localStorage.

Secure mode never falls back to demo access if configuration, authentication or membership checks fail. Content is fetched from Postgres only after authentication. The SQL release switch begins **disabled**. See [SECURITY.md](SECURITY.md) before enabling it.

No live Supabase project was changed or connected. Docker was not running, so full local Supabase Auth/Storage could not be exercised. Embedded PostgreSQL policy tests use minimal local Auth/Storage schema fixtures and do not prove live JWT validation, email delivery, signed-link expiry or hosted configuration.

## Deployment and source control

The project has a local Git repository on `main`, a lockfile, ignore rules and `.github/workflows/checks.yml`. No remote, commit or push was created.
`wrangler.jsonc` publishes only `dist/` as Worker static assets with SPA fallback; `public/_headers` supplies CSP and other response headers.
The configuration was dry-run checked. Nothing was deployed, per the request to keep the build local.

After explicit future deployment authorisation and security verification, `npm.cmd run deploy` builds and invokes Wrangler. Cloudflare authentication and a chosen target account are prerequisites.

## Build records

[Pass report](docs/BUILD_REPORT.md) · [Design and visual review](docs/DESIGN.md) · [Security handoff](SECURITY.md)
