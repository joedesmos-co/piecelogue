import { useCallback, useEffect, useState } from 'react'
import { getSyncConflictsForUser } from '../db/syncConflictService'
import { useAuth } from '../hooks/useAuth'
import { useArtworks } from '../hooks/useArtworks'
import { useSync } from '../hooks/useSync'
import {
  summarizeArtworkConflict,
  summarizeFolderConflict,
} from '../sync/conflictLogic'
import { resolveKeepCloud, resolveKeepLocal } from '../sync/conflictResolution'
import { SYNC_ENTITY_TYPES } from '../sync/constants'
import { refreshSyncStatus, wakeSyncProcessor } from '../sync/processor'
import { formatUserError } from '../utils/userErrors'

function summarizeConflict(conflict) {
  if (conflict.entityType === SYNC_ENTITY_TYPES.FOLDER) {
    return summarizeFolderConflict(conflict.local, conflict.cloud)
  }
  return summarizeArtworkConflict(conflict.local, conflict.cloud)
}

function entityLabel(entityType) {
  return entityType === SYNC_ENTITY_TYPES.FOLDER ? 'Folder' : 'Artwork'
}

export function CloudConflictPanel() {
  const { user } = useAuth()
  const { refresh } = useArtworks()
  const { status } = useSync()
  const [conflicts, setConflicts] = useState([])
  const [loading, setLoading] = useState(false)
  const [resolvingId, setResolvingId] = useState(null)
  const [error, setError] = useState('')

  const loadConflicts = useCallback(async () => {
    if (!user?.id) {
      setConflicts([])
      return
    }

    setLoading(true)
    try {
      const records = await getSyncConflictsForUser(user.id)
      setConflicts(records)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      return undefined
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const records = await getSyncConflictsForUser(user.id)
        if (!cancelled) {
          setConflicts(records)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id, status.conflictCount])

  async function handleResolve(conflict, choice) {
    if (!user?.id) {
      return
    }

    setResolvingId(conflict.id)
    setError('')

    try {
      if (choice === 'local') {
        await resolveKeepLocal(conflict)
      } else {
        await resolveKeepCloud(conflict)
      }
      await refresh()
      await refreshSyncStatus(user.id)
      wakeSyncProcessor()
      await loadConflicts()
    } catch (err) {
      setError(formatUserError(err, 'Could not resolve conflict.'))
    } finally {
      setResolvingId(null)
    }
  }

  if (!loading && conflicts.length === 0 && status.conflictCount === 0) {
    return null
  }

  return (
    <div className="cloud-sync-conflicts">
      <p className="settings-text settings-text--muted">
        The same item was changed on another device. Choose which version to keep for each
        conflict.
      </p>

      {loading && conflicts.length === 0 ? (
        <p className="settings-text settings-text--muted" role="status">
          Loading conflicts...
        </p>
      ) : null}

      {error ? (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      ) : null}

      <ul className="sync-conflict-list">
        {conflicts.map((conflict) => {
          const summary = summarizeConflict(conflict)
          const busy = resolvingId === conflict.id

          return (
            <li key={conflict.id} className="sync-conflict-item">
              <div className="sync-conflict-item-header">
                <p className="sync-conflict-title">{summary.title}</p>
                <p className="settings-text settings-text--muted">
                  {entityLabel(conflict.entityType)} · cloud revision {conflict.cloudRevision}
                </p>
              </div>

              <div className="sync-conflict-versions">
                <div className="sync-conflict-version">
                  <p className="sync-conflict-version-label">This device</p>
                  <p className="settings-text">{summary.localSummary || '—'}</p>
                </div>
                <div className="sync-conflict-version">
                  <p className="sync-conflict-version-label">Cloud</p>
                  <p className="settings-text">{summary.cloudSummary || '—'}</p>
                </div>
              </div>

              <div className="account-actions">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={busy}
                  onClick={() => handleResolve(conflict, 'local')}
                >
                  Keep local
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={busy}
                  onClick={() => handleResolve(conflict, 'cloud')}
                >
                  Keep cloud
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
