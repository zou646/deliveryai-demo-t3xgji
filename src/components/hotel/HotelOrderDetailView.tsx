import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, CalendarDays, CreditCard, Headphones, RotateCcw, UserRound, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { RoomImage } from '@/components/hotel/RoomImage'
import { money } from '@/lib/utils'
import { StatusBadge } from '@/components/hotel/HotelOrdersView'
import type { HotelOrder, HotelPayment } from '@/types'

interface HotelOrderDetailViewProps {
  order: HotelOrder
  onBack: () => void
  onPay: (orderId: string, method: HotelPayment['method']) => void
  onCancel: (orderId: string) => void
  onRebook: (roomId: string) => void
  onSupport: (orderId: string) => void
}

export function HotelOrderDetailView({ order, onBack, onPay, onCancel, onRebook, onSupport }: HotelOrderDetailViewProps) {
  const { t } = useTranslation()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payMethod, setPayMethod] = useState<HotelPayment['method']>('wechat')
  const [paying, setPaying] = useState(false)

  const isPending = order.status === 'pending_payment'
  const isPaid = order.status === 'paid'
  const firstRoom = order.items[0]
  const created = useMemo(() => {
    try { return new Date(order.createdAt).toLocaleString() } catch { return order.createdAt }
  }, [order.createdAt])

  const payTimerRef = useRef<number | null>(null)

  // 支付完成（状态由 pending_payment 变为 paid/cancelled 等）时关闭弹窗并复位加载态
  useEffect(() => {
    if (order.status !== 'pending_payment') {
      if (payTimerRef.current !== null) {
        clearTimeout(payTimerRef.current)
        payTimerRef.current = null
      }
      setPaying(false)
      setPayOpen(false)
    }
  }, [order.status])

  // 组件卸载 / 弹窗关闭时清理遗留 timer（防止用户按 Esc 后仍触发支付）
  useEffect(() => {
    return () => {
      if (payTimerRef.current !== null) {
        clearTimeout(payTimerRef.current)
        payTimerRef.current = null
      }
    }
  }, [])

  const doPay = () => {
    if (paying) return
    setPaying(true)
    onPay(order.id, payMethod)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-5 pb-28 lg:px-6 lg:py-7 lg:pb-8">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={16} />{t('hotel.orders_title')}</Button>

      <div className="mt-3 rounded-3xl border border-charcoal-900/5 bg-gradient-to-br from-rice-50 to-amber-50 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-charcoal-900">{t('hotel.order_detail_title')}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-3 grid gap-1 text-sm text-charcoal-700">
          <p className="flex items-center gap-2"><span className="text-charcoal-500">{t('hotel.order_id')}：</span><code className="rounded bg-white px-2 py-0.5 text-xs font-mono">{order.id}</code></p>
          <p className="flex items-center gap-2"><span className="text-charcoal-500">{t('hotel.order_created_at')}：</span>{created}</p>
          <p className="flex items-center gap-2"><CalendarDays size={14} className="text-chili-500" />{order.checkIn} → {order.checkOut} · {t('hotel.nights_total', { count: order.nights })}</p>
        </div>
      </div>

      <section className="mt-4 rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-base font-bold text-charcoal-900"><UserRound size={16} className="text-chili-500" />{t('hotel.guest_info')}</h3>
        <div className="mt-3 grid gap-2 text-sm text-charcoal-700">
          <p>{order.guest.name} · {order.guest.phone}</p>
          {order.guest.idNumber && <p className="text-xs text-charcoal-500">{t(order.guest.idType === 'passport' ? 'hotel.passport' : order.guest.idType === 'other' ? 'hotel.other_id' : 'hotel.id_card')}：{order.guest.idNumber}</p>}
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-charcoal-900/5 bg-rice-50 p-5 shadow-sm">
        <h3 className="text-base font-bold text-charcoal-900">{t('hotel.room_info')}</h3>
        <div className="mt-3 space-y-3">
          {order.items.map((it) => (
            <div key={it.roomId} className="flex items-center gap-3 rounded-2xl bg-white p-3">
              <RoomImage imageKey={it.image} className="h-16 w-20 shrink-0 rounded-xl" emojiClassName="text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-charcoal-900">{it.roomName}</p>
                <p className="text-xs text-charcoal-500">{it.hotelName} · {it.bedType}</p>
                <p className="mt-1 text-xs text-charcoal-500">{money(it.pricePerNight)} × {it.rooms}{t('hotel.rooms')} × {it.nights}{t('hotel.nights')}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-chili-600">{money(it.subtotal)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-lg font-extrabold text-chili-600"><span>{t('hotel.total')}</span><span>{money(order.totalAmount)}</span></div>
        {order.payment && <p className="mt-2 text-xs text-charcoal-500">{t('hotel.pay_wechat') /* fallback */} Payment ID: {order.payment.paymentId}</p>}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {isPending && (
          <>
            <Button onClick={() => setPayOpen(true)}><CreditCard size={16} />{t('hotel.action_pay')}</Button>
            <Button variant="outline" onClick={() => setConfirmCancel(true)}><XCircle size={16} />{t('hotel.action_cancel')}</Button>
          </>
        )}
        {isPaid && (
          <Button variant="outline" onClick={() => onSupport(order.id)}><Headphones size={16} />{t('hotel.action_contact')}</Button>
        )}
        {firstRoom && (
          <Button variant="outline" onClick={() => onRebook(firstRoom.roomId)}><RotateCcw size={16} />{t('hotel.action_rebook')}</Button>
        )}
      </div>

      <Dialog open={payOpen} onOpenChange={(open) => { if (!open && paying) return; setPayOpen(open) }}>
        <DialogContent title={t('hotel.pay_title')} className="md:max-w-md">
          <p className="mt-2 text-sm text-charcoal-500">{t('hotel.select_payment')}</p>
          <div className="mt-4 space-y-2">
            {(['wechat', 'alipay', 'card'] as const).map((m) => (
              <button key={m} onClick={() => setPayMethod(m)} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold ${payMethod === m ? 'border-chili-500 bg-chili-50 text-chili-700' : 'border-charcoal-900/10 bg-rice-50 text-charcoal-700'}`}>
                {t(`hotel.pay_${m}`)}{payMethod === m && <span className="text-chili-500">●</span>}
              </button>
            ))}
          </div>
          <Button className="mt-5 w-full" disabled={paying} onClick={doPay}>
            {paying ? t('hotel.paying') : t('hotel.confirm_pay', { amount: money(order.totalAmount) })}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent title={t('hotel.action_cancel')} className="md:max-w-md">
          <p className="mt-2 text-sm text-charcoal-500">{t('hotel.action_cancel_confirm')}</p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>{t('hotel.action_back')}</Button>
            <Button onClick={() => { setConfirmCancel(false); onCancel(order.id) }}>{t('hotel.action_cancel')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
