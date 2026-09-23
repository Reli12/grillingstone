# Whetstone

A tool that runs only on the user's own machine, where a human and Claude grill a requirement into a single written work item, which the human then edits and arranges before it is published.

## Language

**Work Item Type**:
The kind of item being written: Epic, Feature or PBI. Chosen once, before grilling starts, and fixes what the Draft must contain.
_Avoid_: level, kind, ticket type

**Grilling Session**:
One conversation with Claude that interrogates a requirement until it is understood well enough to write down.
_Avoid_: chat, run, interview

**Draft**:
The single document a Grilling Session produces, for one Work Item Type. It is a candidate for discussion and editing, not yet a published work item.
_Avoid_: output, file, result, PBI (when it is not yet published)

**Template**:
The ordered set of Sections a Draft of one Work Item Type is written in, plus the writing method used to fill them. Chosen by the human when a Draft is created. The tool ships a Default Template per Work Item Type; humans create, edit and share others.
_Avoid_: format, layout, schema

**Template Session**:
A conversation with Claude that interrogates how a team writes one Work Item Type until it can be written down as a Template. Belongs to no Project and is never challenged against a Glossary; it may start from an existing Template and from example work items the human pastes.
_Avoid_: template wizard, template grilling, template builder

**Default Template**:
The Template the tool ships for a Work Item Type (for a PBI: based on `frontend-pbi`). Preselected, read-only and never deletable.
_Avoid_: built-in, standard template

**Section**:
One named part of a Draft (e.g. Scope, Open Questions / Risks, Acceptance Criteria). The unit a human reorders, edits or discards.
_Avoid_: part, block, chapter

**Locked Section**:
A Section the human may edit and move but never discard, because a Draft without it is not a valid work item of its type (for a PBI: User Story, Acceptance Criteria).
_Avoid_: required section, mandatory section

**Entry**:
One item inside a list-shaped Section — a single Acceptance Criterion, Open Question or Dependency. Can be reordered or discarded on its own.
_Avoid_: row, bullet, item

**Project**:
A body of work that shares one domain language (e.g. "Customer Portal", "Billing Platform"). Groups Drafts and owns one Glossary. Not a code repository.
_Avoid_: repo, workspace, product, client

**Glossary**:
The domain terms settled across a Project's Grilling Sessions (e.g. what "Archived Device" means). May start as a copy of a glossary the human brings or of another Project's Glossary; from then on it is this Project's own and changes independently. Belongs to the Project, never to this tool; visible and editable by the human, and every later session in the Project is challenged against it.
_Avoid_: context, dictionary, terms file

**Reference**:
An optional, human-chosen link from one Draft to another whose current content a Grilling Session may read as context. Carries no hierarchy and no obligation; every Draft stands on its own.
_Avoid_: parent, child, link, dependency

**Discarded**:
The state of a Section or Entry the human removed from a Draft. Hidden and excluded from publishing, but kept and restorable, and visible to later sessions as a judgement not to repeat.
_Avoid_: deleted, removed, rejected

**Ready Check**:
Claude's question, when it believes it understands enough, asking whether the human has anything to add before it writes. Claude never writes a Draft or Proposal without the human confirming — either by answering the Ready Check or by asking to write at any moment.
_Avoid_: confirmation, final check

**Transcript**:
The tool's own record of one Grilling Session's conversation, kept with the Draft for reading back. Never fed to Claude; a Continuation resumes Claude Code's own conversation instead.
_Avoid_: chat log, history, session file

**Publish**:
Creating (or updating) the Azure DevOps work item from a Draft, through an Azure DevOps MCP server. Planned for v2. Only non-Discarded content is published, in the human's order.
_Avoid_: export, push, sync

### Changing a Draft after v1

**Proposal**:
The set of changes a Grilling Session suggests to an existing Draft. Never applied on its own; the human triages it.
_Avoid_: suggestion, patch, update

**Clean Change**:
A change in a Proposal that touches only content Claude wrote and the human never edited, moved or discarded. Can be accepted in bulk.
_Avoid_: safe change, auto change

**Conflict**:
A change in a Proposal that touches content the human edited, moved or discarded — including any attempt to bring back something Discarded. Always decided one at a time.
_Avoid_: collision, merge conflict

**Iteration**:
A new version of a Draft, created when a Proposal is accepted; recorded as a line in the Draft's Iteration Log.
_Avoid_: revision, round, run

**Continuation**:
A Grilling Session that picks up an ended one's conversation (Claude remembers it), yet still starts from the current Draft, Glossary and References, which win over anything said before. After v1 it can only produce a Proposal.
_Avoid_: resume, reopen, restart

**Focused Session**:
A Grilling Session scoped to one Section or Entry of an existing Draft. Its Proposal may also suggest knock-on changes elsewhere.
_Avoid_: sub-session, partial session

## Relationships

- A **Project** has many **Drafts** and exactly one **Glossary**.
- A **Draft** may hold any number of **References** to other **Drafts** in the same Project; none is required.
- A **Draft** belongs to exactly one **Project** and has exactly one **Work Item Type**.
- The first **Grilling Session** on a **Draft** writes v1 directly; every later session produces a **Proposal**, and each accepted **Proposal** is one **Iteration**.
- A **Proposal** is split into **Clean Changes** and **Conflicts**.
- A **Draft** has many **Grilling Sessions** over its life. Each session starts from the current **Draft**, the **Glossary** and the Draft's **References**. An ended session may be picked up by a **Continuation**, which also has the earlier chat but is told the current Draft wins. Every session's **Transcript** stays read-only.
- A **Work Item Type** has many **Templates**, exactly one of which is its **Default Template**; a **Template** defines many **Sections**.
- A **Draft** is written in exactly one **Template**, chosen when the Draft is created, and keeps a snapshot of it. Later edits to the **Template** affect only new **Drafts**; an existing **Draft** moves to a newer Template version only through an explicit upgrade, which arrives as a **Proposal**.
- A **Default Template** is read-only; customizing means duplicating it into a new **Template**.
- A **Template Session** produces at most one **Template**; it never touches a **Project**, **Draft** or **Glossary**.
- A **Section** holds either prose or many **Entries**, and names the Azure DevOps field it is **Published** into.
- A **Draft** has a title of its own, outside its **Sections**.
- The **Template** decides what Claude must write and in what order; the human decides what the **Draft** finally keeps and in what order. Claude never omits a Section — an empty one says so, with a reason.

## Example dialogue

> **Dev:** "I grilled the export requirement as a Feature — is the Draft ready to publish?"
> **Domain expert:** "Not yet. It's still a Draft until we've reordered the acceptance criteria and dropped the scope section we disagreed on."
