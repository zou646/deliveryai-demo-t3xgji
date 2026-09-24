import i18next from 'i18next'
import { buildInitialRooms } from '@/data/hotel'
import { buildOrderItems, computeDraftSubtotal, defaultFilters, genHotelOrderId, genTicketId, isValidDateRange, nightsBetween, validateGuest } from '@/lib/hotel'
import { nowIso } from '@/lib/datetime'
import { uid } from '@/lib/utils'
import type { AppAction, HotelOrder, HotelRoom, HotelState, HotelTicket, HotelTicketType } from '@/types'

export function createInitialHotelState(): HotelState {
  return {
    module: 'hotel',
    rooms: buildInitialRooms(),
    orders: [],
    tickets: [],
    filters: defaultFilters(),
    draft: [],
    currentRoomId: null,
    currentOrderId: null,
    payFailRate: 0,
    lastMessage: i18next.t('hotel.message.welcome'),
  }
}

function pushMsg(state: HotelState, key: string, params?: Record<string, string | number>): HotelState {
  return { ...state, lastMessage: i18next.t(key, params) }
}

function updateRoomsStock(rooms: HotelRoom[], orderItems: HotelOrder['items'], sign: 1 | -1): HotelRoom[] {
  return rooms.map((room) => {
    const line = orderItems.find((it) => it.roomId === room.id)
    if (!line) return room
    return { ...room, stock: Math.max(0, room.stock + sign * line.rooms) }
  })
}

// TODO(hotel-api): 未来接入后端时，将各 action 映射为 HTTP 调用；reducer 可继续作为乐观更新层。
export function hotelReducer(state: HotelState, action: AppAction): HotelState {
  switch (action.type) {
    case 'HOTEL_SET_FILTERS': {
      const next = { ...state.filters, ...action.filters }
      // 价格区间归一化：始终保证 min<=max
      if (next.minPrice > next.maxPrice) {
        const tmp = next.minPrice
        next.minPrice = next.maxPrice
        next.maxPrice = tmp
      }
      // 日期非法：仍写入用户输入（输入框受控于 filters，必须回显），但给出错误提示；
      // 加购/下单等关键路径会再次校验 isValidDateRange 阻止提交。
      if (!isValidDateRange(next.checkIn, next.checkOut)) {
        return pushMsg({ ...state, filters: next }, 'hotel.error.date_range')
      }
      return { ...state, filters: next }
    }
    case 'HOTEL_VIEW_ROOM':
      return { ...state, currentRoomId: action.roomId }
    case 'HOTEL_VIEW_ORDER':
      return { ...state, currentOrderId: action.orderId }
    case 'HOTEL_ADD_DRAFT': {
      const room = state.rooms.find((r) => r.id === action.roomId)
      if (!room || room.status !== 'listed' || room.stock <= 0) {
        return pushMsg(state, 'hotel.error.room_unavailable')
      }
      const existing = state.draft.find((d) => d.roomId === action.roomId)
      const rooms = Math.min(action.rooms, room.stock)
      if (rooms <= 0) return pushMsg(state, 'hotel.error.stock_exceeded')
      let draft
      if (existing) {
        const newQty = Math.min(existing.rooms + rooms, room.stock)
        draft = state.draft.map((d) => d.roomId === action.roomId ? { ...d, rooms: newQty } : d)
      } else {
        draft = [...state.draft, { roomId: action.roomId, rooms }]
      }
      return pushMsg({ ...state, draft }, 'hotel.message.added', { name: room.name })
    }
    case 'HOTEL_CHANGE_DRAFT_QTY': {
      const room = state.rooms.find((r) => r.id === action.roomId)
      if (!room) return state
      const item = state.draft.find((d) => d.roomId === action.roomId)
      if (!item) return state
      const newQty = item.rooms + action.delta
      if (newQty <= 0) {
        return { ...state, draft: state.draft.filter((d) => d.roomId !== action.roomId) }
      }
      if (newQty > room.stock) {
        return pushMsg(state, 'hotel.error.stock_exceeded')
      }
      return {
        ...state,
        draft: state.draft.map((d) => d.roomId === action.roomId ? { ...d, rooms: newQty } : d),
      }
    }
    case 'HOTEL_REMOVE_DRAFT':
      return { ...state, draft: state.draft.filter((d) => d.roomId !== action.roomId) }
    case 'HOTEL_CLEAR_DRAFT':
      return { ...state, draft: [] }
    case 'HOTEL_SUBMIT_ORDER': {
      if (!state.draft.length) return pushMsg(state, 'hotel.error.draft_empty')
      if (!isValidDateRange(state.filters.checkIn, state.filters.checkOut)) {
        return pushMsg(state, 'hotel.error.date_range')
      }
      const err = validateGuest(action.guest.name, action.guest.phone)
      if (err) return pushMsg(state, err)
      // 再次校验库存
      for (const d of state.draft) {
        const room = state.rooms.find((r) => r.id === d.roomId)
        if (!room || room.stock < d.rooms) return pushMsg(state, 'hotel.error.stock_exceeded')
      }
      const nights = nightsBetween(state.filters.checkIn, state.filters.checkOut)
      const items = buildOrderItems(state.rooms, state.draft, nights)
      const totalAmount = computeDraftSubtotal(state.rooms, state.draft, nights)
      let orderId = genHotelOrderId()
      for (let i = 0; i < 10 && state.orders.some((o) => o.id === orderId); i++) {
        orderId = genHotelOrderId()
      }
      const order: HotelOrder = {
        id: orderId,
        createdAt: nowIso(),
        checkIn: state.filters.checkIn,
        checkOut: state.filters.checkOut,
        nights,
        items,
        totalAmount,
        guest: {
          name: action.guest.name.trim(),
          phone: action.guest.phone.trim(),
          idType: action.guest.idType || 'id_card',
          idNumber: action.guest.idNumber?.trim() || undefined,
        },
        status: 'pending_payment',
      }
      return pushMsg({
        ...state,
        orders: [order, ...state.orders],
        rooms: updateRoomsStock(state.rooms, items, -1),
        draft: [],
        currentOrderId: order.id,
      }, 'hotel.message.order_submitted', { id: order.id })
    }
    case 'HOTEL_PAY_ORDER': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'pending_payment') return state
      // 模拟失败（由 DemoConsole 注入失败率）
      if (Math.random() < state.payFailRate) {
        return pushMsg(state, 'hotel.error.pay_failed')
      }
      const updated: HotelOrder = {
        ...order,
        status: 'paid',
        payment: {
          method: action.method,
          paidAt: nowIso(),
          paymentId: `MOCK-${uid()}`,
        },
      }
      return pushMsg({
        ...state,
        orders: state.orders.map((o) => o.id === action.orderId ? updated : o),
      }, 'hotel.message.paid')
    }
    case 'HOTEL_CANCEL_ORDER': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'pending_payment') return state
      return pushMsg({
        ...state,
        orders: state.orders.map((o) => o.id === action.orderId ? { ...o, status: 'cancelled' } : o),
        rooms: updateRoomsStock(state.rooms, order.items, +1),
      }, 'hotel.message.cancelled')
    }
    case 'HOTEL_COMPLETE_ORDER': {
      return pushMsg({
        ...state,
        orders: state.orders.map((o) => o.id === action.orderId && o.status === 'paid' ? { ...o, status: 'completed' } : o),
      }, 'hotel.message.completed')
    }
    case 'HOTEL_APPROVE_CANCEL': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'paid') return state
      const cancelTicket = state.tickets.find((t) => t.type === 'cancel_request' && t.orderId === order.id && t.status === 'waiting')
      if (!cancelTicket) return pushMsg(state, 'hotel.error.no_cancel_ticket')
      const updatedTicket: HotelTicket = { ...cancelTicket, status: 'processed', response: i18next.t('hotel.ticket.approve_response'), respondedAt: nowIso() }
      return pushMsg({
        ...state,
        orders: state.orders.map((o) => o.id === action.orderId ? { ...o, status: 'cancelled', cancelTicketId: cancelTicket.id } : o),
        tickets: state.tickets.map((t) => t.id === cancelTicket.id ? updatedTicket : t),
        rooms: updateRoomsStock(state.rooms, order.items, +1),
      }, 'hotel.message.cancel_approved')
    }
    case 'HOTEL_SUBMIT_TICKET': {
      const ticketType: HotelTicketType = action.ticket.type
      const ticket: HotelTicket = {
        id: genTicketId(),
        orderId: action.ticket.orderId,
        type: ticketType,
        subject: action.ticket.subject,
        content: action.ticket.content.trim(),
        createdAt: nowIso(),
        status: 'waiting',
      }
      let orders = state.orders
      if (ticketType === 'cancel_request' && action.ticket.orderId) {
        orders = state.orders.map((o) => o.id === action.ticket.orderId ? { ...o, cancelReason: action.ticket.content } : o)
      }
      return pushMsg({
        ...state,
        tickets: [ticket, ...state.tickets],
        orders,
      }, ticketType === 'cancel_request' ? 'hotel.message.cancel_requested' : 'hotel.message.ticket_submitted')
    }
    case 'HOTEL_RESPOND_TICKET': {
      return pushMsg({
        ...state,
        tickets: state.tickets.map((t) => t.id === action.ticketId && t.status === 'waiting'
          ? { ...t, status: 'processed', response: action.response, respondedAt: nowIso() }
          : t),
      }, 'hotel.message.ticket_responded')
    }
    case 'HOTEL_UPSERT_ROOM': {
      const exists = state.rooms.some((r) => r.id === action.room.id)
      const room: HotelRoom = {
        ...action.room,
        // 新增时若未提供 id，生成一个
        id: action.room.id || `hr-${uid()}`,
        stock: Math.max(0, Math.floor(action.room.stock)),
        initialStock: action.room.id ? action.room.initialStock ?? action.room.stock : Math.max(0, Math.floor(action.room.stock)),
        price: Math.max(0, action.room.price),
      }
      const rooms = exists
        ? state.rooms.map((r) => r.id === room.id ? room : r)
        : [...state.rooms, room]
      return pushMsg({ ...state, rooms }, exists ? 'hotel.message.room_updated' : 'hotel.message.room_created')
    }
    case 'HOTEL_TOGGLE_LISTED': {
      return pushMsg({
        ...state,
        rooms: state.rooms.map((r) => r.id === action.roomId ? { ...r, status: r.status === 'listed' ? 'unlisted' : 'listed' } : r),
      }, 'hotel.message.toggle_listed')
    }
    case 'HOTEL_DELETE_ROOM': {
      return pushMsg({
        ...state,
        rooms: state.rooms.filter((r) => r.id !== action.roomId),
      }, 'hotel.message.room_deleted')
    }
    case 'HOTEL_SET_PAY_FAIL_RATE':
      return { ...state, payFailRate: Math.max(0, Math.min(1, action.rate)) }
    case 'HOTEL_RESET':
      return createInitialHotelState()
    default:
      return state
  }
}

