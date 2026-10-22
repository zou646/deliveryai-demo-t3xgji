import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarDays, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoomImage } from '@/components/hotel/RoomImage'
import { computeDraftSubtotal, nightsBetween, validateGuest } from '@/lib/hotel'
import { money } from '@/lib/utils'
import type { HotelDraftItem, HotelGuest, HotelRoom } from '@/types'

interface HotelCheckoutViewProps {
  rooms: HotelRoom[]
  draft: HotelDraftItem[]
  checkIn: string
  checkOut: string
  onBack: () => void
  onSubmit: (guest: HotelGuest) => void
}

export function HotelCheckoutView({ rooms, draft, checkIn, checkOut, onBack, onSubmit }: HotelCheckoutViewProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [idType, setIdType] = useState<'id_card' | 'passport' | 'other'>('id_card')
  const [idNumber, setIdNumber] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nights = nightsBetween(checkIn, checkOut)
  const total = useMemo(() => computeDraftSubtotal(rooms, draft, nights), [rooms, draft, nights])
  const items = draft.map((d) => rooms.find((r) => r.id === d.roomId) && { d, room: rooms.find((r) => r.id === d.roomId)! }).filter(Boolean) as Array<{ d: HotelDraftItem; room: HotelRoom }>

  const submit = () => {
    const err = validateGuest(name, phone)
    if (err) { setError(t(err)); return }
    if (idNumber && idNumber.trim().length < 6) { setError(t('hotel.error.content_too_short')); return }
    setError(null)
    onSubmit({ name, phone, idType, idNumber })
  }

  if (draft.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.back_home')}</Button>
        <div className="mt-6 rounded-3xl border border-dashed border-charcoal-900/10 bg-white p-10 text-center text-charcoal-500">{t('hotel.error.draft_empty')}</div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.back_home')}</Button>
      <h1 className="mt-2 text-2xl font-extrabold text-charcoal-900">{t('hotel.checkout_title')}</h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-charcoal-900"><CalendarDays size={16} className="text-chili-500" />{checkIn} → {checkOut} · {t('hotel.nights_total', { count: nights })}</div>
            <div className="mt-4 space-y-3">
              {items.map(({ d, room }) => (
                <div key={d.roomId} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <RoomImage imageKey={room.image} className="h-16 w-20 shrink-0 rounded-xl" emojiClassName="text-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-charcoal-900">{room.name}</p>
                    <p className="text-xs text-charcoal-500">{room.hotelName} · {room.bedType}</p>
                    <p className="mt-1 text-xs text-charcoal-500">{money(room.price)} × {d.rooms}{t('hotel.rooms')} × {nights}{t('hotel.nights')}</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-chili-600">{money(room.price * d.rooms * nights)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-base font-bold text-charcoal-900"><UserRound size={16} className="text-chili-500" />{t('hotel.guest_title')}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-charcoal-500">{t('hotel.guest_name')} *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hotel.guest_name_ph')} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-charcoal-500">{t('hotel.guest_phone')} *</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('hotel.guest_phone_ph')} inputMode="numeric" className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-charcoal-500">{t('hotel.guest_id_type')}</span>
                <select value={idType} onChange={(e) => setIdType(e.target.value as 'id_card' | 'passport' | 'other')} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none">
                  <option value="id_card">{t('hotel.id_card')}</option>
                  <option value="passport">{t('hotel.passport')}</option>
                  <option value="other">{t('hotel.other_id')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-charcoal-500">{t('hotel.guest_id_number')}</span>
                <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder={t('hotel.guest_id_number_ph')} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-chili-600">{error}</p>}
          </div>
        </section>

        <aside>
          <div className="sticky top-24 rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
            <h3 className="text-base font-bold text-charcoal-900">{t('hotel.total')}</h3>
            <div className="mt-3 flex items-center justify-between text-sm text-charcoal-700"><span>{t('hotel.subtotal')}</span><span>{money(total)}</span></div>
            <div className="mt-4 flex items-center justify-between text-lg font-extrabold text-chili-600"><span>{t('hotel.total')}</span><span>{money(total)}</span></div>
            <Button className="mt-4 w-full" onClick={submit} disabled={items.length === 0}>{t('hotel.submit_order')}</Button>
          </div>
        </aside>
      </div>


    </main>
  )
}
