// What every headless session shares with the tool (ADR-0010): the seed it starts from, the fenced JSON
// cards it asks with, the "Write it now." confirmation, and the one submit command it may run.

export interface Seed {
  /** Appended to Claude Code's system prompt: stable rules, Template and method. */
  systemPrompt: string
  /** The first user message: the Project context and the task. */
  firstMessage: string
}

/** Sent as the human's message when they confirm the Ready Check or press "Enough — write it". */
export const WRITE_NOW_MESSAGE = 'Write it now.'
export const QUESTION_FENCE = 'pbi-question'
export const READY_FENCE = 'pbi-ready'

/** The folder, inside a session's working folder, that holds submission files. */
export const SUBMIT_DIR = '.submit'

/**
 * Where a session writes its submission (relative to its working folder) before running the submit command.
 * The JSON travels in a file, not the command line: Windows mangles commands longer than about 8,000 characters.
 * One file per session, because Grilling Sessions on different Drafts of a Project share the Project folder.
 */
export const submitPayloadFile = (sessionId: string) => `${SUBMIT_DIR}/${sessionId}.json`

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

/** How a session submits: the command it may run and the file it writes first. */
export interface SubmitProtocol {
  submitCommand: string
  /** The session's own submission file, from submitPayloadFile. */
  payloadFile: string
}

/** The two submit steps — shared by Grilling and Template Sessions. */
export function submitSteps({ submitCommand, payloadFile }: SubmitProtocol, what: string): string {
  return `When the human has confirmed, submit ${what} in two steps:

1. Write the JSON to ${payloadFile} with the Write tool.
2. Run exactly this Bash command, nothing else: ${submitCommand}`
}

/** What a session does with the submit command's answer. */
export const submitOutcomeRules = (payloadFile: string) =>
  `The tool validates the submission. It prints ACCEPTED, or REFUSED with the reasons. On REFUSED, fix every reason by editing ${payloadFile} (Edit is fine; there is no need to rewrite it) and run the command again.
Never submit a test or partial payload, and never submit before the human confirms. Write the full content; there is no size limit.
If the command fails with anything other than ACCEPTED or REFUSED, do not guess at a cause or retry with changes; tell the human the exact error and stop.`
