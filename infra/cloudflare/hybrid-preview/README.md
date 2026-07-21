# Munjanggun hybrid Preview Worker

This Worker owns only `hybrid-preview.munjanggun.com`. It does not route or
change `munjanggun.com`, `www`, mail records, n8n, or quotes endpoints.

## Routing contract

| Incoming path | Upstream |
| --- | --- |
| `/` and all other public-showroom paths | `https://munjanggun-home.pages.dev` |
| `/_next/*`, `/api/blog/*`, `/auth/callback`, `/login` | `https://preview.munjanggun.com` |
| `/admin/*`, `/measure/*`, `/portal/*`, `/preview/*` | `https://preview.munjanggun.com` |

The Worker forwards the public preview host to the app and rewrites absolute
Vercel redirect locations back to `https://hybrid-preview.munjanggun.com`.
Authentication, admin, portal, measurement, preview, and API responses are
always fetched with `no-store` and returned with `Cache-Control: private,
no-store, max-age=0`.

## Deployment boundary

The configured `custom_domain` is intentionally only
`hybrid-preview.munjanggun.com`. Cloudflare will create or manage the DNS
record for that one host when an authenticated operator deploys it. Do not
replace it with a wildcard or add production domains.

```powershell
npx wrangler deploy --config infra/cloudflare/hybrid-preview/wrangler.jsonc
```

Before deploying, verify that the target hostname has no existing CNAME: a
Cloudflare Custom Domain cannot be added over an existing CNAME. The required
Supabase allow-list value, if OAuth is to be tested end-to-end, is exactly:

```text
https://hybrid-preview.munjanggun.com/auth/callback
```

Do not change Supabase redirect URLs as part of this Worker deployment.
