// One start step for both ways of creating a Template: "Grill it with Claude" (a Template Session) or
// "Build it myself" (an editable Template right away, from nothing or as a copy of a base).

import type { Template } from '#core/template/templateTypes.ts'

import { useLiveTemplateSession } from '@/api/hooks/templates/templateSessionHooks'
import { BasePicker } from '@/components/features/templates/basePicker/basePicker'
import { PurposeSection } from '@/components/features/templates/purposeSection/purposeSection'
import { StartActions } from '@/components/features/templates/startActions/startActions'
import { TemplateTypePicker } from '@/components/features/templates/templateTypePicker/templateTypePicker'
import { useNewTemplateForm } from '@/hooks/templates/useNewTemplateForm'
import { templateSessionSchema } from '@/lib/formSchemas/newTemplateSchema'

interface NewTemplateFormProps {
  templates: Template[]
}

export function NewTemplateForm({ templates }: Readonly<NewTemplateFormProps>) {
  const { data: live } = useLiveTemplateSession()
  const form = useNewTemplateForm(templates)
  const canGrill = templateSessionSchema.safeParse(form.values).success

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 md:grid-cols-[1fr_320px]">
        <PurposeSection register={form.register} />

        <aside className="space-y-7 md:pt-12">
          <TemplateTypePicker
            tracker={form.tracker}
            type={form.type}
            onChooseTracker={form.chooseTracker}
            onChoose={form.chooseType}
          />
          <BasePicker
            templates={form.forType}
            baseId={form.values.baseId}
            onChoose={(baseId) => form.setValue('baseId', baseId)}
          />
          <StartActions
            runningId={live?.session?.id}
            canGrill={canGrill}
            starting={form.start.isPending}
            creating={form.create.isPending}
            onGrill={form.grill}
            onBuild={form.buildMyself}
          />
        </aside>
      </div>
    </div>
  )
}
