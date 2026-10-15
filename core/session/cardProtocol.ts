// What every headless session shares with the tool (ADR-0010): the seed it starts from, the fenced JSON
// cards it asks with, the "Write it now." confirmation, and the one way it may submit: the submit command for
// Claude Code, the submit_draft tool for Codex (ADR-0019).

export interface Seed {
  /** The stable rules, Template and method: Claude Code's appended system prompt, Codex's developer instructions. */
  systemPrompt: string
  /** The first user message: the Project context and the task. */
  firstMessage: string
}

/** Sent as the human's message when they confirm the Ready Check or press "Enough — write it". */
export const WRITE_NOW_MESSAGE = 'Write it now.'
export const QUESTION_FENCE = 'pbi-question'
export const READY_FENCE = 'pbi-ready'

/** Delimiter of the submit command's heredoc; the Permission Guard allows exactly this form. */
export const SUBMIT_HEREDOC = 'GRILLINGSTONE_JSON'
/** The backend tool a Codex session submits through, in place of the submit command (ADR-0019). */
export const SUBMIT_TOOL = 'submit_draft'

/** How a session asks questions and runs the Ready Check — shared by Grilling and Template Sessions. */
export function cardProtocol(target: string, writeWhat: string): string {
  return `## How you talk to the tool
The human sees your messages in a chat UI that renders two kinds of fenced JSON blocks as cards. Use them exactly like this, one block per message, with any short lead-in text before it:

\`\`\`${QUESTION_FENCE}
{"question": "Who may archive a device?", "recommended": "Admin and Manager; only Admin restores", "options": ["Admin only", "Admin and Manager", "Everyone who can edit"]}
\`\`\`

"options" holds 2–4 short alternative answers (the recommended one need not be repeated). Leave out "recommended" only for questions about facts only the human knows. The human may pick one, accept the recommendation, or answer in their own words. Always use this block for a question — never write the question or its options as plain text.

When you believe you understand enough to write ${target}, run the Ready Check instead of asking another question:

\`\`\`${READY_FENCE}
{"summary": "Two or three sentences on what you are about to write."}
\`\`\`

Never write ${writeWhat} before the human confirms. Their confirmation arrives as the message "${WRITE_NOW_MESSAGE}" — either after your Ready Check, or at any moment when they cut the session short.`
}

/**
 * How a session hands its JSON to the tool: Claude Code runs the submit command (a shell prefix that reads the
 * JSON on stdin, e.g. `node "/abs/scripts/writeDraft.mjs"`), Codex calls the backend's submit tool.
 */
export type SubmitVia = { command: string } | { tool: typeof SUBMIT_TOOL }

/** The heredoc form of the one Bash command a session may run. */
export const submitUsage = (submitCommand: string, firstLine: string) =>
  `${submitCommand} <<'${SUBMIT_HEREDOC}'\n${firstLine}\n${SUBMIT_HEREDOC}`

/** The one action, besides reading and the allowed edits, a session may take. */
export const onlySubmitAction = (via: SubmitVia) =>
  'tool' in via ? `submit only through the ${via.tool} tool below` : 'run only the submit command below'

/** How to submit `what` once the human has confirmed; the JSON shape follows it in the seed. */
export function submitInstruction(via: SubmitVia, what: string, firstLine: string): string {
  if ('tool' in via)
    return `submit ${what} by calling the ${via.tool} tool with the JSON object as its "payload" argument.`
  return `submit ${what} as JSON by running exactly this Bash command (the quoted heredoc delimiter is required):

${submitUsage(via.command, firstLine)}`
}

/** What the submission's answer comes back through: the command's output, or the tool's result. */
export const submitAnswer = (via: SubmitVia) => ('tool' in via ? 'It answers' : 'It prints')
