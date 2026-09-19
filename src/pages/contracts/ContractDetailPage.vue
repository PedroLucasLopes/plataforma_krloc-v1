<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.contracts'), to: '/contracts' }, { label: title }]"
      :description="description"
      :title="title"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !contract" height="260px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !contract"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('contract.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else-if="contract">
      <DlSectionCard :title="t('contract.lifecycle.title')">
        <DlLifecycle
          :current="contract.status"
          :exited-from="contract.status === 'CANCELLED' ? 'PENDING' : undefined"
          :exits="exits"
          :label="t('contract.lifecycle.title')"
          :steps="steps"
        />

        <p class="note" :class="`note--${nextStep.tone}`">
          <VIcon :icon="nextStep.icon" size="18" />
          <span>{{ nextStep.text }}</span>
        </p>
      </DlSectionCard>

      <DlSectionCard :title="t('contract.summary')">
        <DlDescriptionList :items="summary">
          <template #item-lessee>
            <button
              v-if="contract.lessee && session.can('GET', '/lessee/:id')"
              class="link"
              type="button"
              @click="router.push({ name: 'lessee', params: { id: contract.lesseeId } })"
            >
              {{ contract.lessee.name }}
            </button>

            <template v-else>{{ contract.lessee?.name ?? '—' }}</template>
          </template>

          <template #item-client>
            <button
              v-if="contract.lessee?.client && session.can('GET', '/client/:id')"
              class="link"
              type="button"
              @click="router.push({ name: 'client', params: { id: contract.lessee.clientId } })"
            >
              {{ contract.lessee.client.name }}
            </button>

            <template v-else>{{ contract.lessee?.client?.name ?? '—' }}</template>
          </template>
        </DlDescriptionList>
      </DlSectionCard>

      <DlSectionCard
        :count="items.length"
        :description="t('contract.items.description')"
        :padded="items.length === 0"
        :title="t('nav.equipment')"
      >
        <DlEmptyState
          v-if="items.length === 0"
          compact
          :description="t('contract.items.emptyDescription')"
          icon="mdi-excavator"
          :title="t('contract.items.emptyTitle')"
        />

        <DlDataTable
          v-else
          :actions="itemActions"
          bare
          :columns="itemColumns"
          :limit="items.length + 1"
          :paged="false"
          :rows="items"
          @action="onItemAction"
          @row-click="row => session.can('GET', '/equipment/:id') && router.push({ name: 'equipment-unit', params: { id: row.equipmentId } })"
        >
          <template #col-situation="{ row }">
            <DlStatusChip :map="EQUIPMENT_STATUS" :status="String(row.situation)" />
          </template>
        </DlDataTable>
      </DlSectionCard>

      <DlSectionCard
        v-if="accessories.length > 0"
        :count="accessories.length"
        :description="t('contract.accessories.description')"
        :padded="false"
        :title="t('nav.accessories')"
      >
        <DlDataTable
          bare
          :columns="accessoryColumns"
          :limit="accessories.length + 1"
          :paged="false"
          :rows="accessories"
        />
      </DlSectionCard>

      <DlSectionCard
        v-if="showFinancial"
        :description="financialDescription"
        :title="t('contract.financial.title')"
      >
        <DlSkeleton v-if="statementLoading && !statement" height="120px" variant="block" />

        <DlEmptyState
          v-else-if="statementError && !statement"
          compact
          :description="statementError"
          icon="mdi-alert-circle-outline"
          :title="t('contract.financial.loadFailed')"
          tone="error"
        >
          <DlButton icon="mdi-refresh" variant="outlined" @click="loadStatement">{{ t('common.tryAgain') }}</DlButton>
        </DlEmptyState>

        <StatementBreakdown v-else-if="statement" :statement="statement" />
      </DlSectionCard>
    </template>

    <template v-if="contract">
      <AddEquipmentDialog v-model:open="dialogs.add" :contract="contract" />
      <ReturnEquipmentDialog v-model:open="dialogs.return" :contract="contract" :item="returning" />
      <ReplaceEquipmentDialog v-model:open="dialogs.replace" :contract="contract" :items="replaceable" />
    </template>

    <DlConfirmDialog
      v-model="pending.open"
      :confirm-label="confirmation.label"
      :destructive="confirmation.destructive"
      :error="pending.error"
      :message="confirmation.message"
      :processing="pending.processing"
      :title="confirmation.title"
      @confirm="runPending"
    />
  </div>
</template>

<script lang="ts" setup>
  import type { ContractStatement, EquipmentStatus, LeaseItem } from '@/types/krloc'
  import {
    type Column,
    type DescriptionItem,
    DlButton,
    DlConfirmDialog,
    DlDataTable,
    DlDescriptionList,
    DlEmptyState,
    DlLifecycle,
    DlPageHeader,
    DlSectionCard,
    DlSkeleton,
    DlStatusChip,
    type HeaderAction,
    type RowAction,
    toast,
  } from '@pedrolucaslopes/dotlog-ui'
  import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import AddEquipmentDialog from '@/components/contract/AddEquipmentDialog.vue'
  import ReplaceEquipmentDialog from '@/components/contract/ReplaceEquipmentDialog.vue'
  import ReturnEquipmentDialog from '@/components/contract/ReturnEquipmentDialog.vue'
  import StatementBreakdown from '@/components/financial/StatementBreakdown.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { EQUIPMENT_STATUS, leaseExits, leaseSteps } from '@/constants/status'
  import { ApiError, errorMessage } from '@/services/http'
  import { useContractsStore } from '@/stores/contracts'
  import { useFinancialStore } from '@/stores/financial'
  import { useSessionStore } from '@/stores/session'
  import { saveDocument } from '@/utils/files'
  import { daysUntil, formatDate, formatDateTime, formatMoney, unitCode } from '@/utils/format'

  /**
   * O contrato e tudo o que se faz com ele.
   *
   * O ciclo e fixo: pendente, ativo, concluido, ou cancelado antes de comecar.
   * Cada situacao oferece so o que a API aceita nela, e o primeiro passo de cada
   * uma aparece escrito embaixo do ciclo. O que o papel nao alcanca some junto:
   * a acao so aparece com a permissao da rota que ela chama.
   */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const store = useContractsStore()
  const financial = useFinancialStore()

  const contractId = computed(() => String(route.params.id))
  const contract = computed(() => (store.current?.id === contractId.value ? store.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await store.fetchOne(contractId.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const title = computed(() => contract.value?.lessee?.name ?? t('pageTitles.contract'))

  const description = computed(() => {
    const current = contract.value

    return current
      ? t('contracts.periodRange', { start: formatDate(current.startDate), end: formatDate(current.endDate) })
      : undefined
  })

  /* --------------------------------- ciclo -------------------------------- */

  const steps = computed(() => {
    const current = contract.value

    if (!current) {
      return []
    }

    return leaseSteps({
      PENDING: t('contract.lifecycle.created', { date: formatDate(current.createdAt) }),
      ACTIVE: current.status === 'ACTIVE' || current.status === 'COMPLETED'
        ? t('contracts.periodRange', { start: formatDate(current.startDate), end: formatDate(current.endDate) })
        : undefined,
      COMPLETED: current.status === 'COMPLETED' ? formatDate(current.finishDate) : undefined,
    })
  })

  const exits = computed(() => leaseExits(contract.value?.finishDate ? formatDate(contract.value.finishDate) : undefined))

  /** O que falta, em uma frase, e o tom dela. */
  const nextStep = computed(() => {
    const current = contract.value

    if (!current) {
      return { tone: 'neutral', icon: 'mdi-information-outline', text: '' }
    }

    switch (current.status) {
      case 'PENDING': {
        return current.contract_generated
          ? { tone: 'success', icon: 'mdi-check-circle-outline', text: t('contract.next.ready', { date: formatDateTime(current.contract_generated) }) }
          : { tone: 'warning', icon: 'mdi-file-document-alert-outline', text: t('contract.next.generate') }
      }
      case 'ACTIVE': {
        const days = daysUntil(current.endDate)

        if (days < 0) {
          return { tone: 'error', icon: 'mdi-calendar-alert-outline', text: t('contract.next.overdue', -days) }
        }

        return { tone: days <= 7 ? 'warning' : 'neutral', icon: 'mdi-calendar-clock-outline', text: t('contract.next.active', days) }
      }
      case 'COMPLETED': {
        return { tone: 'success', icon: 'mdi-flag-checkered', text: t('contract.next.completed', { date: formatDate(current.finishDate) }) }
      }
      default: {
        return { tone: 'neutral', icon: 'mdi-cancel', text: t('contract.next.cancelled', { date: formatDate(current.finishDate) }) }
      }
    }
  })

  /* -------------------------------- resumo -------------------------------- */

  const summary = computed<DescriptionItem[]>(() => {
    const current = contract.value

    if (!current) {
      return []
    }

    return [
      { key: 'lessee', label: t('contracts.lessee'), value: current.lessee?.name },
      { key: 'client', label: t('lessees.client'), value: current.lessee?.client?.name },
      { key: 'start', label: t('contracts.start'), value: formatDate(current.startDate) },
      { key: 'end', label: t('contracts.end'), value: formatDate(current.endDate) },
      { key: 'finish', label: t('contract.finished'), value: current.finishDate ? formatDateTime(current.finishDate) : null },
      { key: 'document', label: t('contract.document'), value: current.contract_generated ? formatDateTime(current.contract_generated) : null, hint: t('contract.documentHint') },
      { key: 'id', label: t('common.identifier'), value: current.id, mono: true, copyable: true },
    ]
  })

  /* ------------------------------ equipamentos ----------------------------- */

  interface ItemRow extends Record<string, unknown> {
    id: string
    equipmentId: string
    code: string
    name: string
    daily: string
    monthly: string
    indemnity: string
    since: string
    returned: string
    situation: EquipmentStatus
  }

  const leaseItems = computed<LeaseItem[]>(() => contract.value?.leaseItems ?? [])

  const byItemId = computed(() => new Map(leaseItems.value.map(item => [item.id, item])))

  const items = computed<ItemRow[]>(() =>
    leaseItems.value.map(item => ({
      id: item.id,
      equipmentId: item.equipmentId,
      code: unitCode(item.equipmentCode, item.equipmentSuffix),
      name: item.equipmentName,
      daily: formatMoney(item.p_diary),
      monthly: formatMoney(item.p_monthly),
      indemnity: formatMoney(item.p_indemnity),
      since: formatDate(item.startDate),
      returned: formatDate(item.finishDate),
      // A volta registrada diz mais que a saida: o item que foi para manutencao aparece assim.
      situation: item.finalStatus ?? item.startStatus,
    })),
  )

  const itemColumns = computed<Column<ItemRow>[]>(() => [
    { key: 'code', label: t('equipment.code'), mono: true, width: '130px' },
    { key: 'name', label: t('common.name') },
    { key: 'daily', label: t('rates.daily'), align: 'end', width: '120px' },
    { key: 'monthly', label: t('rates.monthly'), align: 'end', width: '130px', secondary: true },
    { key: 'indemnity', label: t('rates.indemnity'), align: 'end', width: '130px', secondary: true },
    { key: 'since', label: t('contract.items.since'), width: '120px', secondary: true },
    { key: 'returned', label: t('contract.items.returned'), width: '120px' },
    { key: 'situation', label: t('common.status'), width: '150px' },
  ])

  /** Na obra, sem volta registrada: o locado e o substituto. A API registra a volta dos dois. */
  function isOut (item: LeaseItem | undefined): boolean {
    return (item?.startStatus === 'LEASED' || item?.startStatus === 'REPLACE') && item.finalStatus === null
  }

  const itemActions = computed<RowAction<ItemRow>[]>(() => {
    const current = contract.value

    if (current?.status === 'PENDING') {
      return [{
        key: 'remove',
        label: t('contract.items.remove'),
        icon: 'mdi-minus-circle-outline',
        method: 'PUT',
        path: `/elease/remove/${current.id}`,
        color: 'error',
        // A API nao deixa o contrato sem equipamento.
        unavailable: () => leaseItems.value.length <= 1,
      }]
    }

    if (current?.status === 'ACTIVE') {
      // A acao que da razao a esta tabela existir num contrato ativo: botao
      // redondo preenchido, com o caminhao de volta, e nao mais um icone
      // apagado de tecla Enter no meio da linha.
      return [{
        key: 'return',
        label: t('contract.items.return'),
        icon: 'mdi-truck-check-outline',
        method: 'PUT',
        path: `/elease/status/${current.id}`,
        primary: true,
        unavailable: row => !isOut(byItemId.value.get(row.id)),
      }]
    }

    return []
  })

  /**
   * Voltou para manutencao ou foi roubado, e ainda nao ganhou substituto. O
   * substituto aponta para quem ele substitui; o que quebrar tambem pode ser trocado.
   */
  const replaceable = computed(() => {
    const replaced = new Set(leaseItems.value.map(item => item.replacesItemId).filter(Boolean))

    return leaseItems.value.filter(item =>
      (item.finalStatus === 'MAINTENANCE' || item.finalStatus === 'STOLEN') && !replaced.has(item.id))
  })

  /* ------------------------------- acessorios ------------------------------ */

  interface AccessoryRow extends Record<string, unknown> {
    id: string
    name: string
    indemnity: string
  }

  const accessories = computed<AccessoryRow[]>(() =>
    (contract.value?.leaseItemAccessories ?? []).map(accessory => ({
      id: accessory.id,
      name: accessory.name,
      indemnity: formatMoney(accessory.p_indemnity),
    })),
  )

  const accessoryColumns = computed<Column<AccessoryRow>[]>(() => [
    { key: 'name', label: t('common.name') },
    { key: 'indemnity', label: t('rates.indemnity'), align: 'end', width: '160px' },
  ])

  /* ------------------------------ financeiro ------------------------------ */

  /** Cancelado nao cobra nada: a secao so aparece quando ha conta a mostrar. */
  const showFinancial = computed(() =>
    !!contract.value && contract.value.status !== 'CANCELLED' && session.can('GET', '/finantial/:id'))

  const statement = shallowRef<ContractStatement | null>(null)
  const statementLoading = ref(false)
  const statementError = ref<string | null>(null)

  async function loadStatement (): Promise<void> {
    const current = contract.value

    if (!current || !showFinancial.value) {
      statement.value = null

      return
    }

    statementLoading.value = true
    statementError.value = null

    try {
      const result = await financial.statement(current.id)

      // Outro contrato aberto no meio do caminho nao herda este extrato.
      if (contract.value?.id === current.id) {
        statement.value = result
      }
    } catch (error) {
      statementError.value = errorMessage(error)
    } finally {
      statementLoading.value = false
    }
  }

  // Toda acao rele o contrato, e o extrato vem junto: volta, troca, fechamento.
  watch(contract, (current, previous) => {
    if (current?.id !== previous?.id) {
      statement.value = null
    }

    void loadStatement()
  })

  const financialDescription = computed(() => {
    switch (contract.value?.status) {
      case 'PENDING': {
        return t('contract.financial.pending')
      }
      case 'ACTIVE': {
        return t('contract.financial.active')
      }
      default: {
        return statement.value?.frozen ? t('contract.financial.completed') : t('contract.financial.completedComputed')
      }
    }
  })

  /* -------------------------------- acoes -------------------------------- */

  const headerActions = computed<HeaderAction[]>(() => {
    const current = contract.value

    if (!current) {
      return []
    }

    const id = current.id

    switch (current.status) {
      case 'PENDING': {
        return [
          { key: 'cancel', label: t('contract.actions.cancel'), icon: 'mdi-cancel', method: 'POST', path: `/elease/cancel/${id}`, color: 'error', variant: 'text' },
          { key: 'add', label: t('contract.actions.add'), icon: 'mdi-plus', method: 'PUT', path: `/elease/add/${id}`, variant: 'tonal' },
          {
            key: 'document',
            label: current.contract_generated ? t('contract.actions.regenerate') : t('contract.actions.generate'),
            icon: 'mdi-file-download-outline',
            method: 'POST',
            path: `/generate/contract/${id}`,
            variant: current.contract_generated ? 'outlined' : 'flat',
          },
          // Sem o documento a API recusa comecar. O botao so aparece quando o caminho existe.
          ...(current.contract_generated
            ? [{ key: 'start', label: t('contract.actions.start'), icon: 'mdi-play', method: 'POST', path: `/elease/start/${id}` }]
            : []),
        ]
      }
      case 'ACTIVE': {
        return [
          { key: 'statement', label: t('contract.actions.statement'), icon: 'mdi-file-chart-outline', method: 'POST', path: `/generate/finantial/${id}`, variant: 'outlined' },
          ...(replaceable.value.length > 0
            ? [{ key: 'replace', label: t('contract.actions.replace'), icon: 'mdi-swap-horizontal', method: 'PUT', path: `/elease/replace/${id}`, variant: 'tonal' as const }]
            : []),
          { key: 'close', label: t('contract.actions.close'), icon: 'mdi-flag-checkered', method: 'POST', path: `/elease/close/${id}` },
        ]
      }
      case 'COMPLETED': {
        return [
          { key: 'closure', label: t('contract.actions.closure'), icon: 'mdi-file-download-outline', method: 'POST', path: `/generate/closure/${id}`, variant: 'outlined' },
        ]
      }
      default: {
        return []
      }
    }
  })

  const dialogs = reactive({ add: false, return: false, replace: false })
  const returning = ref<LeaseItem | null>(null)

  type PendingKind = 'start' | 'cancel' | 'close' | 'remove'

  const pending = useConfirm<{ kind: PendingKind, item?: LeaseItem }>()

  const confirmation = computed(() => {
    const target = pending.target
    const code = target?.item ? unitCode(target.item.equipmentCode, target.item.equipmentSuffix) : ''

    switch (target?.kind) {
      case 'start': {
        return { title: t('contract.confirm.startTitle'), message: t('contract.confirm.startMessage'), label: t('contract.actions.start'), destructive: false }
      }
      case 'cancel': {
        return { title: t('contract.confirm.cancelTitle'), message: t('contract.confirm.cancelMessage'), label: t('contract.actions.cancel'), destructive: true }
      }
      case 'close': {
        return { title: t('contract.confirm.closeTitle'), message: t('contract.confirm.closeMessage'), label: t('contract.actions.close'), destructive: false }
      }
      case 'remove': {
        return { title: t('contract.confirm.removeTitle'), message: t('contract.confirm.removeMessage', { code }), label: t('contract.items.remove'), destructive: true }
      }
      default: {
        return { title: '', message: '', label: '', destructive: false }
      }
    }
  })

  const downloading = ref(false)

  async function download (kind: 'document' | 'statement' | 'closure'): Promise<void> {
    const current = contract.value

    if (!current || downloading.value) {
      return
    }

    downloading.value = true

    try {
      if (kind === 'document') {
        saveDocument(await store.contractDocument(current.id), t('documents.contractFile'))
        toast.success(t('documents.contractReady'), { description: t('documents.contractReadyDescription') })
      } else if (kind === 'statement') {
        saveDocument(await store.statementDocument(current.id), t('documents.statementFile'))
        toast.success(t('documents.downloaded'))
      } else {
        saveDocument(await store.closureDocument(current.id), t('documents.closureFile'))
        toast.success(t('documents.downloaded'))
      }
    } catch (error) {
      toast.error(t('documents.failed'), { description: errorMessage(error) })
    } finally {
      downloading.value = false
    }
  }

  function onAction (key: string): void {
    switch (key) {
      case 'document':
      case 'statement':
      case 'closure': {
        void download(key)

        break
      }
      case 'add':
      case 'replace': {
        dialogs[key] = true

        break
      }
      case 'start':
      case 'cancel':
      case 'close': {
        pending.ask({ kind: key })

        break
      }
    // No default
    }
  }

  function onItemAction (key: string, row: ItemRow): void {
    const item = byItemId.value.get(row.id)

    if (!item) {
      return
    }

    if (key === 'return') {
      returning.value = item
      dialogs.return = true
    } else if (key === 'remove') {
      pending.ask({ kind: 'remove', item })
    }
  }

  /** O 400 do fechamento traz os itens sem volta. A mensagem diz quais sao. */
  function withPendingItems (error: unknown): unknown {
    const items = (error instanceof ApiError ? (error.payload as { equipments?: unknown } | null)?.equipments : null)

    if (!(error instanceof ApiError) || !Array.isArray(items) || items.length === 0) {
      return error
    }

    const codes = (items as LeaseItem[]).map(item => unitCode(item.equipmentCode, item.equipmentSuffix))

    return new ApiError(error.status, t('contract.closeBlocked', { items: codes.join(', ') }), error.code, error.payload)
  }

  async function runPending (): Promise<void> {
    const target = pending.target
    const current = contract.value

    if (!target || !current) {
      return
    }

    const ok = await pending.confirm(async ({ kind, item }) => {
      switch (kind) {
        case 'start': {
          await store.start(current.id)

          break
        }
        case 'cancel': {
          await store.cancel(current.id)

          break
        }
        case 'close': {
          await store.close(current.id).catch(error => {
            throw withPendingItems(error)
          })

          break
        }
        case 'remove': {
          if (item) {
            await store.removeEquipment(current.id, [item.equipmentId])
          }

          break
        }
      // No default
      }
    })

    if (ok) {
      toast.success(t(`contract.done.${target.kind}`))
    }
  }
</script>

<style scoped>
/* O aviso em si e global, em `styles/main.scss`. Aqui, so o respiro abaixo do ciclo. */
.note {
  margin-top: 20px;
}
</style>
