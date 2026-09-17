<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.clients'), to: '/clients' }, { label: title }]"
      :description="client ? formatTaxId(client.tax_id) : undefined"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !client" height="220px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !client"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('client.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else-if="client">
      <DlSectionCard :description="t('client.details.description')" :title="t('client.details.title')">
        <DlDescriptionList :items="details" />
      </DlSectionCard>

      <DlSectionCard
        v-if="canSeeLessees"
        :count="lesseesLoading ? undefined : lessees.length"
        :description="t('client.lessees.description')"
        :padded="lesseesLoading || lessees.length === 0"
        :title="t('nav.lessees')"
      >
        <template v-if="session.can('POST', '/lessee')" #actions>
          <DlButton icon="mdi-plus" variant="tonal" @click="addingLessee = true">{{ t('client.addLessee') }}</DlButton>
        </template>

        <DlSkeleton v-if="lesseesLoading" height="36px" :lines="3" />

        <DlEmptyState
          v-else-if="lessees.length === 0"
          compact
          :description="lesseesError ?? t('client.lessees.emptyDescription')"
          icon="mdi-account-hard-hat-outline"
          :title="t('client.lessees.emptyTitle')"
          :tone="lesseesError ? 'error' : 'neutral'"
        />

        <DlDataTable
          v-else
          bare
          :columns="lesseeColumns"
          :limit="lessees.length + 1"
          :paged="false"
          :rows="lessees"
          @row-click="row => session.can('GET', '/lessee/:id') && router.push({ name: 'lessee', params: { id: row.id } })"
        />
      </DlSectionCard>
    </template>

    <ClientFormDialog v-model:open="editOpen" :client="client" />

    <LesseeFormDialog v-model:open="addingLessee" :client-id="clientId" @saved="onLesseeSaved" />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('clients.deleteTitle')"
      destructive
      :error="removal.error"
      :message="t('clients.deleteMessage', { name: title })"
      :processing="removal.processing"
      :title="t('clients.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Lessee } from '@/types/krloc'
  import {
    type Column,
    type DescriptionItem,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlDescriptionList,
    DlEmptyState,
    DlPageHeader,
    DlSectionCard,
    DlSkeleton,
    type HeaderAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import ClientFormDialog from '@/components/ClientFormDialog.vue'
  import LesseeFormDialog from '@/components/LesseeFormDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { errorMessage } from '@/services/http'
  import { useClientsStore } from '@/stores/clients'
  import { useSessionStore } from '@/stores/session'
  import { addressLine } from '@/utils/address'
  import { formatPhone, formatTaxId, formatZipcode } from '@/utils/documents'
  import { formatDateTime } from '@/utils/format'

  /** Ficha do cliente e as obras dele. */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const store = useClientsStore()

  const clientId = computed(() => String(route.params.id))
  const client = computed(() => (store.current?.id === clientId.value ? store.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  const canSeeLessees = computed(() => session.can('GET', '/lessee/lesseesbyclient/:id'))
  const lesseesLoading = ref(false)
  const lesseesError = ref<string | null>(null)

  async function loadLessees (): Promise<void> {
    if (!canSeeLessees.value) {
      return
    }

    lesseesLoading.value = true
    lesseesError.value = null

    try {
      await store.fetchLessees(clientId.value)
    } catch (error) {
      lesseesError.value = errorMessage(error)
    } finally {
      lesseesLoading.value = false
    }
  }

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await store.fetchOne(clientId.value)
      await loadLessees()
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const title = computed(() => client.value?.name ?? t('pageTitles.client'))

  const details = computed<DescriptionItem[]>(() => {
    const current = client.value

    if (!current) {
      return []
    }

    return [
      { key: 'taxId', label: t('clients.taxId'), value: formatTaxId(current.tax_id), mono: true, copyable: true },
      { key: 'email', label: t('common.email'), value: current.email, copyable: true },
      { key: 'phone', label: t('clients.phone'), value: formatPhone(current.phone), copyable: !!current.phone },
      { key: 'address', label: t('address.title'), value: addressLine(current) },
      { key: 'city', label: t('address.city'), value: [current.city, current.state].filter(Boolean).join(' / ') },
      { key: 'zipcode', label: t('address.zipcode'), value: formatZipcode(current.zipcode), mono: true },
      { key: 'createdAt', label: t('common.registered'), value: formatDateTime(current.createdAt) },
    ]
  })

  interface LesseeRow extends Record<string, unknown> {
    id: string
    name: string
    address: string
    city: string
  }

  const lessees = computed<LesseeRow[]>(() =>
    (store.lesseesOf === clientId.value ? store.lessees : []).map(lessee => ({
      id: lessee.id,
      name: lessee.name,
      address: addressLine(lessee),
      city: [lessee.city, lessee.state].filter(Boolean).join(' / '),
    })),
  )

  const lesseeColumns = computed<Column<LesseeRow>[]>(() => [
    { key: 'name', label: t('common.name') },
    { key: 'address', label: t('address.title'), secondary: true },
    { key: 'city', label: t('address.city'), width: '180px' },
  ])

  const headerActions = computed<HeaderAction[]>(() => {
    const current = client.value

    if (!current) {
      return []
    }

    const path = `/client/${current.id}`
    const actions: HeaderAction[] = [
      { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path, variant: 'outlined' },
    ]

    // Com obra a API recusa apagar. O botao so criaria um erro garantido.
    if (canSeeLessees.value && !lesseesLoading.value && lessees.value.length === 0) {
      actions.push({ key: 'delete', label: t('common.delete'), icon: 'mdi-delete-outline', method: 'DELETE', path, color: 'error', variant: 'text' })
    }

    return actions
  })

  const editOpen = ref(false)
  const addingLessee = ref(false)
  const removal = useConfirm<string>()

  function onAction (key: string): void {
    if (key === 'edit') {
      editOpen.value = true
    } else if (key === 'delete' && client.value) {
      removal.ask(client.value.id)
    }
  }

  function onLesseeSaved (lessee: Lessee | null): void {
    void loadLessees()

    if (lessee && session.can('GET', '/lessee/:id')) {
      void router.push({ name: 'lessee', params: { id: lessee.id } })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(id => store.remove(id))

    if (ok) {
      toast.success(t('clients.deleted'))
      await router.replace({ name: 'clients' })
    }
  }
</script>
