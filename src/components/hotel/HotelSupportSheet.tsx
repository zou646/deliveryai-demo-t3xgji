import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Headphones, HelpCircle, MessageSquare, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { HOTEL_FAQS } from '@/data/hotel'
import type { HotelOrder, HotelTicket, HotelTicketType } from '@/types'

interface HotelSupportSheetProps {
  open: boolean
  orders: HotelOrder[]
  tickets: HotelTicket[]
  initialOrderId?: string
  initialTab?: TabKey
  onOpenChange: (open: boolean) => void
  onSubmitTicket: (ticket: Omit<HotelTicket, 'id' | 'createdAt' | 'status'>) => void
}

type TabKey = 'faq' | 'submit' | 'tickets'

export function HotelSupportSheet({ open, orders, tickets, initialOrderId, initialTab = 'faq', onOpenChange, onSubmitTicket }: HotelSupportSheetProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>(initialTab)
  const [type, setType] = useState<HotelTicketType>('inquiry')
  const [orderId, setOrderId] = useState<string>(initialOrderId ?? orders[0]?.id ?? '')
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const submit = () => {
    if (content.trim().length < 5) { setErr(t('hotel.error.content_too_short')); return }
    if (type === 'cancel_request' && !orderId) { setErr(t('hotel.error.draft_empty')); return }
    setErr(null)
    onSubmitTicket({
      type,
      orderId: type === 'cancel_request' ? orderId : orderId || undefined,
      subject: subject.trim() || (type === 'cancel_request' ? t('hotel.cancel_apply_title') : t('hotel.ticket_submit_title')),
      content: content.trim(),
    })
    setSubject('')
    setContent('')
    setTab('tickets')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('hotel.support_title')} className="md:max-w-2xl">
        <div className="mt-3 flex gap-2 overflow-x-auto">
          <TabBtn active={tab === 'faq'} onClick={() => setTab('faq')} icon={HelpCircle} label={t('hotel.faq_title')} />
          <TabBtn active={tab === 'submit'} onClick={() => setTab('submit')} icon={MessageSquare} label={t('hotel.ticket_submit_title')} />
          <TabBtn active={tab === 'tickets'} onClick={() => setTab('tickets')} icon={Ticket} label={t('hotel.my_tickets')} badge={tickets.filter((x) => x.status === 'waiting').length} />
        </div>

        {tab === 'faq' && (
          <div className="mt-4 space-y-3">
            {HOTEL_FAQS.map((f, i) => (
              <details key={i} className="group rounded-2xl border border-charcoal-900/10 bg-rice-50 p-4 open:bg-white">
                <summary className="cursor-pointer list-none text-sm font-semibold text-charcoal-900">{t(f.q)}</summary>
                <p className="mt-2 text-sm leading-6 text-charcoal-500">{t(f.a)}</p>
              </details>
            ))}
          </div>
        )}

        {tab === 'submit' && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setType('inquiry')} className={`rounded-2xl border p-3 text-sm font-semibold ${type === 'inquiry' ? 'border-chili-500 bg-chili-50 text-chili-700' : 'border-charcoal-900/10 bg-rice-50 text-charcoal-700'}`}>{t('hotel.ticket_type_inquiry')}</button>
              <button onClick={() => setType('cancel_request')} className={`rounded-2xl border p-3 text-sm font-semibold ${type === 'cancel_request' ? 'border-chili-500 bg-chili-50 text-chili-700' : 'border-charcoal-900/10 bg-rice-50 text-charcoal-700'}`}>{t('hotel.ticket_type_cancel')}</button>
            </div>
            {type === 'cancel_request' && (
              <div className="rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-700">{t('hotel.cancel_apply_desc')}</div>
            )}
            {orders.length > 0 && (
              <label className="block">
                <span className="text-xs font-semibold text-charcoal-500">{t('hotel.order_id')}</span>
                <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="mt-1 w-full rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none">
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.checkIn}→{o.checkOut}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold text-charcoal-500">{t('hotel.ticket_subject')}</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('hotel.ticket_subject_ph')} className="mt-1 w-full rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-charcoal-500">{type === 'cancel_request' ? t('hotel.cancel_reason') : t('hotel.ticket_content')}</span>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder={type === 'cancel_request' ? t('hotel.cancel_reason_ph') : t('hotel.ticket_content_ph')} className="mt-1 w-full rounded-xl border border-charcoal-900/10 bg-white px-3 py-2 text-sm focus:border-chili-500 focus:outline-none" />
            </label>
            {err && <p className="text-sm text-chili-600">{err}</p>}
            <Button className="w-full" onClick={submit}>{type === 'cancel_request' ? t('hotel.submit_cancel') : t('hotel.submit_ticket')}</Button>
          </div>
        )}

        {tab === 'tickets' && (
          <div className="mt-4 space-y-3">
            {tickets.length === 0 ? (
              <p className="rounded-2xl bg-rice-100 p-6 text-center text-sm text-charcoal-500">{t('hotel.ticket_empty')}</p>
            ) : tickets.map((tk) => (
              <div key={tk.id} className="rounded-2xl border border-charcoal-900/10 bg-rice-50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-charcoal-900">{tk.subject}</p>
                    <p className="mt-1 text-xs text-charcoal-500"><code className="font-mono">{tk.id}</code> · {new Date(tk.createdAt).toLocaleString()}</p>
                  </div>
                  {tk.status === 'waiting' ? <span className='rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-600'>{t('hotel.ticket_status_waiting')}</span> : <span className='rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-600'>{t('hotel.ticket_status_processed')}</span>}
                </div>
                <p className="mt-2 text-sm leading-6 text-charcoal-700">{tk.content}</p>
                {tk.response && <div className="mt-2 rounded-xl bg-white p-3 text-sm text-charcoal-700"><p className="text-xs font-semibold text-chili-600">{t('hotel.ticket_reply')}</p><p className="mt-1">{tk.response}</p></div>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabBtn({ active, onClick, icon: Icon, label, badge }: { active: boolean; onClick: () => void; icon: typeof Headphones; label: string; badge?: number }) {
  return (
    <button onClick={onClick} className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-chili-50 text-chili-600' : 'bg-rice-100 text-charcoal-600'}`}>
      <Icon size={14} />{label}
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-chili-500 px-1 text-xs text-white">{badge}</span> : null}
    </button>
  )
}




