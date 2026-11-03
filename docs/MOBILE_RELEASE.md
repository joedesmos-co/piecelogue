# Piecelogue mobile release plan

This document tracks the native iOS and Android release work without changing the production web app.

## Architecture decision

Piecelogue will keep the existing React + Vite application and local-first data model, then package the same application code with Capacitor for iOS and Android.

The native build must bundle the Vite output locally. It must not be a thin shell that simply opens piecelogue.com.

Native integrations will be added behind small platform adapters so the web app continues to work normally:

- camera and photo library
- native share sheet
- app lifecycle and Android back navigation
- status bar, splash screen, and safe areas
- native authentication handoff/deep-link support where required
- subscription entitlements in a later, explicitly approved phase

## Data safety rules

The existing Dexie/IndexedDB library remains the source of truth unless device testing proves a native-runtime storage problem.

Do not migrate local artwork storage merely for the sake of going native. Any future storage migration must:

1. preserve all artwork metadata, folders, images, sync state, and conflict state;
2. be reversible or recoverable;
3. be tested with an existing populated library;
4. leave the web app schema compatible.

Cloud sync remains the backup/sync layer. Production D1 and R2 must not be changed during mobile shell development without explicit approval.

## Provisional native identity

- App name: Piecelogue
- App ID / Android application ID: `com.piecelogue.app`
- Web build directory: `dist`

The App ID matches the identifier already documented for Sign in with Apple setup. It should be confirmed in the Apple Developer and Google Play consoles before the first signed release.

## Authentication

The existing Worker already has Google OAuth and Sign in with Apple server scaffolding.

Before App Store submission:

- configure the Apple App ID, Services ID, key, and Worker secrets;
- expose Continue with Apple in production;
- verify Google and Apple callbacks from the native runtime;
- verify account linking by email;
- verify sign-out, session expiry, and account deletion on physical devices.

Email magic-link UI remains development-only unless product requirements change.

## Account deletion

Piecelogue already exposes in-app cloud-data deletion and full account deletion. The backend removes cloud library data, sessions, sync events, and the user account.

Before store submission, device-test this flow and ensure Sign in with Apple authorization is also revoked when required by the final native auth implementation.

## Native milestones

### Milestone 1 — shell and preservation
- install Capacitor dependencies
- generate iOS and Android projects
- verify web build remains unchanged
- verify an existing populated IndexedDB library survives relaunch/update in both simulators

### Milestone 2 — native experience
- camera/photo library adapter with web fallback
- share adapter with web fallback
- safe areas and status/navigation bars
- Android hardware-back behavior
- lifecycle-driven sync/resume handling
- offline relaunch testing

### Milestone 3 — authentication
- native-safe Google flow
- production Sign in with Apple
- callback/deep-link handling
- account deletion and sign-out device testing

### Milestone 4 — monetization
No real billing is enabled in Phase 1.

A future entitlement layer should default to Free and use store-verified entitlements. Existing user artwork and current core capabilities must not be unexpectedly locked behind Pro.

### Milestone 5 — release
- production icon and splash assets
- privacy/app-data disclosures
- review/demo access
- TestFlight and Play internal/closed testing
- purchase/restoration sandbox testing
- release screenshots and store copy

## Release guardrails

Do not:

- deploy production backend changes from the mobile branch without approval;
- run destructive migrations;
- enable live purchases;
- submit to either store;
- replace IndexedDB without evidence that the native runtime requires it.
