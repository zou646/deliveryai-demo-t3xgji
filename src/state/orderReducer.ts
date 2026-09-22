import i18next from 'i18next'
import { uid } from '@/lib/utils'
import { calcCheckout } from '@/lib/checkout'
import { expiresAtFor, pointsForAmount, unexpiredEarnEntries } from '@/lib/points'
import type { AppAction, AppState, PointEntry, PointsCoupon } from '@/types'

export const initialState: AppState = {
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
}

const stageMessages: Record<string, string> = {
  submitted: 'message.stage_submitted',
  accepted: 'message.stage_accepted',
  cooking: 'message.stage_cooking',
  served: 'message.stage_served',
}

const localeForLanguage = (lang: string) => (lang === 'en' ? 'en-US' : 'zh-CN')

const localeTime = () => new Date().toLocaleTimeString(localeForLanguage(i18next.language), { hour: '2-digit', minute: '2-digit' })

function earnEntry(amount: number, note: string): PointEntry {
  return {
    id: uid(),
    type: 'earn',
    amount,
    createdAt: localeTime(),
    note,
    expiresAt: expiresAtFor(new Date().toISOString()),
  }
}

function deductEntry(type: 'redeem' | 'refund' | 'expire', amount: number, note: string, refId?: string): PointEntry {
  return { id: uid(), type, amount: -Math.abs(amount), createdAt: localeTime(), note, expiresAt: null, refId }
}

export function orderReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'BIND_TABLE':
      return { ...state, table: action.table, view: 'welcome', lastMessage: i18next.t('message.bind_table', { table: action.table }) }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'ADD_CART': {
      const same = state.cart.find((item) => item.productId === action.item.productId && item.spec === action.item.spec && item.orderedBy === action.item.orderedBy)
      const cart = same
        ? state.cart.map((item) => item.uid === same.uid ? { ...item, quantity: item.quantity + 1 } : item)
        : [...state.cart, action.item]
      return { ...state, cart, lastMessage: i18next.t('message.add_cart', { name: action.item.orderedBy, dish: action.item.name }) }
    }
    case 'CHANGE_QTY': {
      const cart = state.cart
        .map((item) => item.uid === action.uid ? { ...item, quantity: item.quantity + action.delta } : item)
        .filter((item) => item.quantity > 0)
      return { ...state, cart }
    }
    case 'SUBMIT_ORDER': {
      if (!state.cart.length) return state
      const additions = state.cart.map((item) => ({ ...item, stage: 'submitted' as const }))
      return {
        ...state,
        orderItems: [...state.orderItems, ...additions],
        cart: [],
        orderStage: 'submitted',
        view: 'order',
        lastMessage: state.orderItems.length ? i18next.t('message.order_additional') : i18next.t('message.order_submitted'),
      }
    }
    case 'SET_STAGE':
      return {
        ...state,
        orderStage: action.stage,
        orderItems: state.orderItems.map((item) => ({ ...item, stage: action.stage })),
        lastMessage: i18next.t(stageMessages[action.stage]),
      }
    case 'TOGGLE_SOLD_OUT':
      return {
        ...state,
        soldOut: state.soldOut.includes(action.productId)
          ? state.soldOut.filter((id) => id !== action.productId)
          : [...state.soldOut, action.productId],
        lastMessage: i18next.t('message.soldout_updated'),
      }
    case 'CALL_SERVICE': {
      const serviceName = i18next.t(`${action.service}.name`)
      return {
        ...state,
        services: [...state.services, { id: uid(), type: serviceName, createdAt: localeTime(), status: 'waiting' }],
        lastMessage: i18next.t('message.service_called', { service: serviceName }),
      }
    }
    case 'RESPOND_SERVICES':
      return { ...state, services: state.services.map((service) => ({ ...service, status: 'responded' })), lastMessage: i18next.t('message.service_responded') }
    case 'REQUEST_CANCEL':
      return {
        ...state,
        orderItems: state.orderItems.map((item) => item.uid === action.uid ? { ...item, cancelState: 'requested' } : item),
        lastMessage: i18next.t('message.cancel_requested'),
      }
    case 'PAY': {
      // 幂等：已 paid 原样返回，不重复入账（REQ-001.5）
      if (state.paid) return state
      const checkout = calcCheckout(state.orderItems, state.points.coupons, action.couponIds)
      const coupons: PointsCoupon[] = state.points.coupons.map((coupon) =>
        action.couponIds.includes(coupon.id) ? { ...coupon, used: true } : coupon,
      )
      let points = state.points
      let message: string
      if (checkout.earned > 0) {
        const earned = pointsForAmount(checkout.basePayable)
        points = {
          ...points,
          balance: points.balance + earned,
          entries: [...points.entries, earnEntry(earned, i18next.t('points.earn_note'))],
          coupons,
        }
        message = i18next.t('message.points_earned', { count: earned })
      } else {
        points = { ...points, coupons }
        message = i18next.t('message.paid')
      }
      return { ...state, points, paid: true, lastMessage: message }
    }
    case 'REDEEM_POINTS': {
      // 余额不足或非法档位：原样返回（UI 已禁用，reducer 兜底）
      if (action.points <= 0 || state.points.balance < action.points) return state
      const coupon: PointsCoupon = {
        id: uid(),
        value: action.value,
        redeemedPoints: action.points,
        createdAt: localeTime(),
        used: false,
      }
      return {
        ...state,
        points: {
          balance: state.points.balance - action.points,
          entries: [...state.points.entries, deductEntry('redeem', action.points, i18next.t('points.redeem_note'))],
          coupons: [...state.points.coupons, coupon],
        },
        lastMessage: i18next.t('message.redeem_success'),
      }
    }
    case 'GRANT_POINTS': {
      if (action.points <= 0) return state
      return {
        ...state,
        points: {
          ...state.points,
          balance: state.points.balance + action.points,
          entries: [...state.points.entries, earnEntry(action.points, i18next.t('points.grant_note'))],
        },
        lastMessage: i18next.t('message.points_granted', { count: action.points }),
      }
    }
    case 'APPROVE_CANCEL': {
      const item = state.orderItems.find((entry) => entry.uid === action.uid)
      if (!item || item.cancelState === 'approved') return state
      const orderItems = state.orderItems.map((entry) => entry.uid === action.uid ? { ...entry, cancelState: 'approved' as const } : entry)
      // 已支付时按该项金额回退积分（ceil，0 截断）；未支付仅 approved 不回退（REQ-005.3）
      if (!state.paid) {
        return { ...state, orderItems, lastMessage: i18next.t('message.cancel_approved') }
      }
      const refundPoints = pointsForAmount(item.price * item.quantity)
      if (refundPoints <= 0) {
        return { ...state, orderItems, lastMessage: i18next.t('message.cancel_approved') }
      }
      return {
        ...state,
        orderItems,
        points: {
          ...state.points,
          balance: Math.max(0, state.points.balance - refundPoints),
          entries: [...state.points.entries, deductEntry('refund', refundPoints, i18next.t('points.refund_note'))],
        },
        lastMessage: i18next.t('message.refund_points', { count: refundPoints }),
      }
    }
    case 'EXPIRE_POINTS': {
      const expiring = unexpiredEarnEntries(state.points.entries)
      if (!expiring.length) return state
      const expireSum = expiring.reduce((sum, entry) => sum + entry.amount, 0)
      const expireEntries = expiring.map((entry) => deductEntry('expire', entry.amount, i18next.t('points.expire_note'), entry.id))
      return {
        ...state,
        points: {
          ...state.points,
          balance: Math.max(0, state.points.balance - expireSum),
          entries: [...state.points.entries, ...expireEntries],
        },
        lastMessage: i18next.t('message.points_expired', { count: expireSum }),
      }
    }
    case 'RESET':
      return { ...initialState, lastMessage: i18next.t('message.reset') }
    case 'SET_MESSAGE':
      return { ...state, lastMessage: action.message }
    default:
      return state
  }
}
