# Grilling Stone

A tool that runs only on the user's own machine, where a human and an Assistant grill a requirement into a single written work item, which the human then edits and arranges before it is published.

## Language

**Work Item Type**:
The kind of item being written: Epic, Feature, PBI, Task or Bug. Epic, Feature, PBI and Task describe something to be built; a Bug describes a defect already observed. Chosen once, before grilling starts, and fixes what the Draft must contain.
_Avoid_: level, kind, ticket type

**Assistant**:
The AI the human grills with: Claude or Codex, each signed in with the human's own account. Chosen once for the whole tool in Settings, since most humans have only one of the two; every new session uses it.
_Avoid_: engine, provider, model, agent, Claude (when meaning whichever Assistant is set)

**Grilling Session**:
One conversation with the Assistant that interrogates a requirement, or an observed defect, until it is understood well enough to write down.
_Avoid_: chat, run, interview

**Draft**:
The single document a Grilling Session produces, for one Work Item Type. It is a candidate for discussion and editing, not yet a published work item.
_Avoid_: output, file, result, PBI (when it is not yet published)

**Template**:
The ordered set of Sections a Draft of one Work Item Type is written in, plus the writing method used to fill them. Chosen by the human when a Draft is created. The tool ships a Default Template per Work Item Type; humans create, edit and share others.
_Avoid_: format, layout, schema

**Template Session**:
A conversation with the Assistant that interrogates how a team writes one Work Item Type until it can be written down as a Template. Belongs to no Project and is never challenged against a Glossary; it may start from an existing Template and from example work items the human pastes.
_Avoid_: template wizard, template grilling, template builder

**Default Template**:
The Template the tool ships for a Work Item Type (for a PBI: based on `frontend-pbi`). Preselected, read-only and never deletable.
_Avoid_: built-in, standard template

**Section**:
One named part of a Draft (e.g. Scope, Open Questions / Risks, Acceptance Criteria). The unit a human reorders, edits or discards.
_Avoid_: part, block, chapter

**Locked Section**:
A Section the human may edit and move but never discard, because a Draft without it is not a valid work item of its type (for a PBI: User Story, Acceptance Criteria; for a Bug: Steps to Reproduce, Expected Result, Actual Result; for a Task: Goal, Done When).
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

**Backlog Reference**:
An optional link the human supplies from a Draft to a work item in Azure DevOps, whose current content a Grilling Session may read as context. It is read fresh at the start of every session and never stored. Like a Reference, it carries no obligation, and no hierarchy unless the human marks it as the Draft's Parent. Nothing is fetched that the human did not link. It may point into any Azure DevOps project of the connected organization, not only the Project's Backlog. It can be added or removed at any time and affects only later sessions.
_Avoid_: external reference, ADO link, linked item (that is the Linked Work Item)

**Parent**:
The one Backlog Reference the human marks as the work item this Draft belongs under in Azure DevOps (a Task under a PBI or Bug, a PBI or Bug under a Feature, a Feature under an Epic). Sessions are told about it. Publish places the Linked Work Item under it only if the item has no parent yet. It never replaces or removes a parent, which stays manual in Azure DevOps.
_Avoid_: parent link, epic link (when meaning the Draft's own setting)

**Discarded**:
The state of a Section or Entry the human removed from a Draft. Hidden and excluded from publishing, but kept and restorable, and visible to later sessions as a judgement not to repeat.
_Avoid_: deleted, removed, rejected

**Ready Check**:
The Assistant's question, when it believes it understands enough, asking whether the human has anything to add before it writes. The Assistant never writes a Draft or Proposal without the human confirming — either by answering the Ready Check or by asking to write at any moment. The one exception is an Import: starting the Import is the confirmation.
_Avoid_: confirmation, final check

**Transcript**:
The tool's own record of one Grilling Session's conversation, kept with the Draft for reading back. Never fed to the Assistant; a Continuation resumes the Assistant's own conversation instead. It records which Assistant held the conversation.
_Avoid_: chat log, history, session file

**Publish**:
Creating (or updating) the Azure DevOps work item from a Draft. The tool itself does it; the Assistant never takes part. Planned for v2. Only non-Discarded content is published, in the human's order.
_Avoid_: export, push, sync

**Backlog**:
The Azure DevOps project a Project Publishes into, within the one Azure DevOps organization the tool is connected to. A Project has at most one Backlog, and several Projects may share one. Its process must be Scrum or inherit from Scrum, since the Work Item Types are named after Scrum's.
_Avoid_: ADO project, board, (Azure DevOps) project — "Project" always means this tool's Project

**Linked Work Item**:
The one Azure DevOps work item a Draft is tied to, of the same Work Item Type. Set when the Draft is first Published, when it is Imported, or when the human links an item that already exists. Once linked, Publishing always updates that item. Unlinking never touches Azure DevOps. Within a Project, only one active Draft may be linked to a given work item.
_Avoid_: ADO id, remote item, synced item

**Import**:
Creating a Draft from an existing Azure DevOps work item. The Draft is born linked to that item. An Import Session moves the item's content into the chosen Template's Sections without rewording or adding anything. Sections the item lacks stay empty with that reason, Locked Sections included. The item's full original content is kept as the Draft's requirement. Changes made in Azure DevOps afterwards arrive only as Drift.
_Avoid_: sync, pull, clone

**Import Session**:
The short, single-turn session that writes an Imported Draft's v1. It never grills, asks or adds. It is not a Grilling Session.
_Avoid_: import grilling, conversion

**Published Snapshot**:
What Azure DevOps held for a Draft's Linked Work Item at the last Publish or link, together with that item's revision at the time. It is the baseline a Drift Check compares against.
_Avoid_: last sync, cache, remote copy

**Drift**:
A field of the Linked Work Item that someone changed in Azure DevOps since the Published Snapshot. Only fields the Template publishes count. Drift blocks the next Publish until the human decides for each field whether to overwrite it or bring the change into the Draft as a Proposal.
_Avoid_: out of sync, diff, remote changes

**Drift Check**:
Comparing a Linked Work Item with its Published Snapshot and the current Draft. It runs before every Publish that updates an item, and whenever the human asks.
_Avoid_: sync, refresh, compare

**Archived**:
The state of a whole Draft that is no longer worked on. It is read-only: it has no sessions, edits or Publish. It stays visible and can still be the target of a Reference, and the human can restore it. A Draft is Archived by the human, or with the human's confirmation when another Draft takes over its Linked Work Item. It keeps that work item only as history.
_Avoid_: deleted, closed, inactive (and never "Discarded", which is for Sections and Entries)

### Changing a Draft after v1

**Proposal**:
The set of changes a Grilling Session suggests to an existing Draft. Never applied on its own; the human triages it.
_Avoid_: suggestion, patch, update

**Clean Change**:
A change in a Proposal that touches only content the Assistant wrote and the human never edited, moved or discarded. Can be accepted in bulk.
_Avoid_: safe change, auto change

**Conflict**:
A change in a Proposal that touches content the human edited, moved or discarded — including any attempt to bring back something Discarded. Always decided one at a time.
_Avoid_: collision, merge conflict

**Iteration**:
A new version of a Draft, created when a Proposal is accepted; recorded as a line in the Draft's Iteration Log.
_Avoid_: revision, round, run

**Continuation**:
A Grilling Session that picks up an ended one's conversation (the Assistant remembers it), so only the same Assistant can continue it, yet still starts from the current Draft, Glossary and References, which win over anything said before. After v1 it can only produce a Proposal.
_Avoid_: resume, reopen, restart

**Focused Session**:
A Grilling Session scoped to one Section or Entry of an existing Draft. Its Proposal may also suggest knock-on changes elsewhere.
_Avoid_: sub-session, partial session

## Relationships

- A **Project** has many **Drafts** and exactly one **Glossary**.
- A **Project** has at most one **Backlog**; a **Backlog** may serve many **Projects**.
- A **Draft** may hold any number of **References** to other **Drafts** in the same Project; none is required.
- A **Task** usually belongs to a **PBI** or a **Bug**, expressed as a **Reference** to that Draft. It is still optional, and it is not a parent link. In Azure DevOps the belonging is expressed only through the Task's **Parent**.
- A **Bug** usually References the Draft whose expected behaviour it breaks. An expectation taken from that Draft is cited, while what was observed comes only from the human.
- A **Draft** belongs to exactly one **Project** and has exactly one **Work Item Type**.
- A **Draft** has at most one **Linked Work Item**, and that item has the same **Work Item Type** as the Draft.
- A **Draft** has any number of **Backlog References**, at most one of which is its **Parent**. A Parent must already exist in Azure DevOps, so a Task's PBI is Published before the Task can point to it.
- Each **Publish** replaces the Draft's **Published Snapshot**. Bringing **Drift** into the Draft produces a **Proposal**, never a direct edit.
- The first **Grilling Session** on a **Draft** writes v1 directly; every later session produces a **Proposal**, and each accepted **Proposal** is one **Iteration**.
- A **Proposal** is split into **Clean Changes** and **Conflicts**.
- Every session is held with the **Assistant** set at its start; a **Continuation** needs that same **Assistant**. Different sessions on one **Draft** may have different **Assistants**, since the **Draft** is the memory.
- A **Draft** has many **Grilling Sessions** over its life. Each session starts from the current **Draft**, the **Glossary** and the Draft's **References**. An ended session may be picked up by a **Continuation**, which also has the earlier chat but is told the current Draft wins. Every session's **Transcript** stays read-only.
- A **Work Item Type** has many **Templates**, exactly one of which is its **Default Template**; a **Template** defines many **Sections**.
- A **Draft** is written in exactly one **Template**, chosen when the Draft is created, and keeps a snapshot of it. Later edits to the **Template** affect only new **Drafts**; an existing **Draft** moves to a newer Template version only through an explicit upgrade, which arrives as a **Proposal**.
- A **Default Template** is read-only; customizing means duplicating it into a new **Template**.
- A **Template Session** produces at most one **Template**; it never touches a **Project**, **Draft** or **Glossary**.
- A **Section** holds either prose or many **Entries**, and names the Azure DevOps field it is **Published** into.
- A **Draft** has a title of its own, outside its **Sections**.
- The **Template** decides what the Assistant must write and in what order; the human decides what the **Draft** finally keeps and in what order. The Assistant never omits a Section — an empty one says so, with a reason.

## Example dialogue

> **Dev:** "I grilled the export requirement as a Feature — is the Draft ready to publish?"
> **Domain expert:** "Not yet. It's still a Draft until we've reordered the acceptance criteria and dropped the scope section we disagreed on."
