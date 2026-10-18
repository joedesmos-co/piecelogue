import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const constants = readFileSync(join(root, 'src', 'utils', 'constants.js'), 'utf8')
const navigation = readFileSync(join(root, 'src', 'components', 'Navigation.jsx'), 'utf8')
const localApp = readFileSync(join(root, 'src', 'LocalApp.jsx'), 'utf8')

describe('tools navigation', () => {
  it('defines TOOLS page', () => {
    assert.match(constants, /TOOLS:\s*'tools'/)
  })
  it('adds Tools to nav', () => {
    assert.match(navigation, /PAGES\.TOOLS/)
    assert.match(navigation, /label:\s*'Tools'/)
  })
  it('renders ToolsPage', () => {
    assert.match(localApp, /ToolsPage/)
    assert.match(localApp, /PAGES\.TOOLS/)
  })
})

describe('start this piece transfer', () => {
  const form = readFileSync(join(root, 'src', 'components', 'ArtworkForm.jsx'), 'utf8')
  it('accepts inspiration prop', () => {
    assert.match(form, /inspiration = null/)
  })
  it('shows INSPIRED BY', () => {
    assert.match(form, /INSPIRED BY/)
  })
})
