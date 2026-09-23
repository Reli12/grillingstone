const KEY = 'pbi.lastProject'

export const rememberProject = (projectId: string) => {
  try {
    localStorage.setItem(KEY, projectId)
  } catch {
    /* storage unavailable */
  }
}

export const lastProject = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
