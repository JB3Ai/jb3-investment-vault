# Existing Worker deployment

Target: `jb3-private-investment-vault`, account `18ab41342b712e6d2a83057299705832`, existing domain `https://bruce.jb3ai.com`. No named environment or domain/trigger changes.

The owner authorised a temporary presentation release on 20 October 2026. Landing, presentation PIN and the existing calibration lead directly to the populated presentation. The PIN is not authentication. The original Supabase classified gateway, its grants, secret bindings and disabled release gates remain separate.

Source originals and all populated deployment ledgers remain in the external private intake. The existing intake is projected into a screened release copy. Legal dossiers, confidential-marked documents and personal identifiers are withheld. Draft financial and evidence statuses are retained. No source records are embedded in the frontend bundle or committed to Git.

The Worker serves only allowlisted presentation copies from its dedicated KV binding. It does not accept client-selected paths or buckets. The browser creates selected-rate Excel/PDF exports from released data in memory; it never exports the original private intake.

From the release checkout, use the authorised Windows account:

```powershell
$env:JB3_PRIVATE_CONTENT_ROOT = 'C:\Users\jono_8poat5m\AppData\Local\JB3Vault\private-content'
node --experimental-transform-types scripts/prepare-presentation-release.mjs
node scripts/check-presentation-launch.mjs http://127.0.0.1:5189
node scripts/publish-presentation-release.mjs
$env:VITE_VAULT_MODE = 'presentation'
npm.cmd run build
npx.cmd wrangler versions upload --config wrangler.jsonc --name jb3-private-investment-vault --keep-vars --dry-run --outdir tmp/manual-deploy-worker
node --experimental-transform-types scripts/check-release-privacy.mjs
```

Production upload/activation requires owner authorisation. The owner authorised this launch in the current session. Preserve existing Worker secrets, routes and domain configuration:

```powershell
npx.cmd wrangler versions upload --config wrangler.jsonc --name jb3-private-investment-vault --keep-vars
$version = Read-Host 'Uploaded Version ID'
npx.cmd wrangler versions deploy --config wrangler.jsonc --name jb3-private-investment-vault --version-id $version --percentage 100 --yes
node scripts/check-presentation-launch.mjs https://bruce.jb3ai.com
```

Before future releases, verify the current production version and record it for recovery. The preceding version verified for this launch is `1f953e3c-cce2-4472-b0e8-cc28b61a75c0`. Restore that version with `wrangler versions deploy` if hosted acceptance fails. Do not deploy triggers, change Auth configuration or enable Supabase release gates as part of this procedure.
