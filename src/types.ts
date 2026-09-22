export type OrderStage = 'submitted' | 'accepted' | 'cooking' | 'served'
export type ViewName = 'home' | 'welcome' | 'menu' | 'order' | 'checkout'

export interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  image: string
  badge?: string
  orderedCount?: number
  options?: {
    portion?: string[]
    flavor?: string[]
    spicy?: string[]
  }
}

export interface CartItem {
  uid: string
  productId: string
  name: string
  price: number
  quantity: number
  image: string
  spec: string
  orderedBy: string
}

export interface OrderItem extends CartItem {
  stage: OrderStage
  cancelState?: 'requested' | 'approved'
}

export interface ServiceRequest {
  id: string
  type: string
  createdAt: string
  status: 'waiting' | 'responded'
}

export type PointEntryType = 'earn' | 'redeem' | 'refund' | 'expire'

export interface PointEntry {
  id: string
  type: PointEntryType
  /** 带符号变动值：earn 为 +N；redeem / refund / expire 为 −N */
  amount: number
  createdAt: string
  note: string
  /** 到期时间（ISO 字符串）；仅 earn 必填，其余为 null */
  expiresAt: string | null
  /** 仅 expire 记录引用其来源 earn 明细 id，防止重复过期 */
  refId?: string
}

export interface PointsCoupon {
  id: string
  value: number
  redeemedPoints: number
  createdAt: string
  used: boolean
}

export interface PointsTier {
  points: number
  value: number
}

export interface PointsState {
  balance: number
  entries: PointEntry[]
  coupons: PointsCoupon[]
}

export interface AppState {
  view: ViewName
  table: string | null
  diners: string[]
  cart: CartItem[]
  orderItems: OrderItem[]
  orderStage: OrderStage
  soldOut: string[]
  services: ServiceRequest[]
  paid: boolean
  lastMessage: string
  points: PointsState
}

export type AppAction =
  | { type: 'BIND_TABLE'; table: string }
  | { type: 'SET_VIEW'; view: ViewName }
  | { type: 'ADD_CART'; item: CartItem }
  | { type: 'CHANGE_QTY'; uid: string; delta: number }
  | { type: 'SUBMIT_ORDER' }
  | { type: 'SET_STAGE'; stage: OrderStage }
  | { type: 'TOGGLE_SOLD_OUT'; productId: string }
  | { type: 'CALL_SERVICE'; service: string }
  | { type: 'RESPOND_SERVICES' }
  | { type: 'REQUEST_CANCEL'; uid: string }
  | { type: 'PAY'; couponIds: string[] }
  | { type: 'REDEEM_POINTS'; points: number; value: number }
  | { type: 'GRANT_POINTS'; points: number }
  | { type: 'APPROVE_CANCEL'; uid: string }
  | { type: 'EXPIRE_POINTS' }
  | { type: 'RESET' }
  | { type: 'SET_MESSAGE'; message: string }
