type ToastType = 'success' | 'error' | 'info' | 'warning'

type Toast = {
  id: number
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])
let idSeq = 0

export const useToast = () => {
  const show = (message: string, type: ToastType = 'info', duration = 2000) => {
    const id = ++idSeq
    toasts.value.push({ id, message, type })

    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  return {
    toasts,
    success: (msg: string) => show(msg, 'success', 2000),
    error: (msg: string) => show(msg, 'error', 4000),
    info: (msg: string) => show(msg, 'info', 2000),
    warning: (msg: string) => show(msg, 'warning', 3000)
  }
}
