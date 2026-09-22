import { POINTS_VALID_MONTHS } from '@/data/points'
import type { PointEntry, PointEntryType } from '@/types'

/** 获取积分：1 元 = 1 积分，向上取整（与入账口径一致） */
export function pointsForAmount(amount: number): number {
  return Math.ceil(amount)
}

/** 到期时间：入账时间 + 有效月数，返回 ISO 字符串 */
export function expiresAtFor(createdAt: string): string {
  const date = new Date(createdAt)
  date.setMonth(date.getMonth() + POINTS_VALID_MONTHS)
  return date.toISOString()
}

/** 该 earn 明细是否已被对应的 expire 记录引用（即已过期） */
export function isEarnExpired(entry: PointEntry, entries: PointEntry[]): boolean {
  return entries.some((item) => item.type === 'expire' && item.refId === entry.id)
}

/**
 * 余额推导口径（REQ-007）：所有明细的带符号变动值之和。
 * 过期的 earn 与其匹配的 expire 记录（amount = −earn.amount）净额为零，
 * 因此 Σ(earn 未过期) − Σ(redeem) − Σ(refund) − Σ(expire) 与全部带符号求和等价。
 */
export function pointsBalance(entries: PointEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0)
}

/** 过期处理辅助：取当前未被 expire 引用的 earn 明细（即未过期、待过期的部分） */
export function unexpiredEarnEntries(entries: PointEntry[]): PointEntry[] {
  return entries.filter((entry) => entry.type === 'earn' && !isEarnExpired(entry, entries))
}

export function isPointEntryType(value: string): value is PointEntryType {
  return value === 'earn' || value === 'redeem' || value === 'refund' || value === 'expire'
}
