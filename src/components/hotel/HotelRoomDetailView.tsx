import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BedDouble, CalendarDays, CheckCircle2, MapPin, Minus, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoomImage } from '@/components/hotel/RoomImage'
import { HOTEL_FACILITY_KEYS, isValidDateRange, mealPlanBadge, mealPlanDesc, nightsBetween } from '@/lib/hotel'
import { money } from '@/lib/utils'
import type { HotelRoom } from '@/types'

interface HotelRoomDetailViewProps {
  room: HotelRoom
  checkIn: string
  checkOut: string
  draftCount: number
  onBack: () => void
  onFilters: (patch: { checkIn?: string; checkOut?: string }) => void
  onAdd: (roomId: string, rooms: number) => void
  onGoCheckout: () => void
}

export function HotelRoomDetailView({ room, checkIn, checkOut, draftCount, onBack, onFilters, onAdd, onGoCheckout }: HotelRoomDetailViewProps) {
  const { t } = useTranslation()
  const [rooms, setRooms] = useState(1)
  const [guests, setGuests] = useState(room.capacity)

  const nights = nightsBetween(checkIn, checkOut)
  const dateInvalid = !isValidDateRange(checkIn, checkOut)
  const maxRooms = room.stock
  const mealKey = mealPlanBadge(room.mealPlan)
  const total = useMemo(() => room.price * nights * rooms, [room.price, nights, rooms])
  const maxGuests = room.capacity * rooms

  return (
    <main className="mx-auto max-w-5xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.back_home')}</Button>

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-3xl border border-charcoal-900/5 bg-rice-50 shadow-sm">
            <RoomImage imageKey={room.image} className="h-64 w-full sm:h-80" emojiClassName="text-7xl" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-charcoal-900">{room.name}</h1>
                  <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-500"><MapPin size={14} />{t(`hotel.cities.${room.city}` as 'hotel.cities.Beijing')} · {room.hotelName} · {room.address}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-extrabold text-chili-600">{money(room.price)}</p>
                  <p className="text-xs text-charcoal-500">{t('hotel.price_per_night')}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoPill icon={BedDouble} label={room.bedType} />
                <InfoPill icon={Users} label={`${room.capacity} ${t('hotel.guests')}`} />
                <InfoPill icon={CheckCircle2} label={`${room.area} ㎡`} />
                {mealKey && <span className="rounded-full bg-amber-400 px-3 py-2 text-center text-xs font-bold text-charcoal-900">{t(mealKey)}</span>}
              </div>
              <section className="mt-6">
                <h3 className="text-sm font-bold text-charcoal-900">{t('hotel.detail_facilities')}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {room.facilities.map((f) => (
                    <span key={f} className="rounded-full bg-rice-200 px-3 py-1 text-xs text-charcoal-700">{t(HOTEL_FACILITY_KEYS[f] ?? f)}</span>
                  ))}
                </div>
              </section>
              <section className="mt-5">
                <h3 className="text-sm font-bold text-charcoal-900">{t('hotel.detail_meal')}</h3>
                <p className="mt-1 text-sm leading-6 text-charcoal-500">{t(mealPlanDesc(room.mealPlan))}</p>
              </section>
              <section className="mt-5">
                <h3 className="text-sm font-bold text-charcoal-900">{t('hotel.detail_cancel')}</h3>
                <p className="mt-1 text-sm leading-6 text-charcoal-500">{room.cancellationPolicy}</p>
              </section>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2">
          <div className="sticky top-24 rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
            <h3 className="text-base font-bold text-charcoal-900">{t('hotel.detail_check')}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 rounded-2xl bg-white p-3">
                <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><CalendarDays size={13} />{t('hotel.check_in')}</span>
                <input type="date" value={checkIn} onChange={(e) => onFilters({ checkIn: e.target.value })} className="bg-transparent text-sm font-semibold text-charcoal-900 outline-none" />
              </label>
              <label className="flex flex-col gap-1 rounded-2xl bg-white p-3">
                <span className="flex items-center gap-1 text-xs font-semibold text-charcoal-500"><CalendarDays size={13} />{t('hotel.check_out')}</span>
                <input type="date" value={checkOut} onChange={(e) => onFilters({ checkOut: e.target.value })} className="bg-transparent text-sm font-semibold text-charcoal-900 outline-none" />
              </label>
            </div>
            {dateInvalid && <p className="mt-2 text-xs text-chili-600">{t('hotel.error.date_range')}</p>}

            <StepperRow label={t('hotel.select_rooms')} value={rooms} min={1} max={maxRooms} onChange={(v) => { setRooms(v); setGuests(Math.min(guests, room.capacity * v)) }} />
            <StepperRow label={t('hotel.select_guests')} value={guests} min={1} max={maxGuests} onChange={setGuests} />

            <div className="mt-4 rounded-2xl bg-amber-100/70 p-3 text-sm text-charcoal-700">
              {t('hotel.total_line', { nights, rooms, amount: money(total) })}
            </div>
            <div className="mt-2 text-xs text-amber-600">{t('hotel.room_remaining', { count: maxRooms })}</div>

            <Button
              className="mt-4 w-full"
              disabled={dateInvalid || rooms <= 0}
              onClick={() => onAdd(room.id, rooms)}
            >
              {t('hotel.add_draft')}
            </Button>
            {draftCount > 0 && (
              <Button variant="outline" className="mt-2 w-full" onClick={onGoCheckout}>
                {t('hotel.go_checkout')}（{t('hotel.draft_count', { count: draftCount })}）
              </Button>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}

function InfoPill({ icon: Icon, label }: { icon: typeof BedDouble; label: string }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl bg-rice-100 px-3 py-2 text-xs font-semibold text-charcoal-700">
      <Icon size={14} className="text-chili-500" />{label}
    </span>
  )
}

function StepperRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl bg-white p-3">
      <span className="text-sm font-semibold text-charcoal-900">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={dec} aria-label="dec" className="flex h-8 w-8 items-center justify-center rounded-full bg-rice-200 text-charcoal-700 active:scale-95"><Minus size={14} /></button>
        <span className="w-6 text-center text-sm font-bold text-charcoal-900">{value}</span>
        <button onClick={inc} aria-label="inc" className="flex h-8 w-8 items-center justify-center rounded-full bg-chili-500 text-white active:scale-95"><Plus size={14} /></button>
      </div>
    </div>
  )
}
