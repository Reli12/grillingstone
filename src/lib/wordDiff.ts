export interface DiffPart {
  op: 'same' | 'add' | 'del'
  text: string
}

const tokenize = (s: string) => s.match(/\s+|[^\s]+/g) ?? []

/** Word-level diff (LCS over words and whitespace), merged into runs. */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokenize(before)
  const b = tokenize(after)
  // Guard against quadratic blow-up on very long texts: fall back to replace-all.
  if (a.length * b.length > 400_000) return [...(before ? [{ op: 'del' as const, text: before }] : []), ...(after ? [{ op: 'add' as const, text: after }] : [])]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])

  const parts: DiffPart[] = []
  const push = (op: DiffPart['op'], text: string) => {
    const last = parts.at(-1)
    if (last?.op === op) last.text += text
    else parts.push({ op, text })
  }
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', a[i++])
    else push('add', b[j++])
  }
  while (i < a.length) push('del', a[i++])
  while (j < b.length) push('add', b[j++])
  return parts
}
