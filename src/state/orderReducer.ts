import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { calcCheckout } from '@/lib/checkout'
import { expiresAtFor, pointsForAmount, unexpiredEarnEntries } from '@/lib/points'
import { formatTime, nowIso } from '@/lib/datetime'
import type { AppAction, AppState, PointEntry, PointsCoupon } from '@/types'
import { createInitialHotelState } from '@/state/hotelReducer'

export const initialState: AppState = {
  appModule: 'hotpot',
  view: 'home',
  table: null,
  diners: ['姚乾', '林溪', '陈默'],
  cart: [],
  orderItems: [],
  orderStage: 'submitted',
  soldOut: ['p8'],
  services: [],
  paid: false,
  lastMessage: i18next.t('message.welcome'),
  points: { balance: 0, entries: [], coupons: [] },
  hotel: createInitialHotelState(),
}

const stageMessages: Record<string, string> = {
  submitted: 'message.stage_submitted',
  accepted: 'message.stage_accepted',
  cooking: 'message.stage_cooking',
  served: 'message.stage_served',
}

function earnEntry(amount: number, noteKey: PointEntry['noteKey']): PointEntry {
  const now = nowIso()
  return {
    id: uid(),
    type: 'earn',
    amount,
    createdAt: now,
    noteKey,
    expiresAt: expiresAtFor(now),
  }
}

function deductEntry(type: 'redeem' | 'refund' | 'expire', amount: number, noteKey: PointEntry['noteKey'], refId?: string): PointEntry {
  return { id: uid(), type, amount: -Math.abs(amount), createdAt: nowIso(), noteKey, expiresAt: null, refId }
}

function localizeServiceType(key: string): string {
  if (key === 'service.broth') return i18next.t('service.broth.name')
  if (key === 'service.drinks') return i18next.t('service.drinks.name')
  if (key === 'service.utensils') return i18next.t('service.utensils.name')
  if (key === 'service.bill') return i18next.t('service.bill.name')
  return key
}

function migratePointNote(entry: PointEntry): PointEntry {
  if (entry.noteKey) return entry
  const legacyMap: Record<string, PointEntry['noteKey']> = {
    '消费获赠': 'earn',
    '兑换菜品券': 'redeem',
    '退菜回退': 'refund',
    '积分过期': 'expire',
    '演示发放': 'grant',
    'Earned from purchase': 'earn',
    'Redeemed dish coupon': 'redeem',
    'Dish return refund': 'refund',
    'Points expired': 'expire',
    'Demo grant': 'grant',
  }
  const legacyNote = entry.note ?? ''
  return { ...entry, noteKey: legacyMap[legacyNote] ?? 'grant' }
}

function migrateState(state: AppState): AppState {
  let changed = false
  const entries = state.points.entries.map((entry) => {
    const migrated = migratePointNote(entry)
    if (migrated !== entry) changed = true
    return migrated
  })
  const services = state.services.map((request) => {
    const key = String(request.typeKey ?? '')
    if (key.startsWith('service.')) return request
    const legacyType = String(request.type ?? '')
    const reverseMap: Record<string, AppState['services'][number]['typeKey']> = {
      '加汤': 'service.broth',
      'Add broth': 'service.broth',
      '酒水饮料': 'service.drinks',
      'Drinks': 'service.drinks',
      '餐具': 'service.utensils',
      'Utensils': 'service.utensils',
      '结账': 'service.bill',
      'Bill': 'service.bill',
    }
    const typeKey = reverseMap[legacyType] ?? 'service.broth'
    changed = true
    return { ...request, typeKey }
  })
  if (!changed) return state
  return { ...state, points: { ...state.points, entries }, services }
}

export function orderReducer(state: AppState, action: AppAction): AppState {
  const current = migrateState(state)
  switch (action.type) {
    case 'BIND_TABLE':
      return { ...current, table: action.table, view: 'welcome', lastMessage: i18next.t('message.bind_table', { table: action.table }) }
    case 'SET_VIEW':
      return { ...current, view: action.view }
    case 'ADD_CART': {
      const same = current.cart.find((item) => item.productId === action.item.productId && item.spec === action.item.spec && item.orderedBy === action.item.orderedBy)
      const cart = same
        ? current.cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current.cart, action.item]
      return { ...current, cart, lastMessage: i18next.t('message.add_cart', { name: action.item.orderedBy, dish: action.item.name }) }
    }
    case 'CHANGE_QTY': {
      const cart = current.cart
        .map((item) => item.uid === action.uid ? { ...item, quantity: item.quantity + action.delta } : item)
        .filter((item) => item.quantity > 0)
      return { ...current, cart }
    }
    case 'SUBMIT_ORDER': {
      if (!current.cart.length) return current
      const additions = current.cart.map((item) => ({ ...item, stage: 'submitted' as const }))
      return {
        ...current,
        orderItems: [...current.orderItems, ...additions],
        cart: [],
        orderStage: 'submitted',
        view: 'order',
        lastMessage: current.orderItems.length ? i18next.t('message.order_additional') : i18next.t('message.order_submitted'),
      }
    }
    case 'SET_STAGE':
      return {
        ...current,
        orderStage: action.stage,
        orderItems: current.orderItems.map((item) => ({ ...item, stage: action.stage })),
        lastMessage: i18next.t(stageMessages[action.stage]),
      }
    case 'TOGGLE_SOLD_OUT':
      return {
        ...current,
        soldOut: current.soldOut.includes(action.productId)
          ? current.soldOut.filter((id) => id !== action.productId)
          : [...current.soldOut, action.productId],
        lastMessage: i18next.t('message.soldout_updated'),
      }
    case 'CALL_SERVICE': {
      const serviceKey = action.service
      const serviceName = localizeServiceType(serviceKey)
      return {
        ...current,
        services: [...current.services, { id: uid(), typeKey: serviceKey as AppState['services'][number]['typeKey'], createdAt: nowIso(), status: 'waiting' } as AppState['services'][number]],
        lastMessage: i18next.t('message.service_called', { service: serviceName }),
      }
    }
    case 'RESPOND_SERVICES':
      return { ...current, services: current.services.map((service) => ({ ...service, status: 'responded' })), lastMessage: i18next.t('message.service_responded') }
    case 'REQUEST_CANCEL':
      return {
        ...current,
        orderItems: current.orderItems.map((item) => item.uid === action.uid ? { ...item, cancelState: 'requested' } : item),
        lastMessage: i18next.t('message.cancel_requested'),
      }
    case 'PAY': {
      if (current.paid) return current
      const checkout = calcCheckout(current.orderItems, current.points.coupons, action.couponIds)
      const coupons: PointsCoupon[] = current.points.coupons.map((coupon) =>
        action.couponIds.includes(coupon.id) ? { ...coupon, used: true } : coupon,
      )
      let points = current.points
      let message: string
      if (checkout.earned > 0) {
        const earned = pointsForAmount(checkout.basePayable)
        points = {
          ...points,
          balance: points.balance + earned,
          entries: [...points.entries, earnEntry(earned, 'earn')],
          coupons,
        }
        message = i18next.t('message.points_earned', { count: earned })
      } else {
        points = { ...points, coupons }
        message = i18next.t('message.paid')
      }
      return { ...current, points, paid: true, lastMessage: message }
    }
    case 'REDEEM_POINTS': {
      if (action.points <= 0 || current.points.balance < action.points) return current
      const coupon: PointsCoupon = {
        id: uid(),
        value: action.value,
        redeemedPoints: action.points,
        createdAt: nowIso(),
        used: false,
      }
      return {
        ...current,
        points: {
          balance: current.points.balance - action.points,
          entries: [...current.points.entries, deductEntry('redeem', action.points, 'redeem')],
          coupons: [...current.points.coupons, coupon],
        },
        lastMessage: i18next.t('message.redeem_success'),
      }
    }
    case 'GRANT_POINTS': {
      if (action.points <= 0) return current
      return {
        ...current,
        points: {
          ...current.points,
          balance: current.points.balance + action.points,
          entries: [...current.points.entries, earnEntry(action.points, 'grant')],
        },
        lastMessage: i18next.t('message.points_granted', { count: action.points }),
      }
    }
    case 'APPROVE_CANCEL': {
      const item = current.orderItems.find((entry) => entry.uid === action.uid)
      if (!item || item.cancelState === 'approved') return current
      const orderItems = current.orderItems.map((entry) => entry.uid === action.uid ? { ...entry, cancelState: 'approved' as const } : entry)
      if (!current.paid) {
        return { ...current, orderItems, lastMessage: i18next.t('message.cancel_approved') }
      }
      const refundPoints = pointsForAmount(item.price * item.quantity)
      if (refundPoints <= 0) {
        return { ...current, orderItems, lastMessage: i18next.t('message.cancel_approved') }
      }
      return {
        ...current,
        orderItems,
        points: {
          ...current.points,
          balance: Math.max(0, current.points.balance - refundPoints),
          entries: [...current.points.entries, deductEntry('refund', refundPoints, 'refund')],
        },
        lastMessage: i18next.t('message.refund_points', { count: refundPoints }),
      }
    }
    case 'EXPIRE_POINTS': {
      const expiring = unexpiredEarnEntries(current.points.entries)
      if (!expiring.length) return current
      const expireSum = expiring.reduce((sum, entry) => sum + entry.amount, 0)
      const expireEntries = expiring.map((entry) => deductEntry('expire', entry.amount, 'expire', entry.id))
      return {
        ...current,
        points: {
          ...current.points,
          balance: Math.max(0, current.points.balance - expireSum),
          entries: [...current.points.entries, ...expireEntries],
        },
        lastMessage: i18next.t('message.points_expired', { count: expireSum }),
      }
    }
    case 'RESET':
      return { ...initialState, lastMessage: i18next.t('message.reset') }
    case 'SET_MESSAGE':
      return { ...current, lastMessage: action.message }
    default:
      return current
  }
}

export function serviceTypeLabel(request: Pick<AppState['services'][number], 'type' | 'typeKey'>): string {
  if (request.typeKey) return localizeServiceType(request.typeKey)
  return request.type ?? ''
}

export function ledgerTime(iso: string): string {
  return formatTime(iso)
}
