// The name a downloaded Prototype is saved under: `<Draft title> – v<N> – <YYYY-MM-DD HH.mm>.html`. The title is made
// safe for file names; the time is the server's local time, which is the human's, as the whole tool runs on their machine.

/** Longest title kept in the name, so the whole name stays well inside every file system's limit. */
const MAX_TITLE_LENGTH = 100
/** What a Draft without a title is called in a file name. */
const UNTITLED = 'Untitled Draft'
const SEPARATOR = ' – '

// Characters no common file system allows in a name, and control characters.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_IN_FILE_NAMES = /[\\/:*?"<>|\u0000-\u001f\u007f]/g
const WHITESPACE_RUN = /\s+/g
// Dots at the start would make a hidden file; at the end Windows drops them.
const EDGE_DOTS = /^\.+|\.+$/g

const pad = (value: number) => String(value).padStart(2, '0')

/** A Draft title as a file name part: forbidden characters become spaces, white space collapses, length is capped. */
export function safeFileTitle(title: string): string {
  const cleaned = title
    .replace(FORBIDDEN_IN_FILE_NAMES, ' ')
    .replace(WHITESPACE_RUN, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH)
    .replace(EDGE_DOTS, '')
    .trim()
  return cleaned || UNTITLED
}

/** `2026-10-25 14.05`: the local date and time of an ISO timestamp, with dots so the name has no colon. */
function fileNameTime(iso: string): string {
  const at = new Date(iso)
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${date} ${pad(at.getHours())}.${pad(at.getMinutes())}`
}

export interface PrototypeFileNameInput {
  draftTitle: string
  draftVersion: number
  /** When the Prototype was written, as an ISO timestamp. */
  writtenAt: string
}

export function prototypeFileName({ draftTitle, draftVersion, writtenAt }: PrototypeFileNameInput): string {
  return [safeFileTitle(draftTitle), `v${draftVersion}`, fileNameTime(writtenAt)].join(SEPARATOR) + '.html'
}
