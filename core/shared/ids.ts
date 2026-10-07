// Id generation shared by every domain object, so ids are short, unique and show what they point at.
const RANDOM_PART_LENGTH = 10

/** Short random id with a readable prefix (d = Draft, s = Section, e = Entry, c = Change, p = Proposal …). */
export const newId = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, RANDOM_PART_LENGTH)}`
