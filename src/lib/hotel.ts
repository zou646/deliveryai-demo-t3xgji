import type { HotelDraftItem, HotelFilters, HotelOrderItem, HotelRoom, MealPlan } from '@/types'

export function todayISO(): string {
  const d = new Date()
  return formatDate(d)
}

export function tomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatDate(d)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const inD = parseDate(checkIn)
  const outD = parseDate(checkOut)
  const diff = Math.round((outD.getTime() - inD.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : 0
}

export function isValidDateRange(checkIn: string, checkOut: string): boolean {
  return nightsBetween(checkIn, checkOut) > 0
}

export function defaultFilters(): HotelFilters {
  return {
    city: '',
    checkIn: todayISO(),
    checkOut: tomorrowISO(),
    minPrice: 0,
    maxPrice: 3000,
  }
}

export function mealPlanBadge(meal: MealPlan): string | null {
  switch (meal) {
    case 'breakfast_1': return 'hotel.meal.badge_1'
    case 'breakfast_2': return 'hotel.meal.badge_2'
    case 'half_board': return 'hotel.meal.badge_half'
    case 'full_board': return 'hotel.meal.badge_full'
    case 'none':
    default:
      return null
  }
}

export function mealPlanDesc(meal: MealPlan): string {
  switch (meal) {
    case 'breakfast_1': return 'hotel.meal.desc_1'
    case 'breakfast_2': return 'hotel.meal.desc_2'
    case 'half_board': return 'hotel.meal.desc_half'
    case 'full_board': return 'hotel.meal.desc_full'
    case 'none':
    default:
      return 'hotel.meal.desc_none'
  }
}

export function roomAvailable(room: HotelRoom): boolean {
  return room.status === 'listed' && room.stock > 0
}

export function filterRooms(rooms: HotelRoom[], filters: HotelFilters): HotelRoom[] {
  return rooms.filter((room) => {
    if (room.status !== 'listed') return false
    if (room.stock <= 0) return false
    if (filters.city && room.city !== filters.city) return false
    if (room.price < filters.minPrice || room.price > filters.maxPrice) return false
    return true
  })
}

export function computeDraftSubtotal(rooms: HotelRoom[], draft: HotelDraftItem[], nights: number) {
  return draft.reduce((sum, item) => {
    const room = rooms.find((r) => r.id === item.roomId)
    if (!room) return sum
    return sum + room.price * item.rooms * nights
  }, 0)
}

export function buildOrderItems(rooms: HotelRoom[], draft: HotelDraftItem[], nights: number): HotelOrderItem[] {
  return draft
    .map((d) => {
      const room = rooms.find((r) => r.id === d.roomId)
      if (!room) return null
      return {
        roomId: room.id,
        roomName: room.name,
        hotelName: room.hotelName,
        image: room.image,
        pricePerNight: room.price,
        nights,
        rooms: d.rooms,
        subtotal: room.price * d.rooms * nights,
        mealPlan: room.mealPlan,
        bedType: room.bedType,
      } satisfies HotelOrderItem
    })
    .filter((x): x is HotelOrderItem => !!x)
}

// 订单号：HTL + yyyymmddHHMMss + 4 位随机数字
export function genHotelOrderId(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const rnd = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `HTL${stamp}${rnd}`
}

export function genTicketId(): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 6)
  return `TK${t}${r}`
}

// 中国大陆手机号 11 位
export const PHONE_REGEX = /^1\d{10}$/

export function validateGuest(name: string, phone: string): string | null {
  if (!name.trim()) return 'hotel.error.name_required'
  if (!PHONE_REGEX.test(phone.trim())) return 'hotel.error.phone_invalid'
  return null
}

export const HOTEL_FACILITY_KEYS: Record<string, string> = {
  wifi: 'hotel.facility.wifi',
  window: 'hotel.facility.window',
  bathtub: 'hotel.facility.bathtub',
  tv: 'hotel.facility.tv',
  view: 'hotel.facility.view',
  minibar: 'hotel.facility.minibar',
  kids: 'hotel.facility.kids',
  tea: 'hotel.facility.tea',
  desk: 'hotel.facility.desk',
}
