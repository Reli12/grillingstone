// A word-level diff for showing a proposed change as a proofreader would: struck-out and inserted
// words between the shared ones.

export interface DiffPart {
  op: 'same' | 'add' | 'del'
  text: string
}

const WORDS_AND_GAPS = /\s+|[^\s]+/g // alternating runs of whitespace and of everything else
/** Above this many table cells the LCS gets slow enough to notice, so the diff gives up on detail. */
const MAX_DIFF_CELLS = 400_000

const tokenize = (text: string) => text.match(WORDS_AND_GAPS) ?? []

/** The whole of `before` removed and the whole of `after` added, skipping an empty side. */
function replaceAll(before: string, after: string): DiffPart[] {
  const parts: DiffPart[] = []
  if (before) parts.push({ op: 'del', text: before })
  if (after) parts.push({ op: 'add', text: after })
  return parts
}

/** lcs[i][j] is the length of the longest common subsequence of before[i..] and after[j..]. */
function lcsTable(before: string[], after: string[]) {
  const lcs = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1))
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  return lcs
}

/** Collects tokens into parts, merging a token into the previous part when the op is the same. */
function partCollector() {
  const parts: DiffPart[] = []
  const push = (op: DiffPart['op'], text: string) => {
    const last = parts.at(-1)
    if (last?.op === op) last.text += text
    else parts.push({ op, text })
  }
  return { parts, push }
}

/** Word-level diff (LCS over words and whitespace), merged into runs. */
export function wordDiff(before: string, after: string): DiffPart[] {
  const beforeTokens = tokenize(before)
  const afterTokens = tokenize(after)
  if (beforeTokens.length * afterTokens.length > MAX_DIFF_CELLS) return replaceAll(before, after)
  const lcs = lcsTable(beforeTokens, afterTokens)

  const { parts, push } = partCollector()
  let i = 0
  let j = 0
  while (i < beforeTokens.length && j < afterTokens.length) {
    if (beforeTokens[i] === afterTokens[j]) {
      push('same', beforeTokens[i])
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('del', beforeTokens[i++])
    else push('add', afterTokens[j++])
  }
  while (i < beforeTokens.length) push('del', beforeTokens[i++])
  while (j < afterTokens.length) push('add', afterTokens[j++])
  return parts
}
