// The one error type the sessions layer throws; server/http/errors.ts answers it with a 409.
/** A session request that cannot be honoured right now (one is already running, nothing to write, …). */
export class SessionError extends Error {}
