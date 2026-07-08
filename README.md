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

## Data storage

The current version stores all artwork images and metadata locally in your browser. There is no cloud sync or user accounts yet. Clearing browser data may remove your library. The app at `/app` uses the same origin IndexedDB as before — moving routes does not reset data.

## License

Private project.
