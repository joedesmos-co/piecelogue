import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildIncompleteCloudSyncStatus,
  describeIncompleteCloudArtwork,
  findIncompleteCloudArtworks,
  isCloudArtworkImageIncomplete,
  shouldReportIncompleteCloudImages,
} from './incompleteCloudImages.js'

describe('incomplete cloud image detection', () => {
  it('detects metadata synced but original missing', () => {
    const incomplete = findIncompleteCloudArtworks([
      { id: 'a1', title: 'Mario and Yoshi', hasOriginal: false, hasThumbnail: true },
    ])

    assert.equal(incomplete.length, 1)
    assert.equal(incomplete[0].missingOriginal, true)
    assert.equal(incomplete[0].missingThumbnail, false)
    assert.equal(
      isCloudArtworkImageIncomplete({ hasOriginal: false, hasThumbnail: true }),
      true,
    )
  })

  it('detects metadata synced but thumbnail missing', () => {
    const incomplete = findIncompleteCloudArtworks([
      { id: 'a1', title: 'Sketch', hasOriginal: true, hasThumbnail: false },
      { id: 'a2', title: 'Complete', hasOriginal: true, hasThumbnail: true },
    ])

    assert.equal(incomplete.length, 1)
    assert.equal(incomplete[0].artworkId, 'a1')
    assert.equal(incomplete[0].missingThumbnail, true)
  })

  it('does not report fully synced artworks as incomplete', () => {
    const incomplete = findIncompleteCloudArtworks([
      { id: 'a1', title: 'Done', hasOriginal: true, hasThumbnail: true },
    ])
    assert.equal(incomplete.length, 0)
    assert.equal(shouldReportIncompleteCloudImages(incomplete), false)
  })

  it('builds Image upload incomplete sync status copy', () => {
    const status = buildIncompleteCloudSyncStatus([
      {
        artworkId: 'a1',
        title: 'Mario and Yoshi',
        missingOriginal: true,
        missingThumbnail: true,
      },
    ])

    assert.equal(status.state, 'image_upload_incomplete')
    assert.equal(status.label, 'Image upload incomplete')
    assert.match(status.description, /Mario and Yoshi/)
    assert.match(describeIncompleteCloudArtwork(status.incompleteCloudImages[0]), /original and thumbnail/)
  })

  it('defers incomplete reporting while image jobs are pending', () => {
    const incomplete = findIncompleteCloudArtworks([
      { id: 'a1', title: 'Pending upload', hasOriginal: false, hasThumbnail: false },
    ])
    assert.equal(
      shouldReportIncompleteCloudImages(incomplete, { hasPendingImageJobs: true }),
      false,
    )
    assert.equal(
      shouldReportIncompleteCloudImages(incomplete, { hasPendingImageJobs: false }),
      true,
    )
  })
})
