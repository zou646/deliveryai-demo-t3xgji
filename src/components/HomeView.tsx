import { useTranslation } from 'react-i18next'
import { BedDouble, ChevronRight, Flame, MapPin, QrCode, Sparkles, Users } from 'lucide-react'
import hotpot from '@/assets/hotpot.jpg'
import { Button } from '@/components/ui/button'
import { RoomImage } from '@/components/hotel/RoomImage'

const tableOptions = [
  { code: 'A08', areaKey: 'bind.area.hall', seats: 4 },
  { code: 'B12', areaKey: 'bind.area.booth', seats: 6 },
  { code: 'C06', areaKey: 'bind.area.room', seats: 4 },
  { code: 'D03', areaKey: 'bind.area.window', seats: 6 },
]

interface HomeViewProps {
  onBind: (table: string) => void
  onEnterHotel: () => void
}

export function HomeView({ onBind, onEnterHotel }: HomeViewProps) {
  const { t } = useTranslation()
  return (
    <main className="relative min-h-screen overflow-hidden bg-rice-100 paper-noise">
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-chili-100 blur-3xl" />
      <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-amber-100 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-10 lg:px-10">
        <section className="animate-rise text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-chili-500/20 bg-white/80 px-3 py-2 text-xs font-bold text-chili-600 shadow-sm">
            <Sparkles size={14} /> {t('common.concept_badge')}
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight text-charcoal-900 sm:text-5xl lg:text-6xl">
            {t('home.hero_head')}<span className="text-chili-500">{t('home.hero_tail')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-charcoal-500">{t('bind.desc')}</p>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {/* 火锅入口 */}
          <div className="animate-rise rounded-3xl border border-white/80 bg-white/90 p-4 shadow-float backdrop-blur sm:p-6">
            <div className="relative mb-4 h-40 overflow-hidden rounded-2xl">
              <img src={hotpot} alt={t('bind.img_alt')} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/70 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                <div><p className="text-xs opacity-80">{t('common.simulated_store')}</p><h2 className="text-lg font-bold">{t('common.store_name')}</h2></div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{t('common.open')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-chili-600"><Flame size={18} /><h3 className="text-lg font-bold">{t('common.brand_name')} · {t('common.subtitle')}</h3></div>
            <p className="mt-2 text-sm leading-6 text-charcoal-500">{t('bind.desc')}</p>
            <HotpotTableOptions onBind={onBind} />
            <Button onClick={() => onBind('A08')} className="mt-3 w-full"><MapPin size={17} />{t('bind.quick_enter')}</Button>
          </div>

          {/* 酒店入口 */}
          <div className="animate-rise rounded-3xl border border-white/80 bg-white/90 p-4 shadow-float backdrop-blur sm:p-6">
            <div className="relative mb-4 h-40 overflow-hidden rounded-2xl">
              <RoomImage imageKey="suite" className="h-full w-full" emojiClassName="text-6xl" />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                <div><p className="text-xs opacity-80">{t('hotel.subtitle')}</p><h2 className="text-lg font-bold">{t('hotel.brand_name')}</h2></div>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs backdrop-blur">{t('common.open')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-chili-600"><BedDouble size={18} /><h3 className="text-lg font-bold">{t('hotel.brand_name')} · {t('hotel.subtitle')}</h3></div>
            <p className="mt-2 text-sm leading-6 text-charcoal-500">{t('hotel.cta_hotel_desc')}</p>
            <ul className="mt-3 space-y-2 text-sm text-charcoal-700">
              <li className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-chili-50 text-chili-600"><BedDouble size={13} /></span>{t('home.feature_rooms')}</li>
              <li className="flex items-center gap-2"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-chili-50 text-chili-600"><MapPin size={13} /></span>{t('home.feature_ops')}</li>
            </ul>
            <Button onClick={onEnterHotel} className="mt-4 w-full">{t('hotel.cta_hotel')}<ChevronRight size={17} /></Button>
          </div>
        </section>
      </div>
    </main>
  )
}

function HotpotTableOptions({ onBind }: { onBind: (t: string) => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-rice-100 p-4">
        <span className="rounded-xl bg-white p-3 text-chili-500 shadow-sm"><QrCode /></span>
        <div className="min-w-0 flex-1"><p className="font-bold text-charcoal-900">{t('bind.qr_title')}</p><p className="text-sm text-charcoal-500">{t('bind.qr_desc')}</p></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {tableOptions.map(({ code, areaKey, seats }, index) => (
          <button key={code} onClick={() => onBind(code)} className="group rounded-2xl border border-charcoal-900/10 bg-white p-4 text-left transition hover:-translate-y-1 hover:border-chili-500 hover:shadow-card">
            <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-rice-100 text-sm font-extrabold text-chili-500">{index + 1}</span>
            <p className="font-bold text-charcoal-900">{code} · {t(areaKey)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-500"><Users size={13} /> {t('bind.seats', { count: seats })}</p>
            <ChevronRight size={17} className="ml-auto mt-2 text-charcoal-500 transition group-hover:translate-x-1 group-hover:text-chili-500" />
          </button>
        ))}
      </div>
    </>
  )
}
