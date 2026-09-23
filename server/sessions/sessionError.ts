/** A session request that cannot be honoured right now (one is already running, nothing to write, …). */
export class SessionError extends Error {}
