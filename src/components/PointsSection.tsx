import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Coins, Gift, History, ReceiptText } from 'lucide-react'
import { POINTS_TIERS } from '@/data/points'
import type { PointEntryType, PointsState, PointsTier } from '@/types'

interface PointsSectionProps {
  points: PointsState
  onRedeem: (tier: PointsTier) => void
}

type Panel = 'ledger' | 'redeem' | null

const typeStyle: Record<PointEntryType, { labelKey: string; className: string }> = {
  earn: { labelKey: 'points.type_earn', className: 'bg-emerald-50 text-emerald-600' },
  redeem: { labelKey: 'points.type_redeem', className: 'bg-chili-50 text-chili-600' },
  refund: { labelKey: 'points.type_refund', className: 'bg-amber-100 text-amber-600' },
  expire: { labelKey: 'points.type_expire', className: 'bg-rice-200 text-charcoal-500' },
}

export function PointsSection({ points, onRedeem }: PointsSectionProps) {
  const { t, i18n } = useTranslation()
  const [panel, setPanel] = useState<Panel>(null)
  const locale = i18n.language === 'en' ? 'en-US' : 'zh-CN'
  const ledger = [...points.entries].reverse()

  return (
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      {panel === null && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-charcoal-900">{t('points.balance')}</h3>
            <span className="rounded-full bg-rice-100 px-3 py-1 text-xs font-bold text-charcoal-500">{points.balance}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button onClick={() => setPanel('ledger')} className="flex items-center justify-center gap-2 rounded-xl border border-charcoal-900/5 bg-rice-50 p-3 text-sm font-bold text-charcoal-700 transition hover:border-chili-500/30 hover:bg-chili-50 hover:text-chili-600">
              <History size={16} />{t('points.ledger')}
            </button>
            <button onClick={() => setPanel('redeem')} className="flex items-center justify-center gap-2 rounded-xl border border-charcoal-900/5 bg-rice-50 p-3 text-sm font-bold text-charcoal-700 transition hover:border-chili-500/30 hover:bg-chili-50 hover:text-chili-600">
              <Gift size={16} />{t('points.redeem')}
            </button>
          </div>
        </>
      )}

      {panel === 'ledger' && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(null)} aria-label={t('points.back')} className="rounded-lg bg-rice-100 p-1.5 text-charcoal-500 transition hover:text-chili-500"><ArrowLeft size={16} /></button>
            <h3 className="font-bold text-charcoal-900">{t('points.ledger')}</h3>
          </div>
          <div className="mt-3 space-y-2">
            {!ledger.length && (
              <div className="rounded-xl bg-rice-100 p-6 text-center text-sm text-charcoal-500">{t('points.empty_ledger')}</div>
            )}
            {ledger.map((entry) => {
              const style = typeStyle[entry.type]
              return (
                <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-charcoal-900/5 bg-rice-50 p-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.className}`}><ReceiptText size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.className}`}>{t(style.labelKey)}</span><span className="text-xs text-charcoal-500">{entry.createdAt}</span></div>
                    <p className="mt-1 truncate text-sm text-charcoal-700">{entry.note}</p>
                    {entry.type === 'earn' && entry.expiresAt && (
                      <p className="mt-0.5 text-xs text-charcoal-500">{t('points.expires', { date: new Date(entry.expiresAt).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }) })}</p>
                    )}
                  </div>
                  <strong className={`shrink-0 font-extrabold ${entry.amount > 0 ? 'text-emerald-600' : 'text-charcoal-900'}`}>{entry.amount > 0 ? `+${entry.amount}` : entry.amount}</strong>
                </div>
              )
            })}
          </div>
        </>
      )}

      {panel === 'redeem' && (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setPanel(null)} aria-label={t('points.back')} className="rounded-lg bg-rice-100 p-1.5 text-charcoal-500 transition hover:text-chili-500"><ArrowLeft size={16} /></button>
            <h3 className="font-bold text-charcoal-900">{t('points.redeem')}</h3>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-chili-50 p-3">
            <Coins size={17} className="text-chili-500" />
            <span className="text-sm text-charcoal-700">{t('points.balance')}</span>
            <strong className="ml-auto text-lg font-extrabold text-chili-600">{points.balance}</strong>
          </div>
          <div className="mt-3 space-y-2">
            {points.balance <= 0 && (
              <div className="rounded-xl bg-rice-100 p-6 text-center text-sm text-charcoal-500">{t('points.empty_redeem')}</div>
            )}
            {POINTS_TIERS.map((tier) => {
              const affordable = points.balance >= tier.points
              return (
                <div key={tier.points} className={`flex items-center gap-3 rounded-xl border p-3 ${affordable ? 'border-charcoal-900/5 bg-rice-50' : 'border-charcoal-900/5 bg-rice-50 opacity-60'}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600"><Gift size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-charcoal-900">{t('points.tier', { points: tier.points, value: tier.value })}</p>
                    {!affordable && <p className="mt-0.5 text-xs text-charcoal-500">{t('points.insufficient')}</p>}
                  </div>
                  <button
                    onClick={() => affordable && onRedeem(tier)}
                    disabled={!affordable}
                    className="rounded-xl bg-chili-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-chili-600 disabled:cursor-not-allowed disabled:bg-rice-200 disabled:text-charcoal-400"
                  >
                    {t('points.redeem_btn')}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
