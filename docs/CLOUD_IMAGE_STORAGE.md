# Cloud image storage (review build, not deployed)

## Pipeline audit

Previously, the import UI normalized the file to JPEG, then artwork persistence normalized it again. The resulting local JPEG (up to 4096px, quality .92) was also the full-size R2 upload. Original source bytes were no longer retained. Gallery thumbnails were 640px JPEG at .84. Detail/lightbox used the original slot. Normal restore copied original bytes but redundantly generated a thumbnail; cloud repair and legacy storage migration re-encoded downloaded/stored bytes. Backup import also re-encoded. Both background and forced sync uploaded local-original bytes through the authenticated `/original` route.

## Implemented policy

- New imports retain the untouched file in IndexedDB `artworkImages` with kind `source`. A compatible JPEG local viewing copy remains in `original`, and the existing 640px JPEG thumbnail remains in `thumbnail`.
- New/replaced imports pass the actual File to persistence rather than passing an already encoded preview. The preview is separate.
- Cloud preparation reads the source file when its hash association matches the local viewing copy; otherwise it reads the existing local original. It never uses a thumbnail as its full-size source.
- Cloud display: maximum edge 2048px, WebP quality .90. Aspect ratio is preserved, small images never upscale. Native encoder output is checked. Unsupported WebP (including PNG fallback or encoder exceptions) uses JPEG quality .90.
- If the 2048px output exceeds 1 MiB, a 1600px candidate is generated from the same decoded source at the same quality. There is a 2 MiB output ceiling; preparation failure leaves local files intact and never falls back to uploading the large source.
- AVIF is not enabled: the existing upload allowlist excludes it and the stack has no AVIF encoder. Canvas WebP/JPEG avoids a runtime codec dependency. Native canvas type fallback behavior is documented at https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob.
- Existing white compositing of transparent sources and first-frame handling of animated sources are retained. Cloud display is not intended to replace print masters or extreme-zoom originals.
- Display bytes are cached in IndexedDB as kind `display`, associated with the local viewing image SHA-256 and policy version 1. Metadata-only changes, upload retries and future syncs reuse that cache. Replacement invalidates it atomically with the image writes. The source hash prevents an older client's image replacement from accidentally using a stale raw source.
- Background and forced sync both use the same cloud source resolver. Successful-request hashes describe transmitted display bytes. Forced sync does not later recompute hashes from a possibly changed local image.
- Restore and repair copy downloaded original/display and thumbnail bytes verbatim and mark origin `cloud`. Cloud origin prevents encoding even if the display cache is missing. Old JPEG/PNG cloud objects receive the same protection.
- A restored display goes into the existing local `original` viewing slot, so detail/fullscreen continue to prefer it over the thumbnail. Existing untouched local sources survive cloud restore. Missing thumbnails are generated only when needed, without also encoding an unused original.
- Legacy blob-to-byte migration now preserves bytes. Local backup exports/imports optional source/display/provenance fields and copies them verbatim. Importing an older backup does not discard an existing local source.

## Compatibility and migration

No D1 SQL migration, Dexie version bump, new R2 binding or endpoint is required. Auth, credentials, queue ordering, conflict handling and account tiers are unchanged. The existing `/original`, `hasOriginal` and `original_object_key` names remain for compatibility; their contents may now be a high-quality display copy. The R2 response Content-Type is authoritative, not the key extension.

When a local-original device next uploads an image (including an explicit Force Save), its display replaces the referenced R2 object **at the existing key**. This prevents leaving a large `original.jpg` orphan when its replacement is WebP. R2 must finish before the metadata update completes. New artworks use the existing MIME-based key naming. Old clients can still read and upload using the same endpoints. Old clients may still upload larger originals; enforcing the new policy server-side would be a separate versioned rollout.

Existing, already-synced images are not silently re-queued just by opening the upgraded app. To reclaim their space after approval and deployment, use Force Save on the device holding local originals. This is a resumable, idempotent lazy migration: successful candidates are cached; interrupted uploads retry the same bytes and key. The local originals are retained.

A library held only in cloud remains usable without any backfill. Downloaded legacy objects are deliberately not transcoded on normal sync. Reclaiming those bytes would require a separately approved one-time backfill from the authoritative old objects, with measured quality, a versioned manifest and rollback copies. No bulk backfill or orphan sweep is included or executed here. Files already discarded by the previous import flow cannot be reconstructed; existing local JPEGs are kept, and exact raw-file preservation applies to new imports/reselections.

## Measured existing-image results

Three active R2 originals and thumbnails were read for measurement on 2026-10-11. No production writes were made. Chromium ran the actual browser encoder. Sizes below are decimal bytes and retain the **existing** thumbnail bytes rather than counting a newly generated thumbnail.

| Existing sample | Existing original | Existing thumbnail | New WebP display | New cloud total | Total reduction |
|---|---:|---:|---:|---:|---:|
| Large image 1 | 2,066,307 | 33,703 | 208,616 | 242,319 | 88.5% |
| Small image | 7,705 | 7,431 | 2,740 | 10,171 | 32.8% |
| Large image 2 | 2,129,938 | 47,384 | 285,864 | 333,248 | 84.7% |

The two large images total 4,277,332 bytes today and 575,567 bytes with display copies + unchanged thumbnails: **86.5% reduction, 7.4× smaller**. JPEG fallback totals 853,036 bytes including those thumbnails: **80.1% reduction, 5.0× smaller**. At that measured mix, 1,000 artworks would use roughly 288 MB instead of 2.14 GB. Actual sizes depend on artwork complexity.

Large-image outputs retained 2048px longest edges (1536×2048 and 1152×2048). PSNR was 43.35 and 42.83 dB; mean 8×8 luminance SSIM was .9774 and .9853 against the source resized to the same output dimensions. These are encoding checks at display resolution, not proof that resized images retain every original pixel. Side-by-side laptop-size comparisons were visually inspected and showed no noticeable degradation. A physical iPhone/Safari end-to-end run was not performed; JPEG fallback was exercised with the real browser encoder and simulated lack of WebP export.

## Verification

- `npm test`: 357 tests, including encoding policy, source selection, no double encoding, legacy objects, restored cache eviction, original preservation, backup provenance, source changes during encoding, transmitted hashes, R2 replacement and storage failure behavior.
- `npm run test:images`: real Chromium canvas/IndexedDB tests using a deterministic art fixture; byte-size, dimensions, PSNR and SSIM assertions, plus 15 integration checks for import, forced/background upload, deduplication, restore, backup and unchanged re-upload.
- Existing production samples were also passed through the browser harness read-only; all quality/size assertions passed.
- `npm run lint`, `npm run build`, `git diff --check`: passed. Build retains its existing non-blocking mixed static/dynamic import warnings.

For browser tests, install the development dependencies and run `npx playwright install chromium` once. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` may select an existing Chromium executable. Optional image paths after `npm run test:images --` are measured read-only. Set `CLOUD_IMAGE_REPORT_DIR` to save measurements and side-by-side previews outside the repository. No private artwork fixtures are committed.

Deployment, production backfill, commits and pushes have not been performed.
