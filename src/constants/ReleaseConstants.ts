// The version this build is, and where its release notes live.

/** The running version as its release tag, e.g. `v1.0.0`; Vite injects it from package.json at build time. */
export const APP_VERSION = `v${__APP_VERSION__}`

/** The GitHub Release for this version, whose notes say what changed in it. */
export const RELEASE_NOTES_URL = `https://github.com/Reli12/grillingstone/releases/tag/${APP_VERSION}`
