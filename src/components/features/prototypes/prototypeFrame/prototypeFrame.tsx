// The sandboxed frame a Prototype is shown in. It loads the view route and allows scripts, forms and dialogs only, so
// the page inside is an opaque origin that can't reach this app.
import { endpoints } from '@/api/endpoints/endpoints'

interface PrototypeFrameProps {
  projectId: string
  prototypeId: string
}

/** The sandboxed frame a Prototype is shown in: its own tab and a Prototype Grilling Session's page use the same one. */
export function PrototypeFrame({ projectId, prototypeId }: Readonly<PrototypeFrameProps>) {
  return (
    <iframe
      title="Prototype"
      src={endpoints.prototypeView(projectId, prototypeId)}
      sandbox="allow-scripts allow-forms allow-modals"
      className="min-h-0 w-full flex-1 border-0 bg-white"
    />
  )
}
