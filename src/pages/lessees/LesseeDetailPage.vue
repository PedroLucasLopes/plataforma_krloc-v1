<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.lessees'), to: '/lessees' }, { label: title }]"
      :description="lessee?.client?.name"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !lessee" height="220px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !lessee"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('lessee.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else-if="lessee">
      <DlSectionCard :description="t('lessee.details.description')" :title="t('lessee.details.title')">
        <DlDescriptionList :items="details">
          <template #item-client>
            <button
              v-if="lessee.client && session.can('GET', '/client/:id')"
              class="link"
              type="button"
              @click="router.push({ name: 'client', params: { id: lessee.clientId } })"
            >
              {{ lessee.client.name }}
            </button>

            <template v-else>{{ lessee.client?.name ?? '—' }}</template>
          </template>
        </DlDescriptionList>
      </DlSectionCard>

      <DlSectionCard
        :count="contracts.length"
        :description="t('lessee.contracts.description')"
        :padded="contracts.length === 0"
        :title="t('nav.contracts')"
      >
        <DlEmptyState
          v-if="contracts.length === 0"
          compact
          :description="t('lessee.contracts.emptyDescription')"
          icon="mdi-file-document-outline"
          :title="t('lessee.contracts.emptyTitle')"
        />

        <DlDataTable
          v-else
          bare
          :columns="contractColumns"
          :limit="contracts.length + 1"
          :paged="false"
          :rows="contracts"
          @row-click="row => session.can('GET', '/elease/:id') && router.push({ name: 'contract', params: { id: row.id } })"
        >
          <template #col-status="{ row }">
            <DlStatusChip :map="LEASE_STATUS" :status="String(row.status)" />
          </template>
        </DlDataTable>
      </DlSectionCard>
    </template>

    <LesseeFormDialog v-model:open="editOpen" :lessee="lessee" />

    <ContractFormDialog v-model:open="creatingContract" :lessee-id="lesseeId" @created="onContractCreated" />

    <DlConfirmDialog
      v-model="removal.open"
      :confirm-label="t('lessees.deleteTitle')"
      destructive
      :error="removal.error"
      :message="t('lessees.deleteMessage', { name: title })"
      :processing="removal.processing"
      :title="t('lessees.deleteTitle')"
      @confirm="remove"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { Contract, LeaseStatus } from '@/types/krloc'
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
    DlStatusChip,
    type HeaderAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import ContractFormDialog from '@/components/ContractFormDialog.vue'
  import LesseeFormDialog from '@/components/LesseeFormDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { LEASE_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useLesseesStore } from '@/stores/lessees'
  import { useSessionStore } from '@/stores/session'
  import { addressLine } from '@/utils/address'
  import { formatZipcode } from '@/utils/documents'
  import { formatDate, formatDateTime } from '@/utils/format'

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const store = useLesseesStore()

  const lesseeId = computed(() => String(route.params.id))
  const lessee = computed(() => (store.current?.id === lesseeId.value ? store.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await store.fetchOne(lesseeId.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const title = computed(() => lessee.value?.name ?? t('pageTitles.lessee'))

  const details = computed<DescriptionItem[]>(() => {
    const current = lessee.value

    if (!current) {
      return []
    }

    return [
      { key: 'client', label: t('lessees.client'), value: current.client?.name },
      { key: 'address', label: t('address.title'), value: addressLine(current) },
      { key: 'city', label: t('address.city'), value: [current.city, current.state].filter(Boolean).join(' / ') },
      { key: 'zipcode', label: t('address.zipcode'), value: formatZipcode(current.zipcode), mono: true },
      { key: 'createdAt', label: t('common.registered'), value: formatDateTime(current.createdAt) },
    ]
  })

  interface ContractRow extends Record<string, unknown> {
    id: string
    period: string
    status: LeaseStatus
    createdAt: string
  }

  const contracts = computed<ContractRow[]>(() =>
    (lessee.value?.eleases ?? [])
      .toSorted((a, b) => b.startDate.localeCompare(a.startDate))
      .map(contract => ({
        id: contract.id,
        period: t('contracts.periodRange', { start: formatDate(contract.startDate), end: formatDate(contract.endDate) }),
        status: contract.status,
        createdAt: formatDate(contract.createdAt),
      })),
  )

  const contractColumns = computed<Column<ContractRow>[]>(() => [
    { key: 'period', label: t('contracts.period') },
    { key: 'status', label: t('common.status'), width: '160px' },
    { key: 'createdAt', label: t('common.registered'), width: '150px', secondary: true },
  ])

  const headerActions = computed<HeaderAction[]>(() => {
    const current = lessee.value

    if (!current) {
      return []
    }

    const path = `/lessee/${current.id}`
    const actions: HeaderAction[] = [
      { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path, variant: 'outlined' },
    ]

    if ((current.eleases?.length ?? 0) === 0) {
      actions.push({ key: 'delete', label: t('common.delete'), icon: 'mdi-delete-outline', method: 'DELETE', path, color: 'error', variant: 'text' })
    }

    actions.push({ key: 'contract', label: t('contracts.new'), icon: 'mdi-file-document-plus-outline', method: 'POST', path: '/elease' })

    return actions
  })

  const editOpen = ref(false)
  const creatingContract = ref(false)
  const removal = useConfirm<string>()

  function onAction (key: string): void {
    switch (key) {
      case 'edit': {
        editOpen.value = true

        break
      }
      case 'delete': {
        removal.ask(lesseeId.value)

        break
      }
      case 'contract': {
        creatingContract.value = true

        break
      }
    // No default
    }
  }

  function onContractCreated (contract: Contract): void {
    void load()

    if (session.can('GET', '/elease/:id')) {
      void router.push({ name: 'contract', params: { id: contract.id } })
    }
  }

  async function remove (): Promise<void> {
    const ok = await removal.confirm(id => store.remove(id))

    if (ok) {
      toast.success(t('lessees.deleted'))
      await router.replace({ name: 'lessees' })
    }
  }
</script>
