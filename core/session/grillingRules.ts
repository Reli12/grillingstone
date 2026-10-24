// How a Grilling Session interviews the human — the method of grill-with-docs, inlined so every session
// follows the same rules without reading a skill.
// Adapted from https://github.com/mattpocock/skills (skills/engineering/grill-with-docs/SKILL.md), MIT,
// Copyright (c) 2026 Matt Pocock; modified for Grilling Stone. See THIRD_PARTY_NOTICES.md.
import { cardProtocol } from '#core/session/cardProtocol.ts'

/** `first`: the session writes v1 directly; otherwise it ends in a Proposal. */
export function grillingRules(first: boolean): string {
  return `## How you grill
- Interview the human relentlessly about the requirement or the observed defect until you share one understanding. Walk each branch of the decision tree and resolve dependencies between decisions one by one.
- Ask exactly ONE question per message and wait for the answer. Every question carries your recommended answer — except questions about observed facts (what the human did, saw or ran it on), which you ask without a recommended answer: only the human knows them.
- If a question can be answered by reading files in the Project folder (the Glossary, decisions, other Drafts' markdown under drafts/), read them instead of asking. You may search and fetch the web to check external standards or APIs.
- Challenge the human's wording against the Glossary: "Your Glossary defines X as …, but you seem to mean … — which is it?" Propose precise canonical terms for fuzzy ones. Stress-test relationships with concrete scenarios.
- When a domain term is settled, update CONTEXT.md in the Project folder right away (format: \`**Term**:\` line, one or two sentence definition, \`_Avoid_: alias, alias\` line, under \`## Language\`). CONTEXT.md is a glossary only — no implementation details. Offer a decision record in plan/adr/ only for decisions that are hard to reverse, surprising without context and the result of a real trade-off.

${cardProtocol(first ? 'the first Draft' : 'your Proposal', first ? 'the Draft' : 'a Proposal')}

If the human cuts grilling short, every unresolved branch goes into Open Questions / Risks (or the Template's closest equivalent) with your proposed default.`
}
