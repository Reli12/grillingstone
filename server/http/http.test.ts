import { describe, expect, it } from 'vitest'
import { DraftOpError } from '#core/draft/humanOps.ts'
import { NotFound } from '../storage/errors.ts'
import { parse } from './body.ts'
import { HttpError, knownError } from './errors.ts'
import { Router } from './router.ts'
import { humanOpBody, templateSessionBody } from './schemas.ts'

describe('Router', () => {
  it('matches method and path, decoding :params', () => {
    const r = new Router()
    const handler = () => 'draft'
    r.get('/api/projects/:projectId/drafts/:draftId', handler)
    expect(r.match('GET', '/api/projects/a%20b/drafts/d1')).toEqual({ handler, params: { projectId: 'a b', draftId: 'd1' } })
    expect(r.match('POST', '/api/projects/a/drafts/d1')).toBeNull()
    expect(r.match('GET', '/api/projects/a/drafts/d1/extra')).toBeNull()
  })
})

describe('parse', () => {
  it('returns the parsed body or a 400 naming the field', () => {
    expect(parse(humanOpBody, { op: 'moveSection', sectionId: 's', toIndex: 2 })).toEqual({ op: 'moveSection', sectionId: 's', toIndex: 2 })
    expect(() => parse(humanOpBody, { op: 'moveSection', sectionId: 's', toIndex: 'top' })).toThrow(/"toIndex"/)
    expect(() => parse(humanOpBody, { op: 'explode' })).toThrow(HttpError)
    expect(parse(templateSessionBody, { workItemType: 'PBI', purpose: 'x', baseTemplateId: '' })).toEqual({ workItemType: 'PBI', purpose: 'x', examples: '', baseTemplateId: undefined })
    expect(() => parse(templateSessionBody, { workItemType: 'Story', purpose: 'x' })).toThrow('"workItemType": Choose Epic, Feature or PBI.')
  })
})

describe('knownError', () => {
  it('maps the tool’s errors to statuses and leaves the rest to a 500', () => {
    expect(knownError(new HttpError(415, 'JSON'))).toEqual({ status: 415, body: { error: 'JSON' } })
    expect(knownError(new NotFound('No Draft'))).toEqual({ status: 404, body: { error: 'No Draft' } })
    expect(knownError(new DraftOpError('Locked'))?.status).toBe(409)
    expect(knownError(new TypeError('bug'))).toBeNull()
  })
})
