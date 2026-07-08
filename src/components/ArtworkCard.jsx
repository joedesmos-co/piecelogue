import { Heart, Clock, Folder } from 'lucide-react'
import { formatTime } from '../utils/formatTime'
import { resolveMediumType } from '../utils/constants'
import { getGalleryImageBlobs } from '../utils/imageUtils'
import { getFolderPathLabel } from '../utils/folderTree'
import ArtworkImage from './ArtworkImage'

export default function ArtworkCard({ artwork, folders = [], onClick }) {
  const imageBlobs = getGalleryImageBlobs(artwork)
  const folderName = artwork.folderId ? getFolderPathLabel(artwork.folderId, folders) : null

  return (
    <button
      type="button"
      className="artwork-card"
      onClick={() => onClick(artwork)}
      aria-label={`View ${artwork.title}`}
    >
      <div className="artwork-card-image-wrap">
        <ArtworkImage
          blobs={imageBlobs}
          alt=""
          className="artwork-card-image"
          fallbackClassName="artwork-card-placeholder"
          loading="lazy"
          iconSize={28}
        />
        {artwork.favorite && (
          <span className="artwork-card-favorite" aria-hidden="true">
            <Heart size={14} fill="currentColor" />
          </span>
        )}
      </div>
      <div className="artwork-card-body">
        <h3 className="artwork-card-title">{artwork.title}</h3>
        <div className="artwork-card-meta">
          <span className="badge badge--medium-type">{resolveMediumType(artwork)}</span>
          {artwork.status && (
            <span
              className={`badge badge--status badge--${artwork.status === 'Finished' ? 'finished' : 'progress'}`}
            >
              {artwork.status}
            </span>
          )}
        </div>
        <div className="artwork-card-details">
          {artwork.medium && (
            <span className="artwork-card-detail">{artwork.medium}</span>
          )}
          {folderName && (
            <span className="artwork-card-detail artwork-card-folder">
              <Folder size={12} aria-hidden="true" />
              {folderName}
            </span>
          )}
          {(artwork.totalMinutes > 0) && (
            <span className="artwork-card-time">
              <Clock size={12} aria-hidden="true" />
              {formatTime(artwork.totalMinutes)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
