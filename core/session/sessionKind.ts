// The kinds of Grilling Session, kept apart so Drafts and Proposals can name one without the session code.
/**
 * What a session on a Draft is for: write v1, grill one part, re-grill the whole Draft, move it to a newer Template,
 * or — the Import Session, which is not a Grilling Session — write an Imported Draft's v1 from its work item.
 */
export type SessionKind = 'first' | 'focused' | 'iteration' | 'upgrade' | 'import'

/** The kinds that write v1 directly; every other kind returns a Proposal. */
export const writesV1 = (kind: SessionKind) => kind === 'first' || kind === 'import'
