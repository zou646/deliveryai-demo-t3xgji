import i18next from 'i18next'

export function localeForLanguage(lang?: string): string {
  return (lang ?? i18next.language) === 'en' ? 'en-US' : 'zh-CN'
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatTime(iso: string | null | undefined, lang?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(localeForLanguage(lang), { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string | null | undefined, lang?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString(localeForLanguage(lang), { year: 'numeric', month: '2-digit', day: '2-digit' })
}
