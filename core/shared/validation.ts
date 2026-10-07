// The shared shape of a refusal, so every validator reports problems the same way.
/** Why something was refused, with a stable code the tool and Claude can act on. */
export interface Reason {
  code: string
  message: string
  sectionKey?: string
}

export type Validation = { ok: true } | { ok: false; reasons: Reason[] }
