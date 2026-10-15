// Which coding agent holds a session's conversation (ADR-0020), kept apart so Settings and Transcripts can name it.
/** The Assistant that runs a session: Claude Code or Codex. */
export type AssistantName = 'claude' | 'codex'
