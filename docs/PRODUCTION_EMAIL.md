# Production email setup (Piecelogue magic links)

Piecelogue sends passwordless sign-in links via the Cloudflare Worker `EMAIL` binding (`sendMagicLinkEmail`). Local development uses `AUTH_DEV_MODE=true` in `.dev.vars` and never sends mail.

## Prerequisites

- `piecelogue.com` uses **Cloudflare DNS** (required for Email Service).
- Auth migration applied to remote D1: `npx wrangler d1 migrations apply piecelogue --remote`
- `wrangler.jsonc` already declares the `EMAIL` `send_email` binding.

## 1. Verify sender domain (Cloudflare dashboard)

1. Open [Cloudflare dashboard](https://dash.cloudflare.com/) → **Compute** → **Email Service** → **Email Sending**.
2. Click **Onboard domain**.
3. Select **piecelogue.com** (must be on your account with Cloudflare DNS).
4. Review DNS records Cloudflare will add (bounce MX, SPF, DKIM, DMARC on `_dmarc.piecelogue.com`).
5. Click **Done** and wait for onboarding to complete (often 5–15 minutes; up to 24 hours).

Recommended sender address after onboarding:

```text
noreply@piecelogue.com
```

Any address `@piecelogue.com` works once the domain is onboarded. `AUTH_FROM_EMAIL` must use that verified domain.

## 2. EMAIL binding (already in repo)

`wrangler.jsonc` includes:

```jsonc
"send_email": [{ "name": "EMAIL" }]
```

The Worker adapter calls `env.EMAIL.send()` with `from`, `to`, `subject`, and `text`. No code changes are needed after deploy once the binding is active.

Optional hardening (edit `wrangler.jsonc` after you pick a sender):

```jsonc
"send_email": [
  {
    "name": "EMAIL",
    "allowed_sender_addresses": ["noreply@piecelogue.com"]
  }
]
```

If you add `allowed_sender_addresses`, it must match `AUTH_FROM_EMAIL` exactly.

## 3. Set `AUTH_FROM_EMAIL` (production secret)

Set a **Worker secret** (not committed to git):

```bash
npx wrangler secret put AUTH_FROM_EMAIL
# Enter: noreply@piecelogue.com
```

Or in the dashboard: **Workers & Pages** → **piecelogue** → **Settings** → **Variables and Secrets** → **Add** → type **Secret**, name `AUTH_FROM_EMAIL`, value `noreply@piecelogue.com`.

## 4. Production environment checks

| Variable | Production value |
|----------|------------------|
| `ENVIRONMENT` | `production` (set in `wrangler.jsonc` `vars`) |
| `APP_ORIGIN` | `https://piecelogue.com` (set in `wrangler.jsonc` `vars`) |
| `AUTH_FROM_EMAIL` | Secret, e.g. `noreply@piecelogue.com` |
| `AUTH_DEV_MODE` | **Do not set** (must be absent/false in production) |

If `AUTH_DEV_MODE` is set in production, magic links are skipped and `dev.magicLink` can appear in API responses.

## 5. Deploy

```bash
npm run build
npx wrangler deploy
```

## 6. Smoke test (production)

```bash
curl -s -X POST https://piecelogue.com/api/auth/request-link \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_EMAIL@example.com"}'
```

Expected:

```json
{
  "ok": true,
  "message": "If that email can receive mail, a sign-in link has been sent."
}
```

- No `dev` field in the response.
- Email arrives from `AUTH_FROM_EMAIL` with a link to `https://piecelogue.com/api/auth/verify?token=...`.

## Local dev (unchanged)

`.dev.vars`:

```bash
AUTH_DEV_MODE=true
APP_ORIGIN=http://localhost:8787
ENVIRONMENT=development
```

To test real Email Service locally (optional), add `remote: true` to the `EMAIL` binding and set `AUTH_FROM_EMAIL` in `.dev.vars`. Do **not** set `AUTH_DEV_MODE` for that test.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `503 service_unavailable` on request-link | `EMAIL` binding missing, or `AUTH_FROM_EMAIL` not set |
| `E_SENDER_NOT_VERIFIED` in Worker logs | Domain not onboarded or `AUTH_FROM_EMAIL` domain mismatch |
| `E_SENDER_DOMAIN_NOT_AVAILABLE` | Domain not added to Email Sending |
| Email in spam | Normal for new senders; confirm SPF/DKIM/DMARC in dashboard |
| `dev.magicLink` in production JSON | `AUTH_DEV_MODE` or `ENVIRONMENT=development` set in production |
