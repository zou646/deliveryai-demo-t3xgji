import { useTranslation } from 'react-i18next'
import { BedDouble, CalendarDays, Filter, MapPin, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HOTEL_CITIES } from '@/data/hotel'
import { HOTEL_FACILITY_KEYS, filterRooms, isValidDateRange, mealPlanBadge } from '@/lib/hotel'
import { money } from '@/lib/utils'
import { RoomImage } from '@/components/hotel/RoomImage'
import type { HotelFilters, HotelRoom } from '@/types'

interface HotelHomeViewProps {
  filters: HotelFilters
  rooms: HotelRoom[]
  draftCount: number
  onFilters: (patch: Partial<HotelFilters>) => void
  onSelectRoom: (roomId: string) => void
  onGoCheckout: () => void
}

export function HotelHomeView({ filters, rooms, draftCount, onFilters, onSelectRoom, onGoCheckout }: HotelHomeViewProps) {
  const { t } = useTranslation()
  const dateInvalid = !isValidDateRange(filters.checkIn, filters.checkOut)
  const list = filterRooms(rooms, filters)

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      {/* Hero + Search */}
      <section className="rounded-3xl border border-white/60 bg-gradient-to-br from-chili-50 via-amber-50 to-rice-50 p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-2 text-xs font-bold text-chili-600"><BedDouble size={14} />{t('hotel.subtitle')}</div>
        <h1 className="mt-2 text-2xl font-extrabold text-charcoal-900 sm:text-3xl">{t('hotel.search_title')}</h1>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><MapPin size={13} />City</span>
            <select value={filters.city} onChange={(e) => onFilters({ city: e.target.value })} className="bg-transparent text-sm font-semibold text-charcoal-900 outline-none">
              <option value="">{t('hotel.city_all')}</option>
              {HOTEL_CITIES.map((c) => <option key={c} value={c}>{t(`hotel.cities.${c}`)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><CalendarDays size={13} />{t('hotel.check_in')}</span>
            <input type="date" value={filters.checkIn} onChange={(e) => onFilters({ checkIn: e.target.value })} className="bg-transparent text-sm font-semibold text-charcoal-900 outline-none" />
          </label>
          <label className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><CalendarDays size={13} />{t('hotel.check_out')}</span>
            <input type="date" value={filters.checkOut} onChange={(e) => onFilters({ checkOut: e.target.value })} className="bg-transparent text-sm font-semibold text-charcoal-900 outline-none" />
          </label>
          <label className="flex flex-col gap-1 rounded-2xl bg-white p-3 shadow-sm">
            <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><Filter size={13} />{t('hotel.price_range')}：¥{filters.minPrice} - ¥{filters.maxPrice}</span>
            <div className="flex items-center gap-2">
              <input type="range" min={0} max={3000} step={100} value={filters.minPrice} onChange={(e) => onFilters({ minPrice: Number(e.target.value) })} className="flex-1 accent-chili-500" />
              <input type="range" min={0} max={3000} step={100} value={filters.maxPrice} onChange={(e) => onFilters({ maxPrice: Number(e.target.value) })} className="flex-1 accent-chili-500" />
            </div>
          </label>
        </div>
        {dateInvalid && <p className="mt-2 text-sm text-chili-600">{t('hotel.error.date_range')}</p>}
      </section>

      {/* Draft CTA */}
      {draftCount > 0 && (
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-chili-500/20 bg-chili-50 px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-chili-700">{t('cart.item_count', { count: draftCount }).replace('份菜品', '个房型')}</p>
          <Button onClick={onGoCheckout} size="sm">{t('hotel.go_checkout')}</Button>
        </div>
      )}

      {/* Room list */}
      <section className="mt-6">
        {list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-charcoal-900/10 bg-white p-10 text-center">
            <Search size={32} className="mx-auto text-charcoal-300" />
            <p className="mt-3 text-charcoal-500">{t('hotel.empty_rooms')}</p>
            <Button variant="outline" className="mt-4" onClick={() => onFilters({ city: '', minPrice: 0, maxPrice: 3000 })}>{t('hotel.clear_filters')}</Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((room) => {
              const soldOut = room.stock <= 0
              const mealKey = mealPlanBadge(room.mealPlan)
              return (
                <article key={room.id} className={`group overflow-hidden rounded-3xl border border-charcoal-900/5 bg-rice-50 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card ${soldOut ? 'opacity-60' : ''}`}>
                  <button onClick={() => !soldOut && onSelectRoom(room.id)} className="block w-full text-left">
                    <div className="relative h-44">
                      <RoomImage imageKey={room.image} className="h-full w-full" />
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1">
                        {mealKey && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-charcoal-900">{t(mealKey)}</span>}
                      </div>
                      {soldOut && (
                        <div className="absolute inset-0 flex items-center justify-center bg-charcoal-900/50 text-lg font-bold text-white">{t('hotel.sold_out')}</div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-charcoal-900">{room.name}</h3>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-charcoal-500"><MapPin size={12} />{t(`hotel.cities.${room.city}` as 'hotel.cities.Beijing')} · {room.hotelName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-lg font-extrabold text-chili-600">{money(room.price)}</p>
                          <p className="text-[11px] text-charcoal-500">{t('hotel.price_per_night')}</p>
                        </div>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs text-charcoal-500">
                        <span className="inline-flex items-center gap-1"><BedDouble size={12} />{room.bedType}</span>
                        <span className="inline-flex items-center gap-1"><Users size={12} />{room.capacity}{t('hotel.guests')}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {room.facilities.slice(0, 3).map((f) => (
                          <span key={f} className="rounded-full bg-rice-200 px-2 py-0.5 text-[11px] text-charcoal-700">{t(HOTEL_FACILITY_KEYS[f] ?? f)}</span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-amber-600">{t('hotel.room_remaining', { count: room.stock })}</span>
                        <Button size="sm" disabled={soldOut} onClick={(e) => { e.stopPropagation(); onSelectRoom(room.id) }}>{t('hotel.book_now')}</Button>
                      </div>
                    </div>
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
