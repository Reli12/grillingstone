// How a Jira field is pasted: rich text for Jira Cloud (or Data Center's Visual mode), wiki markup for
// Data Center's Text mode. Azure DevOps fields are always rich text.

export type PasteFormat = 'rich' | 'wiki'
