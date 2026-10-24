// Template editor: the <option>s of a field picker, one per field a Section or the Iteration Log may target.
import { fieldLabel } from '#core/shared/trackerFields.ts'

export function TargetOptions({ targets }: Readonly<{ targets: string[] }>) {
  return targets.map((target) => (
    <option key={target} value={target}>
      → {fieldLabel(target)}
    </option>
  ))
}
