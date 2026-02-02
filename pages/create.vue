<template>
  <div class="create-page">
    <div class="container">
      <h1>새 모임 만들기</h1>

      <form @submit.prevent="handleCreate" class="form">
        <div class="form-group">
          <label for="title">모임 제목 *</label>
          <input
            id="title"
            v-model="form.title"
            type="text"
            placeholder="예: 서울 여행 계획"
            required
            maxlength="255"
          />
        </div>

        <div class="form-group">
          <label for="nickname">내 닉네임 *</label>
          <input
            id="nickname"
            v-model="form.nickname"
            type="text"
            placeholder="예: 이안"
            required
            maxlength="30"
          />
          <p class="help">
            방을 만든 첫 참가자는 자동으로 방장이 됩니다.
          </p>
        </div>

        <div class="form-group">
          <label for="description">설명</label>
          <textarea
            id="description"
            v-model="form.description"
            placeholder="모임에 대한 설명을 입력하세요"
            rows="4"
          />
        </div>

        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? '생성 중...' : '모임 만들기' }}
        </button>
      </form>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const router = useRouter()
const { createRoom } = useRoom()

const form = reactive({
  title: '',
  nickname: '',
  description: ''
})

const loading = ref(false)
const error = ref('')

const handleCreate = async () => {
  const title = form.title.trim()
  const nickname = form.nickname.trim()
  const description = form.description.trim()

  if (!title) {
    error.value = '제목을 입력해주세요'
    return
  }
  if (!nickname) {
    error.value = '닉네임을 입력해주세요'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const { room } = await createRoom(
      title,
      description || '',
      nickname
    )

    // ✅ rooms 테이블은 code가 있으므로 code로 이동해야 함
    router.push(`/m/${room.code}`)
  } catch (err: any) {
    console.error('create failed:', err, err?.context)
    error.value =
      err?.message ||
      err?.context?.body?.error ||
      '모임 생성에 실패했습니다'
  } finally {
    loading.value = false
  }
}
</script>


<style scoped>
.create-page {
  min-height: 100vh;
  padding: 2rem 1rem;
  background: #f5f5f5;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 2rem;
  color: #333;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 600;
  color: #555;
  font-size: 0.9rem;
}

input,
textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #007bff;
}

textarea {
  resize: vertical;
}

.help {
  margin: 0;
  color: #777;
  font-size: 0.85rem;
  line-height: 1.35;
}

.btn-primary {
  padding: 0.875rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
