<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="loading" class="overlay" aria-live="polite">
        <div class="box">
          <div class="spinner" />
          <p class="text">페이지 이동 중…</p>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
const { loading } = usePageLoading()
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(245, 245, 245, 0.9);
  display: grid;
  place-items: center;
  z-index: 9998;
}

.box {
  background: white;
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  border: 1px solid #eee;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid #e5e7eb;
  border-top-color: #2563eb;
  animation: spin 0.8s linear infinite;
}

.text {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #374151;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
