/** Nothing stored under that id (or the id is not a safe file name). */
export class NotFound extends Error {}
/** A save was made against a version that has changed since. */
export class StaleWrite extends Error {}
