import type { PointsTier } from '@/types'

/** 积分兑换档位表：档位积分 → 菜品券面值（元）。100 积分 = 1 元（POINTS_PER_YUAN）。 */
export const POINTS_TIERS: PointsTier[] = [
  { points: 500, value: 5 },
  { points: 1000, value: 10 },
  { points: 2000, value: 20 },
]

/** 积分有效期（月）：自入账起滚动有效 */
export const POINTS_VALID_MONTHS = 12

/** 兑换换算基准：100 积分 = 1 元 */
export const POINTS_PER_YUAN = 100
