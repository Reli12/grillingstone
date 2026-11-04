// Tests for the HTTP plumbing: route matching, request body parsing, and error-to-status mapping.
import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { DraftOpError } from '#core/draft/humanOps.ts'

import { buildRouter } from '../app.ts'
import type { AppDeps } from '../routes/deps.ts'
import { NotFound } from '../storage/errors.ts'
import { IMAGE_MAX_BODY, parse, readBody } from './body.ts'
import { HttpError, knownError } from './errors.ts'
import { Router } from './router.ts'
import { humanOpBody, templateSessionBody } from './schemas.ts'

describe('Router', () => {
  it('matches method and path, decoding :params', () => {
    const router = new Router()
    const handler = () => 'draft'
    router.get('/api/projects/:projectId/drafts/:draftId', handler)
    expect(router.match('GET', '/api/projects/a%20b/drafts/d1')).toEqual({
      handler,
      params: { projectId: 'a b', draftId: 'd1' },
      options: {},
    })
    expect(router.match('POST', '/api/projects/a/drafts/d1')).toBeNull()
    expect(router.match('GET', '/api/projects/a/drafts/d1/extra')).toBeNull()
  })
})

describe('body size limits', () => {
  const bodyOf = (bytes: number) => Readable.from([Buffer.from(JSON.stringify({ text: 'x'.repeat(bytes) }))])
  const SIX_MB = 6_000_000

  it('refuses a body over 5 MB by default and accepts it under the larger limit', async () => {
    await expect(readBody(bodyOf(SIX_MB) as IncomingMessage)).rejects.toMatchObject({ status: 413 })
    await expect(readBody(bodyOf(SIX_MB) as IncomingMessage, IMAGE_MAX_BODY)).resolves.toMatchObject({
      text: expect.any(String),
    })
  })

  it('refuses a body over 40 MB even on a route that takes Images', async () => {
    const forty = IMAGE_MAX_BODY + 1
    await expect(readBody(bodyOf(forty) as IncomingMessage, IMAGE_MAX_BODY)).rejects.toMatchObject({ status: 413 })
  })

  it('gives the larger limit to the say, start-session and new-Draft routes only', () => {
    // Registering routes only reads the dependencies inside handlers, which this test never calls.
    const router = buildRouter({} as AppDeps)
    const limitOf = (method: string, path: string) => router.match(method, path)?.options.maxBody
    expect(limitOf('POST', '/api/sessions/s1/messages')).toBe(IMAGE_MAX_BODY)
    expect(limitOf('POST', '/api/projects/p/drafts/d/sessions')).toBe(IMAGE_MAX_BODY)
    expect(limitOf('POST', '/api/projects/p/drafts')).toBe(IMAGE_MAX_BODY)
    expect(limitOf('POST', '/api/projects/p/drafts/d/prototype-sessions')).toBe(IMAGE_MAX_BODY)
    expect(limitOf('POST', '/api/projects/p/prototype-sessions/s1/stop')).toBeUndefined()
    expect(limitOf('POST', '/api/sessions/s1/write')).toBeUndefined()
    expect(limitOf('POST', '/api/projects/p/drafts/d/sessions/s1/continue')).toBeUndefined()
    expect(limitOf('POST', '/api/projects')).toBeUndefined()
    expect(limitOf('PUT', '/api/settings')).toBeUndefined()
  })
})

describe('parse', () => {
  it('returns the parsed body or a 400 naming the field', () => {
    expect(parse(humanOpBody, { op: 'moveSection', sectionId: 's', toIndex: 2 })).toEqual({
      op: 'moveSection',
      sectionId: 's',
      toIndex: 2,
    })
    expect(() => parse(humanOpBody, { op: 'moveSection', sectionId: 's', toIndex: 'top' })).toThrow(/"toIndex"/)
    expect(() => parse(humanOpBody, { op: 'explode' })).toThrow(HttpError)
    expect(parse(templateSessionBody, { workItemType: 'PBI', purpose: 'x', baseTemplateId: '' })).toEqual({
      tracker: 'azure-devops',
      workItemType: 'PBI',
      purpose: 'x',
      examples: '',
      baseTemplateId: undefined,
    })
    expect(() => parse(templateSessionBody, { workItemType: 'Spike', purpose: 'x' })).toThrow(
      '"workItemType": Choose a Work Item Type: one of Epic, Feature, PBI, Story, Task, Sub-task, Bug.',
    )
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
