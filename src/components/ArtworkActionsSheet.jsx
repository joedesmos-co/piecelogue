import ActionSheet, { ActionSheetButton } from './ActionSheet'

export default function ArtworkActionsSheet({
  isOpen,
  artwork,
  onClose,
  onMove,
  onEdit,
  onToggleFavorite,
  onDelete,
}) {
  if (!artwork) {
    return null
  }

  return (
    <ActionSheet isOpen={isOpen} title={artwork.title} onClose={onClose}>
      <ActionSheetButton onClick={() => onMove(artwork)}>Move to folder</ActionSheetButton>
      <ActionSheetButton onClick={() => onEdit(artwork)}>Edit</ActionSheetButton>
      <ActionSheetButton onClick={() => onToggleFavorite(artwork)}>
        {artwork.favorite ? 'Remove favorite' : 'Add favorite'}
      </ActionSheetButton>
      <ActionSheetButton variant="danger" onClick={() => onDelete(artwork)}>
        Delete
      </ActionSheetButton>
    </ActionSheet>
  )
}
