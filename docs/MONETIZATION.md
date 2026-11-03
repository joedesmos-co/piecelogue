# Piecelogue monetization plan

Piecelogue should launch with a useful Free tier and an optional Pro subscription.

## Product principle

Free users should be able to keep making art and keep their library safe. Monetization must not turn the Gallery, artwork editor, image viewer, sync conflict flow, or recovery flow into ad surfaces.

### Free
- unlimited local artwork logging
- unlimited cloud backup/sync under a reasonable-use policy
- folders, notes, time tracking, favorites, core Stats
- Idea Generator, Art Challenge, Prompt Wheel, Quick Prompt
- light advertising in the native app

### Pro
- everything in Free
- no ads
- advanced progress analytics
- Year in Art / long-term comparisons
- professional portfolio exports
- premium portfolio/customization options
- richer recovery/version-history features when implemented
- future premium creator tools

Existing artwork and current core functionality must not be unexpectedly locked behind Pro.

## Pricing hypothesis

Initial test:
- $3.99/month
- $29.99/year

These are hypotheses until sandbox purchase testing and early-user research are complete.

## Unlimited cloud wording

Product marketing may say "Unlimited cloud backup" for normal artist use, but the Terms should reserve a reasonable-use/fair-use policy and technical abuse protection.

Piecelogue is an artwork library, not general-purpose file hosting. Rate limits, accepted image types, image optimization, per-file size limits, and abuse controls remain appropriate even when the user-facing storage allowance has no normal artwork-count cap.

## Ad experience

Initial ad strategy should be intentionally light.

Do not show ads:
- while editing an artwork
- before an artwork save is safely committed
- inside image fullscreen/lightbox
- during sync, repair, conflict resolution, account deletion, sign-in, backup/import, or purchase flows
- as Gallery banner clutter
- to Pro users

Initial interstitial policy:
- no interstitials during the first 3 completed artwork saves
- eligible only after a successful save, at a natural transition back to the library
- at most every third completed save
- at least 15 minutes between interstitials
- maximum 3 interstitials per local day
- never stack multiple full-screen ads
- if an ad is unavailable, continue immediately with no user penalty

Do not launch with app-open ads. Revisit only after retention data shows they would not damage the experience.

Any future inline/native ad should live on a low-stakes surface and must be visually distinct from Piecelogue content.

## Privacy and store compliance

Before enabling ads:
- integrate a mobile ad SDK only on the native builds
- implement the required consent/privacy flow for applicable regions
- complete Apple App Privacy and Google Play Data Safety disclosures for the chosen SDK
- decide whether personalized ads are worth the additional tracking/consent complexity; contextual/non-personalized ads are preferred for launch
- ensure ads are appropriate for the app age rating
- provide the required inappropriate-ad reporting path
- verify interstitial close/skip behavior and Google disruptive-ad rules
- keep advertising code out of widgets/extensions/App Clips

No ad network is enabled by this document or the Phase 1 branch.

## Economics

Cloud image optimization keeps the normal storage footprint small, so unlimited cloud backup is viable as a differentiation strategy. Advertising should be treated as general Free-tier revenue, not as a literal one-ad-per-upload storage toll.

Track:
- ad impressions per free MAU
- ad revenue per free MAU
- Pro conversion
- cloud storage GB per MAU
- R2 operation cost per MAU
- total cloud cost per free MAU
- retention impact for users exposed to ads versus users not yet exposed
