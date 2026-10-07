// English plurals for counts shown to the human and to Claude.

/** "1 Section", "3 Sections". */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`
