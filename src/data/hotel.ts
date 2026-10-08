import i18next from 'i18next'
import type { HotelRoom, MealPlan } from '@/types'

// 占位图使用 emoji + 渐变色块（遵守"无外部依赖、纯前端内存态"约束）
// image 字段保存一个语义 key，组件中渲染为带渐变背景的 emoji 卡
export interface HotelRoomImageSeed { emoji: string; from: string; to: string }

export const HOTEL_IMAGES: Record<string, HotelRoomImageSeed> = {
  deluxe:   { emoji: '🛏️', from: 'from-sky-100', to: 'to-indigo-100' },
  twin:     { emoji: '🛏️', from: 'from-amber-100', to: 'to-rose-100' },
  suite:    { emoji: '🏨', from: 'from-violet-100', to: 'to-fuchsia-100' },
  family:   { emoji: '👨‍👩‍👧', from: 'from-emerald-100', to: 'to-teal-100' },
  sea:      { emoji: '🌊', from: 'from-cyan-100', to: 'to-blue-100' },
  business: { emoji: '💼', from: 'from-slate-100', to: 'from-zinc-100' },
}

export const HOTEL_CITIES = ['Beijing', 'Shanghai', 'Chengdu'] as const
export type HotelCity = typeof HOTEL_CITIES[number]

const mealPlanByIndex: MealPlan[] = ['breakfast_2', 'breakfast_1', 'none', 'half_board', 'full_board', 'breakfast_2']

// 初始房型（≥3 城市 / ≥6 间）
export function buildInitialRooms(): HotelRoom[] {
  const seed: Array<Omit<HotelRoom, 'id' | 'status' | 'mealPlan' | 'initialStock' | 'cancellationPolicy' | 'image'> & { imageKey: string }> = [
    { name: '豪华大床房', hotelName: '星河里大酒店', city: 'Beijing', address: '朝阳区建国路 88 号', bedType: '1 张 1.8m 大床', capacity: 2, area: 32, facilities: ['wifi', 'window', 'bathtub', 'tv'], price: 699, stock: 5, imageKey: 'deluxe' },
    { name: '标准双床房', hotelName: '星河里大酒店', city: 'Beijing', address: '朝阳区建国路 88 号', bedType: '2 张 1.2m 单人床', capacity: 2, area: 28, facilities: ['wifi', 'window', 'tv'], price: 599, stock: 8, imageKey: 'twin' },
    { name: '外滩景观套房', hotelName: '浦江云顶酒店', city: 'Shanghai', address: '黄浦区中山东一路 12 号', bedType: '1 张 2.0m 大床', capacity: 3, area: 56, facilities: ['wifi', 'view', 'bathtub', 'minibar', 'tv'], price: 1588, stock: 3, imageKey: 'suite' },
    { name: '亲子家庭房', hotelName: '浦江云顶酒店', city: 'Shanghai', address: '黄浦区中山东一路 12 号', bedType: '1 张大床 + 1 张儿童床', capacity: 4, area: 45, facilities: ['wifi', 'window', 'kids', 'tv'], price: 1088, stock: 4, imageKey: 'family' },
    { name: '熊猫主题海景房', hotelName: '锦里别院', city: 'Chengdu', address: '武侯区锦里古街 66 号', bedType: '1 张 1.8m 大床', capacity: 2, area: 35, facilities: ['wifi', 'window', 'tea', 'tv'], price: 788, stock: 6, imageKey: 'sea' },
    { name: '商旅商务房', hotelName: '锦里别院', city: 'Chengdu', address: '武侯区锦里古街 66 号', bedType: '1 张 1.5m 大床', capacity: 2, area: 26, facilities: ['wifi', 'desk', 'tv'], price: 468, stock: 10, imageKey: 'business' },
  ]

  return seed.map((s, i) => ({
    id: `hr${i + 1}`,
    name: s.name,
    hotelName: s.hotelName,
    city: s.city,
    address: s.address,
    bedType: s.bedType,
    capacity: s.capacity,
    area: s.area,
    facilities: s.facilities,
    image: s.imageKey,
    price: s.price,
    stock: s.stock,
    initialStock: s.stock,
    status: 'listed',
    cancellationPolicy: i18next.t('hotel.default_cancel'),
    mealPlan: mealPlanByIndex[i % mealPlanByIndex.length],
  }))
}

export const HOTEL_FAQS: Array<{ q: string; a: string }> = [
  { q: 'hotel.faq.q1', a: 'hotel.faq.a1' },
  { q: 'hotel.faq.q2', a: 'hotel.faq.a2' },
  { q: 'hotel.faq.q3', a: 'hotel.faq.a3' },
]
