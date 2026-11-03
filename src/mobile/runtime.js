export function getNativePlatform(capacitor = globalThis.Capacitor) {
  if (!capacitor || typeof capacitor.isNativePlatform !== 'function') {
    return 'web'
  }

  if (!capacitor.isNativePlatform()) {
    return 'web'
  }

  if (typeof capacitor.getPlatform !== 'function') {
    return 'native'
  }

  const platform = capacitor.getPlatform()
  if (platform === 'ios' || platform === 'android') {
    return platform
  }

  return 'native'
}

export function isNativeRuntime(capacitor = globalThis.Capacitor) {
  return getNativePlatform(capacitor) !== 'web'
}
