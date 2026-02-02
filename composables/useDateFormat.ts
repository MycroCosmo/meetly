// composables/useDateFormat.ts
export const useDateFormat = () => {
  const formatDateTime = (isoString: string): string =>
    new Date(isoString).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

  const formatTime = (isoString: string): string =>
    new Date(isoString).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })

  const formatKoreanDate = (isoDate: string): string => {
    const [year, month, day] = isoDate.split('-').map(Number)
    const date = new Date(year, month - 1, day, 0, 0, 0, 0)
    const weekdayKo = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdayKo[date.getDay()]
    return `${month}/${day} (${weekday})`
  }

  return {
    formatDateTime,
    formatTime,
    formatKoreanDate
  }
}
