<template>
  <div class="page">
    <DlPageHeader
      :actions="headerActions"
      :breadcrumbs="[{ label: t('nav.equipment'), to: '/equipment' }, { label: code }]"
      :description="equipment?.name"
      :title="code"
      :with-menu="false"
      @action="onAction"
      @navigate="to => router.push(to)"
    />

    <DlSkeleton v-if="loading && !equipment" height="220px" variant="block" />

    <DlEmptyState
      v-else-if="loadError && !equipment"
      :description="loadError"
      icon="mdi-alert-circle-outline"
      :title="t('equipmentUnit.loadFailed')"
      tone="error"
    >
      <DlButton icon="mdi-refresh" variant="outlined" @click="load">{{ t('common.tryAgain') }}</DlButton>
    </DlEmptyState>

    <template v-else-if="equipment">
      <DlSectionCard :description="t('equipmentUnit.identification.description')" :title="t('equipmentUnit.identification.title')">
        <DlDescriptionList :items="identification">
          <template #item-status>
            <DlStatusChip :map="EQUIPMENT_STATUS" size="default" :status="equipment.status" />
          </template>

          <template #item-contract>
            <button
              v-if="equipment.eleaseId && session.can('GET', '/elease/:id')"
              class="link"
              type="button"
              @click="router.push({ name: 'contract', params: { id: equipment.eleaseId } })"
            >
              {{ t('equipmentUnit.openContract') }}
            </button>

            <template v-else>{{ equipment.eleaseId ? t('equipmentUnit.inContract') : '—' }}</template>
          </template>
        </DlDescriptionList>
      </DlSectionCard>

      <DlSectionCard :description="t('equipmentUnit.rates.description')" :title="t('equipmentUnit.rates.title')">
        <DlDescriptionList :columns="3" :items="rates" />
      </DlSectionCard>

      <DlSectionCard
        :count="accessories.length"
        :description="t('equipmentUnit.accessories.description')"
        :padded="accessories.length === 0"
        :title="t('nav.accessories')"
      >
        <template v-if="canAssociate" #actions>
          <DlButton icon="mdi-link-variant-plus" variant="tonal" @click="associating = true">{{ t('equipmentUnit.associate') }}</DlButton>
        </template>

        <DlEmptyState
          v-if="accessories.length === 0"
          compact
          :description="t('equipmentUnit.accessories.emptyDescription')"
          icon="mdi-toolbox-outline"
          :title="t('equipmentUnit.accessories.emptyTitle')"
        />

        <DlDataTable
          v-else
          bare
          :columns="accessoryColumns"
          :limit="accessories.length + 1"
          :paged="false"
          :rows="accessories"
        />
      </DlSectionCard>
    </template>

    <EquipmentFormDialog v-model:open="editOpen" :equipment="equipment" />

    <AssociateAccessoriesDialog v-if="equipment" v-model:open="associating" :equipment="equipment" />

    <DlConfirmDialog
      v-model="retirement.open"
      :confirm-label="t('equipment.retire')"
      destructive
      :error="retirement.error"
      :message="t('equipment.retireMessage', { code })"
      :processing="retirement.processing"
      :title="t('equipment.retireTitle')"
      @confirm="retire"
    />
  </div>
</template>

<script lang="ts" setup>
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
  import AssociateAccessoriesDialog from '@/components/AssociateAccessoriesDialog.vue'
  import EquipmentFormDialog from '@/components/EquipmentFormDialog.vue'
  import { useConfirm } from '@/composables/useConfirm'
  import { CONTRACT_EQUIPMENT_STATUS, EQUIPMENT_STATUS } from '@/constants/status'
  import { errorMessage } from '@/services/http'
  import { useEquipmentStore } from '@/stores/equipment'
  import { useSessionStore } from '@/stores/session'
  import { formatDateTime, formatMoney, unitCode } from '@/utils/format'

  /** Ficha de uma unidade: identificacao, tabela de precos e acessorios. */
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const session = useSessionStore()
  const store = useEquipmentStore()

  const equipmentId = computed(() => String(route.params.id))
  const equipment = computed(() => (store.current?.id === equipmentId.value ? store.current : null))

  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load (): Promise<void> {
    loading.value = true
    loadError.value = null

    try {
      await store.fetchOne(equipmentId.value)
    } catch (error) {
      loadError.value = errorMessage(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  const code = computed(() => (equipment.value ? unitCode(equipment.value.code, equipment.value.suffix) : t('pageTitles.equipmentUnit')))

  const identification = computed<DescriptionItem[]>(() => {
    const current = equipment.value

    if (!current) {
      return []
    }

    return [
      { key: 'name', label: t('common.name'), value: current.name },
      { key: 'code', label: t('equipment.code'), value: current.code, mono: true, hint: t('equipmentUnit.codeHint') },
      { key: 'suffix', label: t('equipmentUnit.unit'), value: current.suffix, mono: true },
      { key: 'status', label: t('common.status'), value: current.status },
      { key: 'contract', label: t('equipmentUnit.contract'), value: current.eleaseId },
      { key: 'updatedAt', label: t('common.updated'), value: formatDateTime(current.updatedAt) },
      { key: 'id', label: t('common.identifier'), value: current.id, mono: true, copyable: true },
    ]
  })

  const rates = computed<DescriptionItem[]>(() => {
    const current = equipment.value

    if (!current) {
      return []
    }

    return [
      { key: 'daily', label: t('rates.daily'), value: formatMoney(current.p_diary) },
      { key: 'weekly', label: t('rates.weekly'), value: formatMoney(current.p_weekly) },
      { key: 'biweekly', label: t('rates.biweekly'), value: formatMoney(current.p_biweekly) },
      { key: 'monthly', label: t('rates.monthly'), value: formatMoney(current.p_monthly) },
      { key: 'indemnity', label: t('rates.indemnity'), value: formatMoney(current.p_indemnity), hint: t('equipmentForm.indemnityHint') },
    ]
  })

  interface AccessoryRow extends Record<string, unknown> {
    id: string
    name: string
    indemnity: string
  }

  const accessories = computed<AccessoryRow[]>(() =>
    (equipment.value?.equipmentAccessories ?? []).map(({ accessory }) => ({
      id: accessory.id,
      name: accessory.name,
      indemnity: formatMoney(accessory.p_indemnity),
    })),
  )

  const accessoryColumns = computed<Column<AccessoryRow>[]>(() => [
    { key: 'name', label: t('common.name') },
    { key: 'indemnity', label: t('rates.indemnity'), align: 'end', width: '160px' },
  ])

  /** Associar consome estoque de acessorio, e so vale para equipamento disponivel. */
  const canAssociate = computed(() =>
    equipment.value?.status === 'AVAILABLE' && session.can('POST', '/accessory/associate') && session.can('GET', '/accessory'),
  )

  const headerActions = computed<HeaderAction[]>(() => {
    const current = equipment.value

    // Locado nao se edita nem se retira. O caminho existe de novo quando o contrato devolver.
    if (!current || current.status === 'LEASED') {
      return []
    }

    const path = `/equipment/${current.id}`
    const actions: HeaderAction[] = [
      { key: 'edit', label: t('common.edit'), icon: 'mdi-pencil-outline', method: 'PUT', path, variant: 'outlined' },
    ]

    // Reservado e substituto estao num contrato: desativar deixaria o contrato sem o equipamento.
    if (current.status !== 'RETIRED' && !CONTRACT_EQUIPMENT_STATUS.includes(current.status)) {
      actions.push({ key: 'retire', label: t('equipment.retire'), icon: 'mdi-archive-arrow-down-outline', method: 'DELETE', path, color: 'error', variant: 'text' })
    }

    return actions
  })

  const editOpen = ref(false)
  const associating = ref(false)
  const retirement = useConfirm<string>()

  function onAction (key: string): void {
    const current = equipment.value

    if (!current) {
      return
    }

    if (key === 'edit') {
      editOpen.value = true
    } else if (key === 'retire') {
      retirement.ask(current.id)
    }
  }

  async function retire (): Promise<void> {
    const ok = await retirement.confirm(id => store.retire(id))

    if (ok) {
      toast.success(t('equipment.retired'))
    }
  }
</script>
