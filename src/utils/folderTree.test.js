import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getFolderBreadcrumbs,
  isFolderDescendant,
  wouldCreateFolderCycle,
} from './folderTree.js'

const folders = [
  { id: 'root-1', name: 'Sketches', parentFolderId: null },
  { id: 'child-1', name: 'Character Designs', parentFolderId: 'root-1' },
  { id: 'child-2', name: 'Landscapes', parentFolderId: 'root-1' },
  { id: 'grandchild-1', name: 'Portraits', parentFolderId: 'child-1' },
]

describe('folderTree', () => {
  it('builds breadcrumbs from root to nested folder', () => {
    assert.deepEqual(getFolderBreadcrumbs('grandchild-1', folders), [
      { id: 'root-1', name: 'Sketches' },
      { id: 'child-1', name: 'Character Designs' },
      { id: 'grandchild-1', name: 'Portraits' },
    ])
  })

  it('detects descendants', () => {
    assert.equal(isFolderDescendant('grandchild-1', 'root-1', folders), true)
    assert.equal(isFolderDescendant('child-2', 'child-1', folders), false)
  })

  it('prevents folder cycles', () => {
    assert.equal(wouldCreateFolderCycle('root-1', 'root-1', folders), true)
    assert.equal(wouldCreateFolderCycle('root-1', 'grandchild-1', folders), true)
    assert.equal(wouldCreateFolderCycle('root-1', 'child-2', folders), true)
    assert.equal(wouldCreateFolderCycle('child-1', 'root-1', folders), false)
  })
})
