import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, BedDouble, CheckCircle2, LayoutDashboard, Receipt, Ticket, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { money } from '@/lib/utils'
import { StatusBadge } from '@/components/hotel/HotelOrdersView'
import type { HotelOrder, HotelRoom, HotelTicket } from '@/types'

type Tab = 'stats' | 'rooms' | 'orders' | 'tickets'

interface HotelAdminViewProps {
  rooms: HotelRoom[]
  orders: HotelOrder[]
  tickets: HotelTicket[]
  payFailRate: number
  onBack: () => void
  onUpsertRoom: (room: HotelRoom) => void
  onToggleListed: (roomId: string) => void
  onDeleteRoom: (roomId: string) => void
  onCompleteOrder: (orderId: string) => void
  onApproveCancel: (orderId: string) => void
  onRespondTicket: (ticketId: string, response: string) => void
  onSetPayFailRate: (rate: number) => void
  onReset: () => void
}

const EMPTY_ROOM: HotelRoom = {
  id: '', name: '', hotelName: '', city: 'Beijing', address: '', bedType: '1 张 1.8m 大床', capacity: 2, area: 30,
  facilities: [], image: 'deluxe', price: 699, stock: 5, initialStock: 5, status: 'listed',
  cancellationPolicy: '', mealPlan: 'breakfast_2',
}

export function HotelAdminView({ rooms, orders, tickets, payFailRate, onBack, onUpsertRoom, onToggleListed, onDeleteRoom, onCompleteOrder, onApproveCancel, onRespondTicket, onSetPayFailRate, onReset }: HotelAdminViewProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('stats')
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<HotelRoom>(EMPTY_ROOM)
  const [facilityText, setFacilityText] = useState('')

  const stats = useMemo(() => {
    const paid = orders.filter((o) => o.status === 'paid' || o.status === 'completed')
    const revenue = paid.reduce((s, o) => s + o.totalAmount, 0)
    return {
      roomCount: rooms.length,
      listed: rooms.filter((r) => r.status === 'listed').length,
      orderCount: orders.length,
      paidCount: paid.length,
      revenue,
      waitingTickets: tickets.filter((x) => x.status === 'waiting').length,
    }
  }, [rooms, orders, tickets])

  const openNew = () => { setEditing({ ...EMPTY_ROOM, cancellationPolicy: t('hotel.default_cancel') }); setFacilityText('wifi,tv'); setEditOpen(true) }
  const openEdit = (r: HotelRoom) => { setEditing({ ...r }); setFacilityText(r.facilities.join(',')); setEditOpen(true) }
  const save = () => {
    const room: HotelRoom = { ...editing, facilities: facilityText.split(/[,，]/).map((x) => x.trim()).filter(Boolean) }
    if (!room.cancellationPolicy) room.cancellationPolicy = t('hotel.default_cancel')
    onUpsertRoom(room)
    setEditOpen(false)
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.back_home')}</Button>
      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-charcoal-900">{t('hotel.admin_title')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReset}>{t('hotel.admin_reset')}</Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')} icon={LayoutDashboard} label={t('hotel.admin_stats')} />
        <TabBtn active={tab === 'rooms'} onClick={() => setTab('rooms')} icon={BedDouble} label={t('hotel.admin_rooms')} />
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')} icon={Receipt} label={t('hotel.admin_orders')} />
        <TabBtn active={tab === 'tickets'} onClick={() => setTab('tickets')} icon={Ticket} label={t('hotel.admin_tickets')} badge={stats.waitingTickets} />
      </div>

      {tab === 'stats' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={t('hotel.stats_rooms')} value={stats.roomCount} sub={`${stats.listed} ${t('hotel.admin_listed')}`} />
          <StatCard label={t('hotel.stats_orders')} value={stats.orderCount} sub={`${stats.paidCount} ${t('hotel.stats_paid')}`} />
          <StatCard label={t('hotel.stats_revenue')} value={money(stats.revenue)} sub={t('hotel.admin_tickets')} />
          <StatCard label={t('hotel.stats_pending_tickets')} value={stats.waitingTickets} sub="" />
          <div className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-4 shadow-sm">
            <p className="text-xs font-semibold text-charcoal-500">{t('hotel.admin_pay_fail_rate')}</p>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={0} max={100} value={Math.round(payFailRate * 100)} onChange={(e) => onSetPayFailRate(Number(e.target.value) / 100)} className="flex-1 accent-chili-500" />
              <span className="w-12 text-right text-sm font-bold text-chili-600">{Math.round(payFailRate * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'rooms' && (
        <div className="mt-4">
          <Button onClick={openNew}>{t('hotel.admin_add_room')}</Button>
          <div className="mt-4 overflow-hidden rounded-3xl border border-charcoal-900/5 bg-rice-50 shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-rice-100 text-xs font-bold text-charcoal-500">
                <tr>
                  <th className='px-3 py-2 text-left'>{t('hotel.admin_room_name')}</th><th className='px-3 py-2 text-left'>{t('hotel.admin_hotel_name')}</th><th className='px-3 py-2 text-left'>{t('hotel.admin_city')}</th><th className='px-3 py-2 text-left'>{t('hotel.admin_price')}</th><th className='px-3 py-2 text-left'>{t('hotel.admin_stock')}</th><th className='px-3 py-2 text-left'>{t('hotel.admin_listed')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.id} className="border-t border-charcoal-900/5">
                    <td className='px-3 py-2 text-charcoal-700'>{r.name}</td><td className='px-3 py-2 text-charcoal-700'>{r.hotelName}</td><td className='px-3 py-2 text-charcoal-700'>{r.city}</td><td className='px-3 py-2 text-charcoal-700'>{money(r.price)}</td><td className='px-3 py-2 text-charcoal-700'>{r.stock}/{r.initialStock}</td>
                    <td className='px-3 py-2 text-charcoal-700'><button onClick={() => onToggleListed(r.id)} className={`rounded-full px-2 py-1 text-xs font-bold ${r.status === 'listed' ? 'bg-emerald-100 text-emerald-600' : 'bg-charcoal-100 text-charcoal-500'}`}>{r.status === 'listed' ? t('hotel.admin_listed') : t('hotel.admin_unlisted')}</button></td>
                    <td className='px-3 py-2'><div className='flex justify-end gap-2'>
                        <Button size="sm" variant="outline" onClick={() => openEdit(r)}>{t('hotel.admin_edit_room')}</Button>
                        <Button size="sm" variant="outline" onClick={() => onDeleteRoom(r.id)}>{t('hotel.admin_delete')}</Button>
</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="mt-4 space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><code className="text-xs font-mono text-charcoal-500">{o.id}</code>
                  <p className="mt-1 text-sm text-charcoal-700">{o.checkIn} → {o.checkOut} · {o.guest.name} · {o.guest.phone}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <p className="mt-2 text-lg font-extrabold text-chili-600">{money(o.totalAmount)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {o.status === 'paid' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => onCompleteOrder(o.id)}><CheckCircle2 size={14} />{t('hotel.admin_mark_complete')}</Button>
                    {tickets.some((tk) => tk.orderId === o.id && tk.type === 'cancel_request' && tk.status === 'waiting') && (
                      <Button size="sm" variant="outline" onClick={() => onApproveCancel(o.id)}><XCircle size={14} />{t('hotel.admin_approve_cancel')}</Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="rounded-2xl bg-rice-100 p-6 text-center text-sm text-charcoal-500">—</p>}
        </div>
      )}

      {tab === 'tickets' && (
        <div className="mt-4 space-y-3">
          {tickets.map((tk) => {
            const order = orders.find((o) => o.id === tk.orderId)
            return (
              <TicketRow key={tk.id} tk={tk} order={order} onRespond={(resp) => onRespondTicket(tk.id, resp)} />
            )
          })}
          {tickets.length === 0 && <p className="rounded-2xl bg-rice-100 p-6 text-center text-sm text-charcoal-500">{t('hotel.ticket_empty')}</p>}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent title={editing.id ? t('hotel.admin_edit_room') : t('hotel.admin_add_room')} className="md:max-w-2xl">
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={t('hotel.admin_room_name')} value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label={t('hotel.admin_hotel_name')} value={editing.hotelName} onChange={(v) => setEditing({ ...editing, hotelName: v })} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-charcoal-500">{t('hotel.admin_city')}</span>
              <select value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none">
                {['Beijing', 'Shanghai', 'Chengdu'].map((c) => <option key={c} value={c}>{t(`hotel.cities.${c}` as 'hotel.cities.Beijing')}</option>)}
              </select>
            </label>
            <Field label={t('hotel.admin_address')} value={editing.address} onChange={(v) => setEditing({ ...editing, address: v })} />
            <Field label={t('hotel.admin_bed_type')} value={editing.bedType} onChange={(v) => setEditing({ ...editing, bedType: v })} />
            <Field label={t('hotel.admin_capacity')} value={String(editing.capacity)} type="number" onChange={(v) => setEditing({ ...editing, capacity: Number(v) || 1 })} />
            <Field label={t('hotel.admin_area')} value={String(editing.area)} type="number" onChange={(v) => setEditing({ ...editing, area: Number(v) || 0 })} />
            <Field label={t('hotel.admin_price')} value={String(editing.price)} type="number" onChange={(v) => setEditing({ ...editing, price: Number(v) || 0 })} />
            <Field label={t('hotel.admin_stock')} value={String(editing.stock)} type="number" onChange={(v) => setEditing({ ...editing, stock: Number(v) || 0 })} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-charcoal-500">{t('hotel.admin_meal_plan')}</span>
              <select value={editing.mealPlan} onChange={(e) => setEditing({ ...editing, mealPlan: e.target.value as HotelRoom['mealPlan'] })} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm">
                <option value="none">{t('hotel.meal.none')}</option>
                <option value="breakfast_1">{t('hotel.meal.breakfast_1')}</option>
                <option value="breakfast_2">{t('hotel.meal.breakfast_2')}</option>
                <option value="half_board">{t('hotel.meal.half_board')}</option>
                <option value="full_board">{t('hotel.meal.full_board')}</option>
              </select>
            </label>
            <Field label={t('hotel.admin_image')} value={editing.image} onChange={(v) => setEditing({ ...editing, image: v })} />
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-semibold text-charcoal-500">{t('hotel.admin_facilities')}</span>
              <input value={facilityText} onChange={(e) => setFacilityText(e.target.value)} placeholder="wifi,tv,window" className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm" />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1">
              <span className="text-xs font-semibold text-charcoal-500">{t('hotel.admin_cancel_policy')}</span>
              <textarea value={editing.cancellationPolicy} onChange={(e) => setEditing({ ...editing, cancellationPolicy: e.target.value })} rows={2} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={save}>{t('hotel.admin_save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function TabBtn({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick: () => void; icon: typeof BedDouble; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-chili-50 text-chili-600' : 'bg-rice-100 text-charcoal-600'}`}>
      <Icon size={14} />{label}
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chili-500 px-1 text-xs text-white">{badge}</span> : null}
    </button>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-4 shadow-sm">
      <p className="text-xs font-semibold text-charcoal-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-charcoal-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-charcoal-500">{sub}</p>}
    </div>
  )
}

function Field({ label, value, onChange, type }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-charcoal-500">{label}</span>
      <input type={type ?? 'text'} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
    </label>
  )
}



function TicketRow({ tk, order, onRespond }: { tk: HotelTicket; order?: HotelOrder; onRespond: (r: string) => void }) {
  const [resp, setResp] = useState('')
  return (
    <div key={tk.id} className="rounded-3xl border border-charcoal-900/5 bg-rice-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-charcoal-900">{tk.subject} <span className="ml-1 text-xs text-chili-600">{tk.type === 'cancel_request' ? 'Cancel' : 'Inquiry'}</span></p>
          <p className="mt-1 text-xs text-charcoal-500">{tk.id} · {order?.id ?? '—'} · {new Date(tk.createdAt).toLocaleString()}</p>
        </div>
        {tk.status === 'waiting'
          ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-600">waiting</span>
          : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-600">resolved</span>}
      </div>
      <p className="mt-2 text-sm text-charcoal-700">{tk.content}</p>
      {tk.response && <div className="mt-2 rounded-xl bg-white p-3 text-sm"><p className="text-xs font-semibold text-chili-600">Reply</p><p className="mt-1 text-charcoal-700">{tk.response}</p></div>}
      {tk.status === 'waiting' && (
        <div className="mt-3 flex gap-2">
          <input value={resp} onChange={(e) => setResp(e.target.value)} placeholder="回复内容" className="min-w-0 flex-1 rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
          <Button size="sm" onClick={() => resp.trim() && onRespond(resp.trim())}>回复</Button>
        </div>
      )}
    </div>
  )
}
