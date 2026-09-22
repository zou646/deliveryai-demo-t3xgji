import type { OrderItem, PointsCoupon } from '@/types'

export interface CheckoutCalc {
  /** 菜品小计（排除已确认退菜项） */
  subtotal: number
  /** 会员菜品券满减（≥¥100 减 ¥30） */
  discount: number
  /** 计分基数 = 应付合计（满减后、兑换券抵扣前） */
  basePayable: number
  /** 勾选兑换券面值合计 */
  couponValue: number
  /** 兑换券抵扣上限 = basePayable × 50% */
  couponCap: number
  /** 实际生效兑换券抵扣 = min(couponValue, couponCap) */
  effectiveCoupon: number
  /** 应付 = basePayable − effectiveCoupon（≥0，不找零） */
  payable: number
  /** 入账积分 = ceil(basePayable)，basePayable ≤ 0 时为 0 */
  earned: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/**
 * 结账金额与计分基数的唯一计算实现：CheckoutView 展示与 reducer PAY 同源调用，
 * 金额一律以分（2 位小数）舍入，积分一律整数（向上取整）。
 */
export function calcCheckout(
  items: OrderItem[],
  coupons: PointsCoupon[],
  selectedCouponIds: string[],
): CheckoutCalc {
  const subtotal = round2(
    items
      .filter((item) => item.cancelState !== 'approved')
      .reduce((sum, item) => sum + item.price * item.quantity, 0),
  )
  const discount = subtotal >= 100 ? 30 : 0
  const basePayable = round2(subtotal - discount)
  const couponValue = round2(
    coupons
      .filter((coupon) => selectedCouponIds.includes(coupon.id))
      .reduce((sum, coupon) => sum + coupon.value, 0),
  )
  const couponCap = round2(basePayable * 0.5)
  const effectiveCoupon = round2(Math.min(couponValue, couponCap))
  const payable = round2(Math.max(0, basePayable - effectiveCoupon))
  const earned = basePayable <= 0 ? 0 : Math.ceil(basePayable)
  return { subtotal, discount, basePayable, couponValue, couponCap, effectiveCoupon, payable, earned }
}
