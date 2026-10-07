// The kinds of Grilling Session, kept apart so Drafts and Proposals can name one without the session code.
/** What a Grilling Session is for: write v1, grill one part, re-grill the whole Draft, or move it to a newer Template. */
export type SessionKind = 'first' | 'focused' | 'iteration' | 'upgrade'
