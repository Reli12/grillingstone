// Remembers the last Project opened, so the header and home page can return to it.
const STORAGE_KEY = 'pbi.lastProject'

export const rememberProject = (projectId: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, projectId)
  } catch {
    // Storage can be blocked (private mode, policy); the app then just doesn't remember the Project.
  }
}

export const lastProject = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    // Blocked storage reads as "no Project remembered yet".
    return null
  }
}
