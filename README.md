# Piecelogue

A local-first web app for artists to log artwork, organize pieces into folders, and track creative progress. All data is stored in your browser using IndexedDB.

**Live site:** [piecelogue.com](https://piecelogue.com)

## Routes

| Path | Purpose |
|---|---|
| `/` | Public landing page |
| `/app` | Local-first Piecelogue application |
| `/about` | About page |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/contact` | Contact page |

## Features

- Gallery with artwork cards and full-screen image lightbox
- Folders for organizing artwork
- Add, edit, and delete artwork with images, medium details, time tracking, and notes
- Statistics page for lifetime creative metrics
- Settings with local storage information
- Public landing page and informational pages

## Tech stack

- React 19 + Vite 8
- Dexie (IndexedDB)
- Plain CSS, mobile-first layout
- Deployed to Cloudflare Workers Static Assets

## Development

```bash
npm install
npm run dev
```

## Build and deploy

```bash
npm run lint
npm run build
npx wrangler deploy
```

Static files (`sitemap.xml`, `robots.txt`, `ads.txt`) are copied from `public/` into `dist/` during build.

## Cloudflare Workers foundation (Phase 2)

This project is deployed using Cloudflare Workers + “Static Assets”, with a Worker entry point at `src/worker/index.js`.

- Static assets (the SPA) are served from `./dist`
- API routes under `/api/*` are handled by the Worker
- `GET /api/health` returns:
  - `ok: true`
  - `app: "Piecelogue"`
  - `version: "0.1.0"`

### D1 + R2 placeholders

`wrangler.jsonc` includes placeholder bindings for:

- D1 database binding: `DB`
- R2 bucket binding: `ARTWORK_BUCKET`

You must create the D1 database and R2 bucket in Cloudflare and then replace the placeholder values in `wrangler.jsonc`.

### Create D1 and apply migrations (later)

```bash
npx wrangler d1 create piecelogue
npx wrangler d1 migrations apply piecelogue --remote
```

Migrations live in `./migrations`.

### Create R2 bucket (later)

```bash
npx wrangler r2 bucket create piecelogue-artworks
```

Replace `bucket_name` in `wrangler.jsonc` with the exact created bucket name.

## Data storage

The current version stores all artwork images and metadata locally in your browser. There is no cloud sync or user accounts yet. Clearing browser data may remove your library. The app at `/app` uses the same origin IndexedDB as before — moving routes does not reset data.

## License

Private project.
