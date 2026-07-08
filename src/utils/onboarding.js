const ONBOARDING_KEY = 'piecelogue_onboarding_complete'

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    // Ignore storage failures — onboarding can show again next visit.
  }
}
