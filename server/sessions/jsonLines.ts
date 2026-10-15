// Reading an Assistant's stdout as newline-delimited JSON: Claude Code's stream-json and Codex's JSON-RPC
// both send one JSON object per line, split across chunks however the pipe delivers them.

/** Turns stdout chunks into parsed JSON lines; lines that are not JSON are skipped. */
export function jsonLines(onEvent: (event: Record<string, unknown>) => void) {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    let newlineAt: number
    while ((newlineAt = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineAt).trim()
      buffer = buffer.slice(newlineAt + 1)
      if (!line) continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(line) as Record<string, unknown>
      } catch {
        // An Assistant may print a non-JSON line (a warning, say); it carries no event, so it is skipped.
        continue
      }
      onEvent(event)
    }
  }
}
