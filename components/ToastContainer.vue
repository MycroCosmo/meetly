<template>
  <div class="toast-container">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast"
      :class="t.type"
    >
      {{ t.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'
const { toasts } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}
.toast {
  min-width: 220px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 0.9rem;
  color: #fff;
  text-align: center;
}
.toast.success { background: #28a745; }
.toast.error   { background: #dc3545; }
.toast.info    { background: #007bff; }
.toast.warning { background: #f59e0b; }
</style>
