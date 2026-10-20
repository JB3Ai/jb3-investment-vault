# Manual closed-gate deployment

Status: prepared and locally tested on 20 October 2026. No upload or production deployment has been performed. Production execution requires explicit owner approval.

Verified existing target:

- Provider: Cloudflare Workers, not Pages.
- Account: 18ab41342b712e6d2a83057299705832.
- Worker: jb3-private-investment-vault; production environment, no named Wrangler environment.
- Existing custom domain: https://bruce.jb3ai.com.
- Existing alternate endpoint: https://jb3-private-investment-vault.jono-18a.workers.dev.
- Configuration: wrangler.jsonc; entry server/worker.ts; public assets dist/; ASSETS binding; /api/vault/* Worker-first.
- Current live version at inspection: d0121c8a-a000-4692-a710-c61756cde663, 100% traffic, deployed 17 October 2026.
- Existing Worker secrets: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY. All three are secret_text bindings. Values were not retrieved or printed.

GitHub's Vault checks job was not started because of an account billing lock. Its workflow runs build/tests and a deployment dry run; it has no production deployment step. Local manual deployment does not depend on a GitHub-hosted runner. Cloudflare account permissions or billing can still independently reject a future upload.

## Local preparation only

Use the normal authorised Windows account. Keep private documents and environment files out of this checkout. Only the project URL and publishable/legacy-anon key belong in the browser build. Never use a secret/service-role key as a VITE variable.

PowerShell from the clean release checkout:

~~~powershell
Set-Location -LiteralPath 'C:\Apps in Dev Visual Code Folder\jb3-investment-vault-release'
if ($env:CLOUDFLARE_ENV) { throw 'A named environment is selected; stop and clear it before continuing.' }
$env:CLOUDFLARE_ACCOUNT_ID = '18ab41342b712e6d2a83057299705832'
$env:VITE_VAULT_MODE = 'secure'
$env:VITE_SUPABASE_URL = 'https://uxeolplwhtyyefpmwktw.supabase.co'
$env:VITE_SUPABASE_PUBLISHABLE_KEY = Read-Host 'Existing project publishable key or legacy anon key (never a server secret)'
node --input-type=module -e "const k=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;let ok=/^sb_publishable_[A-Za-z0-9_-]+$/.test(k);try{const p=JSON.parse(Buffer.from(k.split('.')[1],'base64url'));ok ||= p.role==='anon'&&p.ref==='uxeolplwhtyyefpmwktw'}catch{}if(!ok)process.exit(1);const r=await fetch(process.env.VITE_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:k}});if(!r.ok)process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Public-key validation failed; do not build or deploy.' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
npx.cmd wrangler versions upload --config wrangler.jsonc --name jb3-private-investment-vault --keep-vars --dry-run --outdir tmp/manual-deploy-worker
if ($LASTEXITCODE -ne 0) { throw 'Worker dry run failed.' }
$env:JB3_PRIVATE_CONTENT_ROOT = 'C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content'
node --experimental-transform-types scripts/check-release-privacy.mjs
if ($LASTEXITCODE -ne 0) { throw 'Privacy scan failed; do not upload.' }
~~~

The privacy command reads the established private adapter in memory, checks all local Git objects including unreachable blobs, checks candidate files, frontend/public output and the prepared Worker, and prints counts/findings only. It does not copy source material or create access grants. The Node transform flag is required by an existing server-side TypeScript constructor. The native Cloudflare credential is compared in memory when available.

The secure build must be prepared again if dist/ is later rebuilt in demo mode. Do not use a private-local build or a bare default npm run deploy for this production procedure. No privileged credentials are needed for the frontend build or bundled into its JavaScript.

## Production operations: approval required, not executed

Use the existing Worker version commands so code can be rolled out without deploying triggers, replacing routes, rebinding DNS or creating another project. Preserve existing secrets/variables with --keep-vars. Do not run wrangler triggers deploy, pages deploy, secret put, database migrations or domain commands.

After owner approval of this exact account, Worker and procedure, with the validated secure build still in dist/:

~~~powershell
$releaseCommit = git rev-parse HEAD
npx.cmd wrangler versions upload --config wrangler.jsonc --name jb3-private-investment-vault --keep-vars --message "JB3 closed-gate release $releaseCommit"
if ($LASTEXITCODE -ne 0) { throw 'Upload failed; do not deploy.' }
$uploadedVersion = Read-Host 'Paste the new Version ID printed by the successful upload'
if ($uploadedVersion -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') { throw 'Invalid Version ID.' }
npx.cmd wrangler versions deploy --config wrangler.jsonc --name jb3-private-investment-vault --version-id $uploadedVersion --percentage 100 --message "JB3 closed-gate release $releaseCommit" --yes
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed; inspect the existing service without changing access controls.' }
~~~

Both commands require approval: the first uploads a new production-account version; the second activates it. Neither has been run. Exact flags were checked against installed Wrangler 4.150.0. No --env, --route or --domain override is used. The public domain configuration remains managed as it is now. ASSETS and the server entry are supplied by the unchanged existing configuration; encrypted Supabase bindings remain server-side.

## Acceptance and recovery after an approved rollout

Use a fresh browser tab/session: verify the landing, 10-12-second sweep, Skip/mute/replay, mobile layout, and then the existing Supabase sign-in/closed-gate state. The presentation PIN remains private-local only; this release does not introduce a hosted PIN or bypass authentication. No investor content is loaded by this deployment.

Verify unauthenticated GET /api/vault/assets/00000000-0000-4000-8000-000000000001 returns 401 with no-store cache headers, not a document or SPA response. Verify both gates false, unchanged domain mapping and secret binding names, and record the deployed Version ID. Do not create users, grant access, upload evidence or open gates as part of a smoke test.

If a smoke test fails, keep both gates false and use the previously verified live version for recovery (owner-authorised production operation):

~~~powershell
npx.cmd wrangler versions deploy --config wrangler.jsonc --name jb3-private-investment-vault --version-id d0121c8a-a000-4692-a710-c61756cde663 --percentage 100 --message "Restore prior closed-gate version" --yes
~~~

Recheck the currently deployed version immediately before a future rollout; if it changed after this inspection, stop and agree on the correct recovery version. Confidential production access remains blocked until hosted security acceptance and separately approved account/grant/content setup.

References: https://developers.cloudflare.com/workers/wrangler/commands/workers/ and https://developers.cloudflare.com/workers/versions-and-deployments/ . Version uploads/deployments and trigger deployments are distinct operations.
