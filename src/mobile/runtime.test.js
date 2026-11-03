import assert from 'node:assert/strict'
import test from 'node:test'

import { getNativePlatform, isNativeRuntime } from './runtime.js'

test('defaults to web without Capacitor', () => {
  assert.equal(getNativePlatform(undefined), 'web')
  assert.equal(isNativeRuntime(undefined), false)
})

test('returns web when Capacitor reports a web runtime', () => {
  const capacitor = {
    isNativePlatform: () => false,
    getPlatform: () => 'web',
  }

  assert.equal(getNativePlatform(capacitor), 'web')
  assert.equal(isNativeRuntime(capacitor), false)
})

test('recognizes iOS and Android native runtimes', () => {
  const ios = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
  }
  const android = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  }

  assert.equal(getNativePlatform(ios), 'ios')
  assert.equal(getNativePlatform(android), 'android')
  assert.equal(isNativeRuntime(ios), true)
  assert.equal(isNativeRuntime(android), true)
})

test('fails safely for an unknown native platform', () => {
  const capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'unknown',
  }

  assert.equal(getNativePlatform(capacitor), 'native')
  assert.equal(isNativeRuntime(capacitor), true)
})
