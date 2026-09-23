/** Short random id with a readable prefix (d = Draft, s = Section, e = Entry, c = Change, p = Proposal …). */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
