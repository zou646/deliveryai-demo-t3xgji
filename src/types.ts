export type OrderStage = 'submitted' | 'accepted' | 'cooking' | 'served'

// Hotpot views
export type HotpotViewName = 'home' | 'welcome' | 'menu' | 'order' | 'checkout'
// Hotel views
export type HotelViewName =
  | 'hotel-home'
  | 'hotel-room'
  | 'hotel-checkout'
  | 'hotel-orders'
  | 'hotel-order-detail'
  | 'hotel-admin'
export type ViewName = HotpotViewName | HotelViewName

// App module (product line): hotpot or hotel
export type AppModule = 'hotpot' | 'hotel'

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

export type ServiceTypeKey = 'service.broth' | 'service.drinks' | 'service.utensils' | 'service.bill'

export interface ServiceRequest {
  id: string
  type?: string
  typeKey?: ServiceTypeKey
  createdAt: string
  status: 'waiting' | 'responded'
}

export type PointEntryType = 'earn' | 'redeem' | 'refund' | 'expire'
export type PointNoteKey = 'earn' | 'redeem' | 'refund' | 'expire' | 'grant'

export interface PointEntry {
  id: string
  type: PointEntryType
  /** 带符号变动值：earn 为 +N；redeem / refund / expire 为 −N */
  amount: number
  createdAt: string
  note?: string
  noteKey?: PointNoteKey
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

// ---------- Hotel domain types ----------

export type MealPlan = 'none' | 'breakfast_1' | 'breakfast_2' | 'half_board' | 'full_board'
export type RoomStatus = 'listed' | 'unlisted'

export interface HotelRoom {
  id: string
  name: string             // 房型名称
  hotelName: string        // 酒店名称
  city: string             // 所在城市
  address: string          // 地址
  bedType: string          // 床型
  capacity: number         // 可住人数
  area: number             // 面积（㎡）
  facilities: string[]     // 设施标签
  image: string            // 封面图（emoji / 本地占位，遵守无外部依赖）
  price: number            // 每晚单价
  stock: number            // 初始/剩余可订间数（统一库存，不按日历拆）
  initialStock: number     // 初始库存，供统计参考
  status: RoomStatus
  cancellationPolicy: string
  mealPlan: MealPlan
}

export type HotelOrderStatus = 'pending_payment' | 'paid' | 'cancelled' | 'completed'

export interface HotelOrderItem {
  roomId: string
  roomName: string
  hotelName: string
  image: string
  pricePerNight: number
  nights: number
  rooms: number
  subtotal: number
  mealPlan: MealPlan
  bedType: string
}

export interface HotelGuest {
  name: string
  phone: string
  idType?: 'id_card' | 'passport' | 'other'
  idNumber?: string
}

export interface HotelPayment {
  // TODO(hotel-ext): 接入真实支付时填充 paymentId / method / transaction 字段
  method: 'wechat' | 'alipay' | 'card' | 'mock'
  paidAt?: string
  paymentId?: string
}

export interface HotelOrder {
  id: string
  createdAt: string
  checkIn: string   // yyyy-mm-dd
  checkOut: string  // yyyy-mm-dd
  nights: number
  items: HotelOrderItem[]
  totalAmount: number
  guest: HotelGuest
  status: HotelOrderStatus
  payment?: HotelPayment
  cancelReason?: string
  cancelTicketId?: string
}

export type HotelTicketType = 'inquiry' | 'cancel_request'
export type HotelTicketStatus = 'waiting' | 'processed'

export interface HotelTicket {
  id: string
  orderId?: string
  type: HotelTicketType
  subject: string
  content: string
  createdAt: string
  status: HotelTicketStatus
  response?: string
  respondedAt?: string
}

export interface HotelFilters {
  city: string        // '' means all
  checkIn: string     // yyyy-mm-dd
  checkOut: string    // yyyy-mm-dd
  minPrice: number
  maxPrice: number
}

export interface HotelDraftItem {
  roomId: string
  rooms: number
}

export interface HotelState {
  module: 'hotel'
  rooms: HotelRoom[]
  orders: HotelOrder[]
  tickets: HotelTicket[]
  filters: HotelFilters
  draft: HotelDraftItem[]  // 预订单（整单统一日期）
  currentRoomId: string | null
  currentOrderId: string | null
  payFailRate: number      // 0~1, DemoConsole 可调
  lastMessage: string
}

export interface AppState {
  // Module switcher: top-level product line
  appModule: AppModule

  // ----- Hotpot (existing) -----
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

  // ----- Hotel (new) -----
  hotel: HotelState
}

export type AppAction =
  // global / module
  | { type: 'SET_MODULE'; module: AppModule }
  | { type: 'SET_VIEW'; view: ViewName }
  | { type: 'SET_MESSAGE'; message: string }
  // hotpot
  | { type: 'BIND_TABLE'; table: string }
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
  // hotel - filters / room detail
  | { type: 'HOTEL_SET_FILTERS'; filters: Partial<HotelFilters> }
  | { type: 'HOTEL_VIEW_ROOM'; roomId: string }
  // hotel - draft / cart
  | { type: 'HOTEL_ADD_DRAFT'; roomId: string; rooms: number }
  | { type: 'HOTEL_CHANGE_DRAFT_QTY'; roomId: string; delta: number }
  | { type: 'HOTEL_REMOVE_DRAFT'; roomId: string }
  | { type: 'HOTEL_CLEAR_DRAFT' }
  // hotel - order lifecycle
  | { type: 'HOTEL_SUBMIT_ORDER'; guest: HotelGuest }
  | { type: 'HOTEL_PAY_ORDER'; orderId: string; method: HotelPayment['method'] }
  | { type: 'HOTEL_CANCEL_ORDER'; orderId: string }
  | { type: 'HOTEL_COMPLETE_ORDER'; orderId: string }
  | { type: 'HOTEL_VIEW_ORDER'; orderId: string }
  // hotel - support tickets
  | { type: 'HOTEL_SUBMIT_TICKET'; ticket: Omit<HotelTicket, 'id' | 'createdAt' | 'status'> }
  | { type: 'HOTEL_RESPOND_TICKET'; ticketId: string; response: string }
  // hotel - admin
  | { type: 'HOTEL_UPSERT_ROOM'; room: HotelRoom }
  | { type: 'HOTEL_TOGGLE_LISTED'; roomId: string }
  | { type: 'HOTEL_DELETE_ROOM'; roomId: string }
  | { type: 'HOTEL_APPROVE_CANCEL'; orderId: string }
  | { type: 'HOTEL_SET_PAY_FAIL_RATE'; rate: number }
  | { type: 'HOTEL_RESET' }
