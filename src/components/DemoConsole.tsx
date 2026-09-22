import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ChefHat, Clock, Coins, RotateCcw, Store, ToggleLeft, Undo2, UtensilsCrossed, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { products, tableAreas } from '@/data/menu'
import type { OrderItem, OrderStage, PointsState, ServiceRequest } from '@/types'

const stageIcons: Record<OrderStage, typeof ChefHat> = {
  submitted: Store,
  accepted: CheckCircle2,
  cooking: ChefHat,
  served: UtensilsCrossed,
}
const stageKeys: OrderStage[] = ['submitted', 'accepted', 'cooking', 'served']

interface DemoConsoleProps {
  open: boolean
  table: string
  stage: OrderStage
  soldOut: string[]
  services: ServiceRequest[]
  items: OrderItem[]
  points: PointsState
  onOpenChange: (open: boolean) => void
  onStage: (stage: OrderStage) => void
  onSoldOut: (id: string) => void
  onRespond: () => void
  onReset: () => void
  onApproveCancel: (uid: string) => void
  onGrantPoints: (n: number) => void
  onExpirePoints: () => void
}

export function DemoConsole({ open, table, stage, soldOut, services, items, points, onOpenChange, onStage, onSoldOut, onRespond, onReset, onApproveCancel, onGrantPoints, onExpirePoints }: DemoConsoleProps) {
  const { t } = useTranslation()
  const [grantAmount, setGrantAmount] = useState('500')
  const waiting = services.filter((service) => service.status === 'waiting').length
  const pendingRefunds = items.filter((item) => item.cancelState === 'requested')
  const areaKey = tableAreas[table]
  const tableLabel = areaKey ? `${table} · ${t(areaKey)}` : table
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('console.title')} className="md:max-w-2xl">
        <p className="mt-2 text-sm text-charcoal-500">{t('console.desc')}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="font-bold text-charcoal-900">{t('console.table_fulfillment')}</h3><span className="rounded-full bg-rice-100 px-3 py-1 text-xs font-bold text-charcoal-500">{tableLabel}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2">{stageKeys.map((value) => { const Icon = stageIcons[value]; return <button key={value} onClick={() => onStage(value)} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-bold transition ${stage === value ? 'border-chili-500 bg-chili-50 text-chili-600' : 'border-charcoal-900/5 bg-rice-50 text-charcoal-500'}`}><Icon size={16} />{t(`console.stage.${value}`)}</button> })}</div>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="font-bold text-charcoal-900">{t('console.service_response')}</h3><span className={`rounded-full px-3 py-1 text-xs font-bold ${waiting ? 'bg-amber-100 text-amber-500' : 'bg-emerald-50 text-emerald-600'}`}>{t('console.waiting_count', { count: waiting })}</span></div>
            <p className="mt-4 text-sm leading-6 text-charcoal-500">{t('console.response_desc')}</p>
            <Button onClick={onRespond} disabled={!waiting} variant="secondary" className="mt-3 w-full"><CheckCircle2 size={17} />{t('console.respond_btn')}</Button>
          </section>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-bold text-charcoal-900"><Undo2 size={16} className="text-amber-500" />{t('console.refund_title')}</h3>
            {!pendingRefunds.length ? (
              <p className="mt-4 rounded-xl bg-rice-100 p-4 text-sm text-charcoal-500">{t('console.refund_empty')}</p>
            ) : (
              <div className="mt-3 space-y-2">{pendingRefunds.map((item) => <div key={item.uid} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal-900/5 bg-rice-50 p-3"><span className="min-w-0 flex-1 truncate text-sm text-charcoal-700">{item.name} <small className="text-charcoal-500">× {item.quantity}</small></span><Button size="sm" variant="secondary" onClick={() => onApproveCancel(item.uid)}><CheckCircle2 size={14} />{t('console.refund_confirm')}</Button></div>)}</div>
            )}
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-charcoal-900"><Coins size={16} className="text-amber-500" />{t('console.points_title')}</h3><span className="flex items-center gap-1 rounded-full bg-chili-50 px-3 py-1 text-xs font-bold text-chili-600"><Coins size={13} />{t('console.balance_label')} {points.balance}</span></div>
            <p className="mt-4 text-sm leading-6 text-charcoal-500">{t('console.points_grant_desc')}</p>
            <div className="mt-3 flex gap-2">
              <input value={grantAmount} onChange={(event) => setGrantAmount(event.target.value)} inputMode="numeric" placeholder={t('console.points_grant_placeholder')} className="min-w-0 flex-1 rounded-xl border border-charcoal-900/10 bg-rice-50 px-3 py-2 text-sm text-charcoal-900 focus:border-chili-500 focus:outline-none" />
              <Button variant="secondary" onClick={() => onGrantPoints(Number.parseInt(grantAmount, 10) || 0)}><Coins size={15} />{t('console.points_grant_btn')}</Button>
            </div>
            <Button onClick={onExpirePoints} variant="outline" className="mt-2 w-full"><Clock size={15} />{t('console.points_expire_btn')}</Button>
          </section>
        </div>
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="font-bold text-charcoal-900">{t('console.soldout_title')}</h3><span className="flex items-center gap-1 text-xs text-charcoal-500"><ToggleLeft size={16} />{t('console.soldout_hint')}</span></div>
          <div className="scrollbar-none mt-4 flex gap-2 overflow-x-auto pb-1">{products.map((product) => { const unavailable = soldOut.includes(product.id); return <button key={product.id} onClick={() => onSoldOut(product.id)} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${unavailable ? 'border-chili-500/30 bg-chili-50 text-chili-600' : 'border-charcoal-900/5 bg-rice-50 text-charcoal-500'}`}>{unavailable ? <XCircle size={15} /> : <CheckCircle2 size={15} />}{t(product.name)}</button> })}</div>
        </section>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button variant="outline" onClick={onReset}><RotateCcw size={17} />{t('console.reset')}</Button><Button onClick={() => onOpenChange(false)}>{t('console.done')}</Button></div>
      </DialogContent>
    </Dialog>
  )
}
