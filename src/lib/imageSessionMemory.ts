// What the message box remembers about Images while the page is open: how many bytes of Images each session has
// been sent (for the ~20 MB warning) and which sessions already showed the one-time hint. A reload forgets both.

const sentBytes = new Map<string, number>()
const hinted = new Set<string>()

/** Bytes of Images sent in this session since the page opened. */
export const sessionImageBytes = (sessionKey: string) => sentBytes.get(sessionKey) ?? 0

export function recordSentImageBytes(sessionKey: string, bytes: number) {
  sentBytes.set(sessionKey, sessionImageBytes(sessionKey) + bytes)
}

export const wasHinted = (sessionKey: string) => hinted.has(sessionKey)

export function markHinted(sessionKey: string) {
  hinted.add(sessionKey)
}

/** A new session was started from a message box that had shown the hint: the hint now belongs to that session. */
export function transferHint(fromKey: string, toKey: string) {
  if (!hinted.delete(fromKey)) return
  hinted.add(toKey)
}

/** Forgets everything; for tests, which share one page. */
export function forgetImageSessions() {
  sentBytes.clear()
  hinted.clear()
}
