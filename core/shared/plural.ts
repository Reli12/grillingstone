/** "1 Section", "3 Sections". */
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
