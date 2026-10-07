import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const gallerySource = readFileSync(join(root, 'src', 'pages', 'GalleryPage.jsx'), 'utf8')
const providerSource = readFileSync(
  join(root, 'src', 'context', 'ArtworkProvider.jsx'),
  'utf8',
)
const actionsSource = readFileSync(
  join(root, 'src', 'components', 'ArtworkActionsSheet.jsx'),
  'utf8',
)

describe('gallery card delete availability', () => {
  it('renders a delete confirmation outside the detail branch (gallery/folders/list)', () => {
    // Regression: Delete only worked from ArtworkDetail because the
    // ConfirmDialog lived solely in the selectedArtwork branch.
    const matches = gallerySource.match(/<ConfirmDialog[\s\S]*?deleteTarget/g) ?? []
    assert.ok(
      matches.length >= 2,
      `expected gallery + detail delete dialogs, found ${matches.length}`,
    )
  })

  it('routes card deletes through the shared removeArtwork path', () => {
    assert.match(gallerySource, /await removeArtwork\(deleteTarget\.id\)/)
    // Enqueue lives in the provider's removeArtwork (single implementation).
    assert.match(providerSource, /enqueueArtworkDeleteSync/)
    assert.match(providerSource, /await artworkService\.deleteArtwork\(id\)/)
  })

  it('action sheet offers Move, Edit, Favorite, and destructive Delete', () => {
    for (const label of ['Move to folder', 'Edit', 'favorite', 'Delete']) {
      assert.ok(actionsSource.includes(label), `action sheet missing ${label}`)
    }
    assert.match(actionsSource, /variant="danger"[\s\S]*?Delete/)
  })

  it('delete confirmation names the artwork', () => {
    assert.match(gallerySource, /delete "\$\{deleteTarget\?\.title\}"/)
  })
})
