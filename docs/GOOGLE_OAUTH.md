# Google OAuth setup (Piecelogue)

Google sign-in is the primary production login method. Magic-link email auth remains in the codebase for future use when Cloudflare Email Sending is available.

## Redirect URI

Register this exact callback URL in Google Cloud Console:

| Environment | Redirect URI |
|-------------|--------------|
| Production | `https://piecelogue.com/api/auth/google/callback` |
| Local dev | `http://localhost:8787/api/auth/google/callback` |

Add both if you test OAuth locally.

## Google Cloud Console steps

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project for Piecelogue.
3. Go to **APIs & Services** → **OAuth consent screen**.
4. Choose **External** (or Internal if using Google Workspace only).
5. Fill in app name (**Piecelogue**), support email, and developer contact.
6. Add scopes: `openid`, `email`, `profile` (or the combined `.../auth/userinfo.email` and `.../auth/userinfo.profile`).
7. Add test users while the app is in **Testing** mode.
8. Go to **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
9. Application type: **Web application**.
10. Name: `Piecelogue Worker`.
11. **Authorized redirect URIs** — add:
    - `https://piecelogue.com/api/auth/google/callback`
    - `http://localhost:8787/api/auth/google/callback` (local dev)
12. Save and copy the **Client ID** and **Client secret**.

## Worker secrets / variables

Set on the `piecelogue` Worker:

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

`APP_ORIGIN` is already set in `wrangler.jsonc`:

```jsonc
"APP_ORIGIN": "https://piecelogue.com"
```

Local `.dev.vars` example:

```bash
AUTH_DEV_MODE=true
APP_ORIGIN=http://localhost:8787
ENVIRONMENT=development
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Deploy

```bash
npm run build
npx wrangler deploy
```

## Flow

1. User clicks **Continue with Google** → `GET /api/auth/google/start`
2. Worker sets a short-lived HttpOnly OAuth state cookie and redirects to Google
3. Google redirects to `GET /api/auth/google/callback?code=...&state=...`
4. Worker validates state, exchanges the code, requires `email_verified`, finds/creates the D1 user, creates the same session cookie, redirects to `/app?auth=success`

## Local development

- **Production login:** Google OAuth (requires credentials in `.dev.vars`)
- **Dev-only fallback:** magic-link via `AUTH_DEV_MODE=true` and **Development email login** in Profile

Do not set `AUTH_DEV_MODE` in production.
