// One field of the work item, ready to copy: HTML for ADO's rich-text boxes, `null` for plain ones.

/** One field of the work item, ready to copy: HTML for ADO's rich-text boxes, `null` for plain ones. */
export interface CopyField {
  key: string
  label: string
  html: string | null
  text: string
}
