<template>
  <div class="expenses-tab">
    <div class="section">
      <h2>비용 항목 추가</h2>
      <form @submit.prevent="handleAddExpense" class="expense-form">
        <div class="form-group">
          <label>항목 이름 *</label>
          <input
            v-model="form.title"
            type="text"
            placeholder="예: 저녁 식사"
            required
            maxlength="255"
          />
        </div>

        <div class="form-group">
          <label>총액 (원) *</label>
          <input
            v-model.number="form.totalAmount"
            type="number"
            min="0"
            step="0.01"
            placeholder="50000"
            required
          />
        </div>

        <div class="form-group">
          <label>분할 유형 *</label>
          <select v-model="form.splitType" required>
            <option value="EQUAL">균등 분할 (1/n)</option>
            <option value="CUSTOM">사용자 지정</option>
          </select>
        </div>

        <button type="submit" class="btn-primary" :disabled="loading">추가</button>
      </form>
    </div>

    <div class="section">
      <h2>비용 항목</h2>

      <div v-if="expenses.length === 0" class="empty-state">
        아직 비용 항목이 없습니다.
      </div>

      <div v-else class="expenses-list">
        <div v-for="expense in expenses" :key="expense.id" class="expense-item">
          <div class="expense-header">
            <h3>{{ expense.title }}</h3>
            <p class="expense-amount">{{ formatCurrency(expense.total_amount) }}원</p>
          </div>

          <p class="expense-split">
            분할: {{ expense.split_type === 'EQUAL' ? '균등' : '사용자 지정' }}
          </p>

          <div v-if="expense.split_type === 'CUSTOM'" class="custom-split-section">
            <h4>분할 금액 설정</h4>

            <div class="shares-list">
              <div v-for="p in roomParticipants" :key="p.id" class="share-item">
                <label>{{ p.nickname }}</label>
                <input
                  :value="getShareAmount(expense.id, p.id)"
                  @input="handleShareChange(expense.id, p.id, $event)"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                />
              </div>
            </div>

            <div class="share-total">
              합계: {{ formatCurrency(getShareTotal(expense.id)) }}원
              <span v-if="!isShareTotalValid(expense)" class="error-text">
                (총액과 일치하지 않습니다)
              </span>
            </div>
          </div>

          <div v-else class="equal-split-section">
            <h4>분할 내역</h4>

            <div class="shares-list">
              <div
                v-for="share in getExpenseShares(expense.id)"
                :key="share.participant_id"
                class="share-item"
              >
                <span>{{ getParticipantName(share.participant_id) }}</span>
                <span class="share-amount">{{ formatCurrency(share.amount) }}원</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import type { Room, Participant } from '~/composables/useRoom'
import { useRlsContext } from '~/composables/useRlsContext'

type SplitType = 'EQUAL' | 'CUSTOM'

type ExpenseItem = {
  id: string
  room_id: string
  title: string
  total_amount: number
  payer_participant_id: string
  split_type: SplitType
  created_at?: string
}

type ExpenseShare = {
  expense_item_id: string
  participant_id: string
  amount: number
  created_at?: string
}

type RoomParticipant = {
  id: string
  room_id: string
  nickname: string
  user_id: string | null
  token_hash: string | null
  created_at?: string
}

const props = defineProps<{
  room: Room
  participant: Participant
}>()

const supabase = useSupabase()
const { setRlsContextIfPossible } = useRlsContext()

const form = reactive({
  title: '',
  totalAmount: 0,
  splitType: 'EQUAL' as SplitType
})

const expenses = ref<ExpenseItem[]>([])
const shares = ref<Record<string, ExpenseShare[]>>({})
const roomParticipants = ref<RoomParticipant[]>([])
const loading = ref(false)
const error = ref('')

const getRoomIdOrThrow = () => {
  const rid = props.room.id
  if (!rid) throw new Error('room.id is missing')
  return rid
}

const getParticipantIdOrThrow = () => {
  const pid = props.participant.id
  if (!pid) throw new Error('participant.id is missing')
  return pid
}

const loadExpenses = async () => {
  const roomId = getRoomIdOrThrow()

  const { data, error: err } = await supabase
    .from('expense_items')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })

  if (err) throw err
  expenses.value = (data ?? []) as ExpenseItem[]
  await loadShares()
}

const loadShares = async () => {
  const expenseIds = expenses.value.map((e) => e.id)
  if (expenseIds.length === 0) {
    shares.value = {}
    return
  }

  const { data, error: err } = await supabase
    .from('expense_shares')
    .select('*')
    .in('expense_item_id', expenseIds)

  if (err) throw err

  const map: Record<string, ExpenseShare[]> = {}
  ;(data ?? []).forEach((row: any) => {
    const r = row as ExpenseShare
    if (!map[r.expense_item_id]) map[r.expense_item_id] = []
    map[r.expense_item_id].push(r)
  })
  shares.value = map
}

const loadParticipants = async () => {
  const roomId = getRoomIdOrThrow()

  const { data, error: err } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', roomId)

  if (err) throw err
  roomParticipants.value = (data ?? []) as RoomParticipant[]
}

const handleAddExpense = async () => {
  if (!form.title.trim() || form.totalAmount <= 0) {
    error.value = '항목 이름과 총액을 올바르게 입력해주세요'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const roomId = getRoomIdOrThrow()
    const participantId = getParticipantIdOrThrow()

    await setRlsContextIfPossible()

    const { error: err } = await supabase
      .from('expense_items')
      .insert({
        room_id: roomId,
        title: form.title.trim(),
        total_amount: form.totalAmount,
        payer_participant_id: participantId,
        split_type: form.splitType
      })

    if (err) throw err

    form.title = ''
    form.totalAmount = 0
    form.splitType = 'EQUAL'

    await loadExpenses()
  } catch (e: any) {
    error.value = e?.message || '비용 항목 추가에 실패했습니다'
    if (import.meta.dev) console.error(e)
  } finally {
    loading.value = false
  }
}

const handleShareChange = async (expenseId: string, participantId: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const amount = Number.parseFloat(target.value) || 0

  try {
    await setRlsContextIfPossible()

    const { error: err } = await supabase
      .from('expense_shares')
      .upsert(
        {
          expense_item_id: expenseId,
          participant_id: participantId,
          amount
        },
        { onConflict: 'expense_item_id,participant_id' }
      )

    if (err) throw err

    await loadShares()
  } catch (e: any) {
    if (import.meta.dev) console.error(e)
    error.value = e?.message || '분할 금액 설정에 실패했습니다'
  }
}

const getExpenseShares = (expenseId: string): ExpenseShare[] => shares.value[expenseId] || []

const getShareAmount = (expenseId: string, participantId: string) => {
  const share = getExpenseShares(expenseId).find((s) => s.participant_id === participantId)
  return share?.amount ?? 0
}

const getShareTotal = (expenseId: string) =>
  getExpenseShares(expenseId).reduce((sum, s) => sum + (Number(s.amount) || 0), 0)

const isShareTotalValid = (expense: ExpenseItem) => {
  if (expense.split_type !== 'CUSTOM') return true
  const total = getShareTotal(expense.id)
  return Math.abs(total - Number(expense.total_amount)) < 0.01
}

const getParticipantName = (participantId: string) => {
  const p = roomParticipants.value.find((x) => x.id === participantId)
  return p?.nickname ?? '알 수 없음'
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('ko-KR').format(amount)

onMounted(() => {
  Promise.all([loadExpenses(), loadParticipants()]).catch((e) => {
    if (import.meta.dev) console.error(e)
  })
})
</script>


<style scoped>
.expenses-tab { display: flex; flex-direction: column; gap: 2rem; }
.section { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
h2 { font-size: 1.25rem; margin-bottom: 1rem; color: #333; }
.expense-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
label { font-size: 0.9rem; font-weight: 500; color: #555; }
input, select { padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
.btn-primary { padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.empty-state { color: #888; text-align: center; padding: 2rem; }
.expenses-list { display: flex; flex-direction: column; gap: 1.5rem; }
.expense-item { padding: 1.25rem; background: #f9f9f9; border-radius: 8px; }
.expense-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.expense-header h3 { font-size: 1.1rem; color: #333; }
.expense-amount { font-size: 1.2rem; font-weight: 600; color: #007bff; }
.expense-split { color: #666; font-size: 0.9rem; margin-bottom: 1rem; }
.custom-split-section, .equal-split-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #ddd; }
h4 { font-size: 0.95rem; margin-bottom: 0.75rem; color: #555; }
.shares-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
.share-item { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.share-item input { flex: 1; max-width: 150px; }
.share-amount { font-weight: 600; color: #333; }
.share-total { padding: 0.75rem; background: #e9ecef; border-radius: 6px; font-weight: 600; text-align: right; }
.error-text { color: #dc3545; font-size: 0.9rem; }
.error-message { padding: 0.75rem; background: #fee; color: #c33; border-radius: 8px; font-size: 0.9rem; }
</style>
