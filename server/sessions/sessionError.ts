// The error types the sessions layer throws; server/http/errors.ts answers them with a 409.
import { ASSISTANT_UNAVAILABLE } from '#core/contract/apiTypes.ts'

/** A session request that cannot be honoured right now (one is already running, nothing to write, …). */
export class SessionError extends Error {
  /** Set on errors the browser handles specially. */
  code?: string
}

/** The Assistant in Settings cannot run a session; the message is the fix, and the browser offers Settings. */
export class AssistantUnavailable extends SessionError {
  code = ASSISTANT_UNAVAILABLE
}
