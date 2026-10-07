// Template writes, each announced to the browser so every open Templates list refreshes.
import type { Template } from '#core/template/templateTypes.ts'

import type { Hub } from '../hub.ts'
import * as templates from '../storage/templates.ts'
import { now } from './clock.ts'

export class TemplateService {
  private hub: Hub

  constructor(hub: Hub) {
    this.hub = hub
  }

  create = (input: Template, origin?: Template['origin']) =>
    this.announce(templates.createTemplate(input, now(), origin))
  update = (id: string, input: Template) => this.announce(templates.updateTemplate(id, input, now()))
  delete = (id: string) => this.announce(templates.deleteTemplate(id))
  import = (bundle: unknown, selected: number[]) => this.announce(templates.importTemplates(bundle, selected, now()))

  private async announce<T>(write: Promise<T>): Promise<T> {
    const result = await write
    this.hub.broadcast({ type: 'templates' })
    return result
  }
}
