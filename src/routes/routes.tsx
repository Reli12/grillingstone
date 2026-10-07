// Every route of the app: the URL builders the rest of the code links with, and the router itself.
import { lazy, type ReactNode, Suspense } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'

import { PageLoading } from '@/components/atoms/pageLoading/pageLoading'
import AppLayout from '@/pages/AppLayout'

const HomePage = lazy(() => import('@/pages/HomePage/HomePage'))
const ProjectPage = lazy(() => import('@/pages/ProjectPage/ProjectPage'))
const NewDraftPage = lazy(() => import('@/pages/NewDraftPage/NewDraftPage'))
const DraftPage = lazy(() => import('@/pages/DraftPage/DraftPage'))
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage/TemplatesPage'))
const NewTemplatePage = lazy(() => import('@/pages/NewTemplatePage/NewTemplatePage'))
const TemplateSessionPage = lazy(() => import('@/pages/TemplateSessionPage/TemplateSessionPage'))
const TemplateEditorPage = lazy(() => import('@/pages/TemplateEditorPage/TemplateEditorPage'))
const GuidePage = lazy(() => import('@/pages/GuidePage/GuidePage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage/SettingsPage'))

export const routesPaths = {
  home: '/',
  project: (projectId: string) => `/p/${projectId}`,
  newDraft: (projectId: string) => `/p/${projectId}/new`,
  draft: (projectId: string, draftId: string) => `/p/${projectId}/d/${draftId}`,
  templates: '/templates',
  newTemplate: '/templates/new',
  templateSession: (sessionId: string) => `/templates/session/${sessionId}`,
  template: (templateId: string) => `/templates/${templateId}`,
  guide: '/how-it-works',
  settings: '/settings',
}

// Local single-user tool: no auth or permission metadata on routes (ADR-0011). Route patterns come from
// routesPaths with `:param` placeholders, so a path is spelled in one place only.
const page = (content: ReactNode) => <Suspense fallback={<PageLoading />}>{content}</Suspense>

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: routesPaths.home, element: page(<HomePage />) },
      { path: routesPaths.project(':projectId'), element: page(<ProjectPage />) },
      { path: routesPaths.newDraft(':projectId'), element: page(<NewDraftPage />) },
      { path: routesPaths.draft(':projectId', ':draftId'), element: page(<DraftPage />) },
      { path: routesPaths.templates, element: page(<TemplatesPage />) },
      { path: routesPaths.newTemplate, element: page(<NewTemplatePage />) },
      { path: routesPaths.templateSession(':sessionId'), element: page(<TemplateSessionPage />) },
      { path: routesPaths.template(':templateId'), element: page(<TemplateEditorPage />) },
      { path: routesPaths.guide, element: page(<GuidePage />) },
      { path: routesPaths.settings, element: page(<SettingsPage />) },
    ],
  },
]

export const router = createBrowserRouter(routes)
