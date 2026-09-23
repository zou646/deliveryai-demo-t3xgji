import { Accessibility, BedDouble, Crown, Flame, Languages, LayoutDashboard, MapPin, PhoneCall, ReceiptText, Search, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { PointsSection } from '@/components/PointsSection'
import { tableAreas } from '@/data/menu'
import type { AppModule, PointsState, PointsTier, ViewName } from '@/types'

interface TopBarProps {
  module: AppModule
  view: ViewName
  table?: string | null
  serviceCount: number
  language: string
  elderly: boolean
  points: PointsState
  pendingOrders?: number
  onToggleLanguage: () => void
  onToggleElderly: () => void
  onView: (view: ViewName) => void
  onService: () => void
  onConsole: () => void
  onRedeem: (tier: PointsTier) => void
  onSwitchModule: (m: AppModule) => void
}

export function TopBar({ module, view, table, serviceCount, language, elderly, points, pendingOrders = 0, onToggleLanguage, onToggleElderly, onView, onService, onConsole, onRedeem, onSwitchModule }: TopBarProps) {
  const { t } = useTranslation()
  const isHotel = module === 'hotel'
  const areaKey = table ? tableAreas[table] : null
  const tableLabel = areaKey ? `${table} · ${t(areaKey)}` : table ?? ''
  const benefits = 4 + points.coupons.filter((coupon) => !coupon.used).length

  return (
    <>
      <div className="bg-charcoal-900 px-4 py-2 text-center text-xs font-semibold tracking-wide text-rice-100">
        {isHotel ? 'Cloudnest · Hotel Booking Concept Demo' : t('common.banner')}
      </div>
      <header className="sticky top-0 z-30 border-b border-charcoal-900/5 bg-rice-50/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 lg:px-6">
          {/* Brand + module switch */}
          <button onClick={() => onView(isHotel ? 'hotel-home' : 'home')} className="flex items-center gap-2 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chili-500 text-lg font-black text-white shadow-md">{isHotel ? '栖' : t('common.brand')}</span>
            <span className="hidden sm:block"><strong className="block leading-4 text-charcoal-900">{isHotel ? t('hotel.brand_name') : t('common.brand_name')}</strong><small className="text-charcoal-500">{isHotel ? t('hotel.subtitle') : t('common.subtitle')}</small></span>
          </button>

          {/* Module switcher */}
          <div className="ml-1 hidden items-center gap-1 rounded-full bg-rice-200 p-1 md:flex">
            <button onClick={() => onSwitchModule('hotpot')} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${!isHotel ? 'bg-white text-chili-600 shadow' : 'text-charcoal-500'}`}><Flame size={12} />{t('common.subtitle')}</button>
            <button onClick={() => onSwitchModule('hotel')} className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition ${isHotel ? 'bg-white text-chili-600 shadow' : 'text-charcoal-500'}`}><BedDouble size={12} />{t('hotel.subtitle')}</button>
          </div>

          {!isHotel && table && (
            <span className="ml-1 hidden items-center gap-1 rounded-full bg-rice-200 px-3 py-2 text-xs font-bold text-charcoal-700 md:flex"><MapPin size={13} className="text-chili-500" />{tableLabel}</span>
          )}

          {/* Main nav per module */}
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {isHotel ? (
              <>
                <Button variant={view === 'hotel-home' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('hotel-home')}><Search size={16} />{t('hotel.nav_home')}</Button>
                <Button variant={view === 'hotel-orders' || view === 'hotel-order-detail' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('hotel-orders')}><ReceiptText size={16} />{t('hotel.nav_orders')}</Button>
              </>
            ) : (
              <>
                <Button variant={view === 'menu' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('menu')}><Search size={16} />{t('common.nav_menu')}</Button>
                <Button variant={view === 'order' ? 'secondary' : 'ghost'} size="sm" onClick={() => onView('order')}><ReceiptText size={16} />{t('common.nav_order')}</Button>
              </>
            )}
          </nav>

          {isHotel ? (
            <>
              <Button variant="outline" size="icon" onClick={onService} className="relative" aria-label={t('hotel.nav_support')}>
                <PhoneCall size={18} />{pendingOrders > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-chili-500" />}
              </Button>
              <Button variant="outline" size="icon" onClick={onConsole} aria-label={t('hotel.nav_admin')}><LayoutDashboard size={18} /></Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="icon" onClick={onService} className="relative" aria-label={t('common.aria_service')}>
                <PhoneCall size={18} />{serviceCount > 0 && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-chili-500" />}
              </Button>
              <Dialog>
                <DialogTrigger asChild><Button variant="outline" size="icon" aria-label={t('common.aria_member')}><UserRound size={18} /></Button></DialogTrigger>
                <DialogContent title={t('common.member_title')}>
                  <div className="mt-5 overflow-hidden rounded-2xl bg-gradient-to-br from-charcoal-900 to-charcoal-700 p-5 text-white shadow-card">
                    <div className="flex items-start justify-between"><span className="rounded-xl bg-amber-400 p-2 text-charcoal-900"><Crown /></span><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{t('common.member_badge')}</span></div>
                    <p className="mt-6 text-sm text-rice-200">{t('common.member_name')}</p><p className="mt-1 text-2xl font-bold">2,680 <small className="text-sm font-medium text-rice-200">{t('common.growth_value')}</small></p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-charcoal-500">{t('common.queue')}</p><p className="mt-2 text-2xl font-extrabold text-charcoal-900">A018</p><p className="text-xs text-chili-500">{t('common.queue_ahead')}</p></div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-xs text-charcoal-500">{t('common.benefits')}</p><p className="mt-2 text-2xl font-extrabold text-charcoal-900">{benefits} <small className="text-sm">{t('common.tickets')}</small></p><p className="text-xs text-amber-500">{t('common.coupon')}</p></div>
                  </div>
                  <PointsSection points={points} onRedeem={onRedeem} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="icon" onClick={onConsole} aria-label={t('common.aria_console')}><LayoutDashboard size={18} /></Button>
            </>
          )}

          <Button variant="outline" size="icon" onClick={onToggleElderly} aria-label={elderly ? t('common.aria_elderly_off') : t('common.aria_elderly')}>
            <Accessibility size={18} className={elderly ? 'text-chili-500' : ''} />
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleLanguage} aria-label={t('common.aria_lang')}>
            <Languages size={16} />{language === 'zh' ? 'EN' : t('common.language_zh')}
          </Button>
        </div>
      </header>
    </>
  )
}
