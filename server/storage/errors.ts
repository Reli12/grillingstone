// The typed errors storage throws; server/http/errors.ts maps each one to an HTTP status.
/** Nothing stored under that id (or the id is not a safe file name). */
export class NotFound extends Error {}
/** A save was made against a version that has changed since. */
export class StaleWrite extends Error {}
/** A file a session can write is a link or something else that isn't a plain file, so it isn't read. */
export class UnsafeFile extends Error {}
