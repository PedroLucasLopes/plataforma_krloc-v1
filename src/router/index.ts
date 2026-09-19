/**
 * router/index.ts
 *
 * Rotas declaradas a mao. Cada tela diz qual permissao a libera, com o mesmo
 * metodo e caminho do catalogo de rotas do projeto KRLoc no SSO. O guard pergunta
 * isso antes de montar a tela, e a API pergunta de novo em cada chamada.
 */

import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { APP_NAME } from '@/constants/layout'
import { i18n, t } from '@/plugins/i18n'
import { useSessionStore } from '@/stores/session'
import { routeLoading } from './loading'

declare module 'vue-router' {
  interface RouteMeta {
    /** Chave de traducao do titulo da aba. */
    title?: string
    /** Nao exige sessao: saida, API fora do ar e login recusado. */
    public?: boolean
    /** `key` do item de menu que fica ativo. */
    nav?: string
    /** Permissao que libera a tela. Sem ela, a tela de "nao permitido". */
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
    // `APP_LOGIN_ERROR_REDIRECT` da API aponta para ca. Publica de proposito: com
    // guard, a conta recusada iria ao login, seria recusada de novo e voltaria.
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

  // Sem sessao, a API conduz o login no SSO e devolve a pessoa a esta mesma URL.
  if (status === 'unauthenticated') {
    session.beginLogin(to.fullPath)

    return false
  }

  // Quem acabou de sair so entra de novo se pedir, na tela de saida.
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

// O titulo da aba acompanha a troca de lingua, sem esperar a proxima navegacao.
watch(i18n.global.locale, () => applyTitle(router.currentRoute.value))

router.onError(() => {
  routeLoading.value = false
})

export default router
