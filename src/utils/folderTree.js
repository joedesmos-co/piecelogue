export function normalizeParentFolderId(parentFolderId) {
  if (parentFolderId === '' || parentFolderId === undefined) {
    return null
  }
  return parentFolderId
}

export function buildFolderMap(folders) {
  return new Map(folders.map((folder) => [folder.id, folder]))
}

export function getFolderBreadcrumbs(folderId, folders) {
  const folderMap = buildFolderMap(folders)
  const crumbs = []
  const visited = new Set()
  let currentId = folderId

  while (currentId) {
    if (visited.has(currentId)) {
      break
    }
    visited.add(currentId)

    const folder = folderMap.get(currentId)
    if (!folder) {
      break
    }

    crumbs.unshift({ id: folder.id, name: folder.name })
    currentId = normalizeParentFolderId(folder.parentFolderId)
  }

  return crumbs
}

export function getFolderPathLabel(folderId, folders, separator = ' / ') {
  return getFolderBreadcrumbs(folderId, folders)
    .map((crumb) => crumb.name)
    .join(separator)
}

export function isFolderDescendant(folderId, potentialAncestorId, folders) {
  if (!folderId || !potentialAncestorId) {
    return false
  }

  const folderMap = buildFolderMap(folders)
  const visited = new Set()
  let currentId = folderId

  while (currentId) {
    if (currentId === potentialAncestorId) {
      return true
    }
    if (visited.has(currentId)) {
      return false
    }
    visited.add(currentId)

    const folder = folderMap.get(currentId)
    if (!folder) {
      return false
    }

    currentId = normalizeParentFolderId(folder.parentFolderId)
  }

  return false
}

export function wouldCreateFolderCycle(folderId, newParentFolderId, folders) {
  const parentId = normalizeParentFolderId(newParentFolderId)

  if (!folderId) {
    return false
  }

  if (!parentId) {
    return false
  }

  if (parentId === folderId) {
    return true
  }

  return isFolderDescendant(parentId, folderId, folders)
}

export function getDescendantFolderIds(folderId, folders) {
  const descendants = []
  const queue = [folderId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    const children = folders.filter(
      (folder) => normalizeParentFolderId(folder.parentFolderId) === currentId,
    )

    for (const child of children) {
      descendants.push(child.id)
      queue.push(child.id)
    }
  }

  return descendants
}

export function getFolderPickerOptions(folders, { excludeFolderIds = [] } = {}) {
  const excluded = new Set(excludeFolderIds)

  return folders
    .filter((folder) => !excluded.has(folder.id))
    .map((folder) => ({
      id: folder.id,
      label: getFolderPathLabel(folder.id, folders),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
