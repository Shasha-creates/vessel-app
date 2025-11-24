export function formatRelativeTime(iso: string, short = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return short ? 'Now' : 'Just now'
  }
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return short ? 'Now' : 'Just now'
  if (minutes < 60) return short ? `${minutes}m` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return short ? `${hours}h` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return short ? `${days}d` : `${days}d ago`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
