# Sign in with Apple setup (Piecelogue)

Apple sign-in is a first-class login option alongside Google and passwordless email magic links. All three methods reuse the same D1 `users` table and session cookies. Accounts are linked by verified email.

## Redirect URI

Register this exact callback URL in Apple Developer:

| Environment | Redirect URI |
|-------------|--------------|
| Production | `https://piecelogue.com/api/auth/apple/callback` |
| Local dev | `http://localhost:8787/api/auth/apple/callback` |

Apple uses `response_mode=form_post`, so the callback is a **POST** to this URL.

## Apple Developer setup

1. Open [Apple Developer](https://developer.apple.com/account/) → **Certificates, Identifiers & Profiles**.
2. **App ID**
   - Create or select your iOS/macOS App ID (Bundle ID), e.g. `com.piecelogue.app`.
   - Enable **Sign in with Apple** capability.
3. **Services ID** (required for web sign-in)
   - Identifiers → **Services IDs** → create one, e.g. `com.piecelogue.web`.
   - Enable **Sign in with Apple** and configure **Web Authentication**:
     - **Domains and Subdomains:** `piecelogue.com` (and your local tunnel domain if testing web OAuth locally)
     - **Return URLs:**
       - `https://piecelogue.com/api/auth/apple/callback`
       - `http://localhost:8787/api/auth/apple/callback` (local dev only)
4. **Sign in with Apple key**
   - Keys → create a key with **Sign in with Apple** enabled.
   - Download the `.p8` private key once (you cannot download it again).
   - Note the **Key ID** and your **Team ID** (Membership details).
5. Use the **Services ID** as `APPLE_CLIENT_ID` for the web Worker flow.

## Worker secrets / variables

Set on the `piecelogue` Worker:

```bash
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_KEY_ID
npx wrangler secret put APPLE_PRIVATE_KEY
```

`APPLE_CLIENT_ID` is the **Services ID** (not the App Bundle ID).

`APPLE_PRIVATE_KEY` should be the full `.p8` PEM contents. In `.dev.vars`, you can store it on one line with `\n` escapes.

`APP_ORIGIN` is already set in `wrangler.jsonc`:

```jsonc
"APP_ORIGIN": "https://piecelogue.com"
```

Local `.dev.vars` example:

```bash
AUTH_DEV_MODE=true
APP_ORIGIN=http://localhost:8787
ENVIRONMENT=development
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=com.piecelogue.web
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

## Deploy

```bash
npm run build
npx wrangler deploy
```

## Flow

1. User clicks **Continue with Apple** → `GET /api/auth/apple/start`
2. Worker sets a short-lived HttpOnly OAuth state + nonce cookie (`SameSite=None; Secure` for Apple's `form_post` callback) and redirects to Apple
3. Apple POSTs to `POST /api/auth/apple/callback` with `code`, `state`, `id_token`, and optional `user` (name on first authorization)
4. Worker validates state/nonce, exchanges the code, verifies the Apple `id_token` (issuer, audience, expiration, signature via Apple JWKS), requires verified email, finds/creates the D1 user by email, optionally stores display name, creates the session cookie, redirects to `/app?auth=success&view=profile`

## Account linking

If Apple returns the same verified email as an existing Google or magic-link account, Piecelogue logs into the same `users` row. No separate provider table is required for this phase.

## Local development

- Apple web sign-in requires HTTPS for production Services IDs. Local `http://localhost` works only if registered as a Return URL.
- Magic-link email auth remains available via `AUTH_DEV_MODE=true` and **Sign in with email** in Profile.
- Do not set `AUTH_DEV_MODE` in production.
