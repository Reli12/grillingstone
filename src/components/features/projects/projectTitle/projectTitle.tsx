import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { Project } from '#core/contract/apiTypes.ts'
import { useRenameProject } from '@/api/hooks/projects/projectHooks'
import { TextInput } from '@/components/atoms/textInput/textInput'
import { projectNameSchema, type ProjectNameFormData } from '@/lib/formSchemas/projectSchema'

interface ProjectTitleProps {
  project: Project
}

/** The Project's name as the page heading; double-click to rename, Enter saves, leaving the field cancels. */
export function ProjectTitle({ project }: ProjectTitleProps) {
  const [editing, setEditing] = useState(false)

  const { register, handleSubmit, reset } = useForm<ProjectNameFormData>({ resolver: zodResolver(projectNameSchema) })

  const rename = useRenameProject(project.id)

  const startEditing = () => {
    reset({ name: project.name })
    setEditing(true)
  }
  const onSubmit = handleSubmit(({ name }) => rename.mutate(name, { onSuccess: () => setEditing(false) }))

  if (!editing)
    return (
      <h1 className="cursor-text font-serif text-[30px] leading-tight font-semibold tracking-tight" title="Rename" onDoubleClick={startEditing}>
        {project.name}
      </h1>
    )
  return (
    <form onSubmit={onSubmit}>
      <TextInput autoFocus {...register('name', { onBlur: () => setEditing(false) })} className="h-11 font-serif text-2xl" aria-label="Project name" />
    </form>
  )
}
