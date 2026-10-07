// The home page: the Project list, or a welcome on first run, and the New Project dialog.
import { useSearchParams } from 'react-router'

import { Plus } from 'lucide-react'

import { useProjects } from '@/api/hooks/projects/projectHooks'
import { Button } from '@/components/atoms/button/button'
import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import { CreateProjectDialog } from '@/components/features/projects/createProjectDialog/createProjectDialog'
import { ProjectList } from '@/components/features/projects/projectList/projectList'

export default function HomePage() {
  const { data: projects, isLoading } = useProjects()
  // ?newProject opens the dialog straight away (the header's "New Project" links here).
  const [params, setParams] = useSearchParams()
  const creating = params.has('newProject')
  const setCreating = (open: boolean) => setParams(open ? { newProject: '' } : {}, { replace: true })

  if (isLoading) return <PageLoading />
  const first = !projects?.length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="font-serif text-[34px] leading-tight font-semibold tracking-tight">
          {first ? 'Grill a requirement into a work item.' : 'Projects'}
        </h1>
        <p className="mt-3 max-w-xl text-ink-soft">
          {first
            ? 'Start with a Project for the product you work on. Each Project keeps its own Glossary, so terms settled in one Draft are known in the next.'
            : 'Each Project keeps its Drafts and its own Glossary apart.'}
        </p>

        {!first && <ProjectList projects={projects} />}

        <Button variant="ink" size="lg" className="mt-8" onClick={() => setCreating(true)}>
          <Plus size={16} /> New Project
        </Button>
        <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
      </div>
    </div>
  )
}
