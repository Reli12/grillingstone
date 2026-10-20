// The names of what the app keeps in a Project folder, shared by storage (which writes them) and the Codex sandbox
// profile (which keeps a Linux session from writing them), so the two can never drift apart.

export const PROJECT_FILE = 'project.json'
export const DRAFTS_FOLDER = 'drafts'
export const TRANSCRIPTS_FOLDER = 'transcripts'

/** The Project folder's entries the app owns: the Project file, its Drafts and its Transcripts. */
export const PROJECT_APP_ENTRIES = [PROJECT_FILE, DRAFTS_FOLDER, TRANSCRIPTS_FOLDER] as const
