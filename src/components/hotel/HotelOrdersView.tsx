import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarDays, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoomImage } from '@/components/hotel/RoomImage'
import { money } from '@/lib/utils'
import type { HotelOrder, HotelOrderStatus } from '@/types'

type TabKey = 'all' | HotelOrderStatus

const TABS: Array<{ key: TabKey; labelKey: string }> = [
  { key: 'all', labelKey: 'hotel.tab_all' },
  { key: 'pending_payment', labelKey: 'hotel.tab_pending' },
  { key: 'paid', labelKey: 'hotel.tab_paid' },
  { key: 'cancelled', labelKey: 'hotel.tab_cancelled' },
  { key: 'completed', labelKey: 'hotel.tab_completed' },
]

interface HotelOrdersViewProps {
  orders: HotelOrder[]
  onBack: () => void
  onSelect: (orderId: string) => void
}

export function HotelOrdersView({ orders, onBack, onSelect }: HotelOrdersViewProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('all')
  const filtered = tab === 'all' ? orders : orders.filter((o) => o.status === tab)

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.back_home')}</Button>
      <h1 className="mt-2 text-2xl font-extrabold text-charcoal-900">{t('hotel.orders_title')}</h1>

      <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto">
        {TABS.map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${tab === tb.key ? 'border-chili-500 bg-chili-50 text-chili-600' : 'border-charcoal-900/10 bg-white text-charcoal-700'}`}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <section className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-charcoal-900/10 bg-white p-10 text-center text-charcoal-500"><Receipt className="mx-auto" size={32} />{t('hotel.empty_orders')}</div>
        ) : filtered.map((order) => (
          <button key={order.id} onClick={() => onSelect(order.id)} className="block w-full rounded-3xl border border-charcoal-900/5 bg-rice-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-charcoal-900">{order.id}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-500"><CalendarDays size={12} />{order.checkIn} → {order.checkOut} · {t('hotel.nights_total', { count: order.nights })}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex -space-x-3">
                {order.items.slice(0, 3).map((it) => (
                  <div key={it.roomId} className="h-10 w-10 overflow-hidden rounded-xl border-2 border-rice-50"><RoomImage imageKey={it.image} className="h-full w-full" emojiClassName="text-lg" /></div>
                ))}
              </div>
              <div className="min-w-0 flex-1 truncate text-xs text-charcoal-500">{order.items.map((it) => it.roomName).join('、')}</div>
              <p className="shrink-0 text-base font-extrabold text-chili-600">{money(order.totalAmount)}</p>
            </div>
          </button>
        ))}
      </section>
    </main>
  )
}

export function StatusBadge({ status }: { status: HotelOrderStatus }) {
  const { t } = useTranslation()
  const color: Record<HotelOrderStatus, string> = {
    pending_payment: 'bg-amber-100 text-amber-600',
    paid: 'bg-emerald-100 text-emerald-600',
    cancelled: 'bg-charcoal-100 text-charcoal-500',
    completed: 'bg-chili-50 text-chili-600',
  }
  const labelMap: Record<HotelOrderStatus, string> = {
    pending_payment: 'hotel.status_pending',
    paid: 'hotel.status_paid',
    cancelled: 'hotel.status_cancelled',
    completed: 'hotel.status_completed',
  }
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${color[status]}`}>{t(labelMap[status])}</span>
}
