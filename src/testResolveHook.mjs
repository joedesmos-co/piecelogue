/**
 * Extensionless relative-import support for `node --test`.
 *
 * The app is bundled by Vite, which resolves extensionless relative imports
 * (e.g. `import { db } from './database'`). Node's ESM loader requires explicit
 * extensions, so `node --test` cannot import app modules that use them.
 *
 * Tests import this module and call `registerHooks(extensionlessResolveHooks)`
 * before dynamically importing the modules under test. Node-only; it never
 * ships in the browser bundle.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const CANDIDATE_SUFFIXES = ['.js', '.mjs', '/index.js']

export const extensionlessResolveHooks = {
  resolve(specifier, context, nextResolve) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!isRelative || /\.[a-z0-9]+$/i.test(specifier)) {
      return nextResolve(specifier, context)
    }

    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = new URL(specifier + suffix, context.parentURL)
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context)
      }
    }

    return nextResolve(specifier, context)
  },
}

export function registerExtensionlessResolver(registerHooks) {
  registerHooks(extensionlessResolveHooks)
}