import ActionSheet, { ActionSheetButton } from './ActionSheet'
import { getFolderPickerOptions } from '../utils/folderTree'

export default function MoveToFolderSheet({
  isOpen,
  artwork,
  folders,
  onClose,
  onMove,
  moving = false,
}) {
  if (!artwork) {
    return null
  }

  const options = getFolderPickerOptions(folders)

  return (
    <ActionSheet isOpen={isOpen} title={`Move “${artwork.title}”`} onClose={onClose}>
      <ActionSheetButton
        onClick={() => {
          onMove(artwork, null)
        }}
        disabled={moving || !artwork.folderId}
      >
        Unfiled (no folder)
      </ActionSheetButton>
      {options.map((option) => (
        <ActionSheetButton
          key={option.id ?? 'root'}
          onClick={() => {
            onMove(artwork, option.id)
          }}
          disabled={moving || option.id === artwork.folderId}
        >
          {option.label}
        </ActionSheetButton>
      ))}
    </ActionSheet>
  )
}
