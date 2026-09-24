import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/constants/layout'
import { i18n, t } from '@/plugins/i18n'
import { useSessionStore } from '@/stores/session'
import { routeLoading } from './loading'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    nav?: string
    permission?: { method: string, path: string }
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/signed-out',
    name: 'signed-out',
    component: () => import('@/pages/SignedOutPage.vue'),
    meta: { public: true, title: 'pageTitles.signedOut' },
  },
  {
    path: '/unavailable',
    name: 'unavailable',
    component: () => import('@/pages/UnavailablePage.vue'),
    meta: { public: true, title: 'pageTitles.unavailable' },
  },
  {
    path: '/sign-in-error',
    name: 'sign-in-error',
    component: () => import('@/pages/SignInErrorPage.vue'),
    meta: { public: true, title: 'pageTitles.signInError' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/pages/DashboardPage.vue'),
        meta: { title: 'pageTitles.dashboard', nav: 'dashboard' },
      },
      {
        path: 'contracts',
        name: 'contracts',
        component: () => import('@/pages/contracts/ContractsPage.vue'),
        meta: { title: 'pageTitles.contracts', nav: 'elease', permission: { method: 'GET', path: '/elease' } },
      },
      {
        path: 'contracts/:id',
        name: 'contract',
        component: () => import('@/pages/contracts/ContractDetailPage.vue'),
        meta: { title: 'pageTitles.contract', nav: 'elease', permission: { method: 'GET', path: '/elease/:id' } },
      },
      {
        path: 'financial',
        name: 'closing',
        component: () => import('@/pages/financial/ClosingPage.vue'),
        meta: { title: 'pageTitles.closing', nav: 'finantial', permission: { method: 'GET', path: '/finantial' } },
      },
      {
        path: 'financial/calculator',
        name: 'calculator',
        component: () => import('@/pages/financial/CalculatorPage.vue'),
        meta: { title: 'pageTitles.calculator', nav: 'calculator', permission: { method: 'POST', path: '/finantial/simulate' } },
      },
      {
        path: 'equipment',
        name: 'equipment',
        component: () => import('@/pages/equipment/EquipmentPage.vue'),
        meta: { title: 'pageTitles.equipment', nav: 'equipment', permission: { method: 'GET', path: '/equipment' } },
      },
      {
        path: 'equipment/:id',
        name: 'equipment-unit',
        component: () => import('@/pages/equipment/EquipmentDetailPage.vue'),
        meta: { title: 'pageTitles.equipmentUnit', nav: 'equipment', permission: { method: 'GET', path: '/equipment/:id' } },
      },
      {
        path: 'accessories',
        name: 'accessories',
        component: () => import('@/pages/accessories/AccessoriesPage.vue'),
        meta: { title: 'pageTitles.accessories', nav: 'accessory', permission: { method: 'GET', path: '/accessory' } },
      },
      {
        path: 'clients',
        name: 'clients',
        component: () => import('@/pages/clients/ClientsPage.vue'),
        meta: { title: 'pageTitles.clients', nav: 'client', permission: { method: 'GET', path: '/client' } },
      },
      {
        path: 'clients/:id',
        name: 'client',
        component: () => import('@/pages/clients/ClientDetailPage.vue'),
        meta: { title: 'pageTitles.client', nav: 'client', permission: { method: 'GET', path: '/client/:id' } },
      },
      {
        path: 'lessees',
        name: 'lessees',
        component: () => import('@/pages/lessees/LesseesPage.vue'),
        meta: { title: 'pageTitles.lessees', nav: 'lessee', permission: { method: 'GET', path: '/lessee' } },
      },
      {
        path: 'lessees/:id',
        name: 'lessee',
        component: () => import('@/pages/lessees/LesseeDetailPage.vue'),
        meta: { title: 'pageTitles.lessee', nav: 'lessee', permission: { method: 'GET', path: '/lessee/:id' } },
      },
      {
        path: 'forbidden',
        name: 'forbidden',
        component: () => import('@/pages/ForbiddenPage.vue'),
        meta: { title: 'pageTitles.forbidden' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/pages/NotFoundPage.vue'),
        meta: { title: 'pageTitles.notFound' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
})

router.beforeEach(async to => {
  if (to.meta.public) {
    return true
  }

  routeLoading.value = true

  const session = useSessionStore()
  const status = await session.ensure()

  if (status === 'unauthenticated') {
    session.beginLogin(to.fullPath)

    return false
  }

  if (status === 'signed-out') {
    return { name: 'signed-out' }
  }

  if (status === 'unavailable') {
    return { name: 'unavailable', query: { from: to.fullPath } }
  }

  const permission = to.meta.permission

  if (permission && !session.can(permission.method, permission.path)) {
    return { name: 'forbidden', query: { from: to.fullPath } }
  }

  return true
})

function applyTitle (to: RouteLocationNormalized): void {
  document.title = to.meta.title ? `${t(to.meta.title)} · ${APP_NAME}` : APP_NAME
}

router.afterEach(to => {
  routeLoading.value = false
  applyTitle(to)
})

watch(i18n.global.locale, () => applyTitle(router.currentRoute.value))

router.onError(() => {
  routeLoading.value = false
})

export default router
