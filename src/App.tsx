import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import i18next from 'i18next'
import { useTranslation } from 'react-i18next'
import { BedDouble, ClipboardList, ConciergeBell, Headphones, Home as HomeIcon, LayoutDashboard, Menu as MenuIcon, Receipt, ShoppingBasket } from 'lucide-react'
import { HomeView } from '@/components/HomeView'
import { WelcomeView } from '@/components/WelcomeView'
import { CartPanel } from '@/components/CartPanel'
import { CheckoutView } from '@/components/CheckoutView'
import { DemoConsole } from '@/components/DemoConsole'
import { MenuView } from '@/components/MenuView'
import { OrderView } from '@/components/OrderView'
import { ServiceSheet } from '@/components/ServiceSheet'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useElderlyMode } from '@/hooks/useElderlyMode'
import { initialViewFromHash, isHotelView, useViewRoute } from '@/hooks/useViewRoute'
import { appReducer } from '@/state/reducer'
import { initialState } from '@/state/orderReducer'
import { products } from '@/data/menu'
import { money } from '@/lib/utils'
import type { AppState, HotelGuest, ViewName } from '@/types'

// Hotel views
import { HotelHomeView } from '@/components/hotel/HotelHomeView'
import { HotelRoomDetailView } from '@/components/hotel/HotelRoomDetailView'
import { HotelCheckoutView } from '@/components/hotel/HotelCheckoutView'
import { HotelOrdersView } from '@/components/hotel/HotelOrdersView'
import { HotelOrderDetailView } from '@/components/hotel/HotelOrderDetailView'
import { HotelAdminView } from '@/components/hotel/HotelAdminView'
import { HotelSupportSheet } from '@/components/hotel/HotelSupportSheet'

function createInitialState(): AppState {
  const search = new URLSearchParams(window.location.search)
  const requestedView = initialViewFromHash()

  if (requestedView && isHotelView(requestedView)) {
    return { ...initialState, appModule: 'hotel', view: requestedView }
  }

  if (search.get('preview') === 'menu') {
    const product = products[2]
    const spec = [i18next.t('menu.option.full'), i18next.t('menu.option.original')].join(' · ')
    return {
      ...initialState,
      table: 'A08',
      view: 'menu',
      cart: [{ uid: 'preview-item', productId: product.id, name: i18next.t(product.name), price: product.price, quantity: 1, image: product.image, spec, orderedBy: '姚乾' }],
      lastMessage: initialState.lastMessage,
    }
  }

  if (requestedView && requestedView !== 'home') {
    return { ...initialState, table: 'A08', view: requestedView }
  }

  return initialState
}

export default function App() {
  const { t, i18n } = useTranslation()
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialState)
  const { enabled: elderly, toggle: toggleElderly } = useElderlyMode()

  // Dialogs
  const [serviceOpen, setServiceOpen] = useState(false)
  const [hotelSupportOpen, setHotelSupportOpen] = useState(false)
  const [hotelSupportContext, setHotelSupportContext] = useState<{ orderId?: string; tab?: 'faq' | 'submit' | 'tickets' }>({})
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [paying, setPaying] = useState(false)

  const isHotel = state.appModule === 'hotel'
  const cartTotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const waitingServices = state.services.filter((s) => s.status === 'waiting').length
  const waitingHotelTickets = state.hotel.tickets.filter((t) => t.status === 'waiting').length

  const canView = useCallback((view: ViewName) => {
    if (isHotelView(view)) return true // 酒店模块全部视图可达
    return view === 'home' || !!state.table
  }, [state.table])

  const navigate = useCallback((view: ViewName) => dispatch({ type: 'SET_VIEW', view }), [])
  useViewRoute(state.view, { onNavigate: navigate, canView })

  useEffect(() => {
    document.documentElement.lang = i18n.language === 'zh' ? 'zh-CN' : 'en'
    document.title = isHotel ? t('hotel.meta_title') : t('common.title')
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', isHotel ? t('hotel.meta_title') : t('common.meta_desc'))
    try { localStorage.setItem('i18nextLng', i18n.language) } catch { /* ignore */ }
  }, [i18n.language, t, isHotel])

  const changeView = (view: ViewName) => dispatch({ type: 'SET_VIEW', view })
  const switchModule = (m: AppState['appModule']) => dispatch({ type: 'SET_MODULE', module: m })

  const submitOrder = () => {
    dispatch({ type: 'SUBMIT_ORDER' })
    setCartOpen(false)
  }
  const toggleLanguage = () => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')
  const handleToggleElderly = () => {
    toggleElderly()
    dispatch({ type: 'SET_MESSAGE', message: elderly ? t('common.elderly_mode_off') : t('common.elderly_mode_on') })
  }

  // ----- Hotel handlers -----
  const hotelSelectRoom = (roomId: string) => {
    dispatch({ type: 'HOTEL_VIEW_ROOM', roomId })
    changeView('hotel-room')
  }
  const hotelAddDraft = (roomId: string, rooms: number) => dispatch({ type: 'HOTEL_ADD_DRAFT', roomId, rooms })
  const hotelSubmit = (guest: HotelGuest) => {
    dispatch({ type: 'HOTEL_SUBMIT_ORDER', guest })
    // HOTEL_SUBMIT_ORDER reducer sets currentOrderId to the new order; navigate there.
    changeView('hotel-order-detail')
  }
  const hotelPay = (orderId: string, method: 'wechat' | 'alipay' | 'card' | 'mock') => {
    if (paying) return
    setPaying(true)
    setTimeout(() => {
      setPaying(false)
      dispatch({ type: 'HOTEL_PAY_ORDER', orderId, method })
    }, 900)
  }
  const hotelOpenSupport = (orderId?: string, tab: 'faq' | 'submit' | 'tickets' = 'faq') => {
    setHotelSupportContext({ orderId, tab })
    setHotelSupportOpen(true)
  }

  // Determine current order for order detail view
  const currentOrder = useMemo(() => {
    if (state.view !== 'hotel-order-detail') return null
    const id = state.hotel.currentOrderId ?? state.hotel.orders[0]?.id
    return state.hotel.orders.find((o) => o.id === id) ?? state.hotel.orders[0] ?? null
  }, [state.view, state.hotel.currentOrderId, state.hotel.orders])

  const currentRoom = state.hotel.currentRoomId ? state.hotel.rooms.find((r) => r.id === state.hotel.currentRoomId) : null

  // ---------------- RENDER ----------------

  // Hotel module render
  if (isHotel) {
    return (
      <div className="min-h-screen bg-rice-100 paper-noise">
        <TopBar
          module="hotel"
          view={state.view}
          serviceCount={waitingHotelTickets}
          pendingOrders={state.hotel.orders.filter((o) => o.status === 'pending_payment').length}
          language={i18n.language}
          elderly={elderly}
          points={state.points}
          onToggleLanguage={toggleLanguage}
          onToggleElderly={handleToggleElderly}
          onView={changeView}
          onService={() => hotelOpenSupport(undefined, 'faq')}
          onConsole={() => changeView('hotel-admin')}
          onRedeem={() => { /* not used for hotel */ }}
          onSwitchModule={switchModule}
        />

        {state.view === 'hotel-home' && (
          <HotelHomeView
            filters={state.hotel.filters}
            rooms={state.hotel.rooms}
            draftCount={state.hotel.draft.length}
            onFilters={(patch) => dispatch({ type: 'HOTEL_SET_FILTERS', filters: patch })}
            onSelectRoom={hotelSelectRoom}
            onGoCheckout={() => changeView('hotel-checkout')}
          />
        )}

        {state.view === 'hotel-room' && currentRoom && (
          <HotelRoomDetailView
            room={currentRoom}
            checkIn={state.hotel.filters.checkIn}
            checkOut={state.hotel.filters.checkOut}
            onBack={() => changeView('hotel-home')}
            onFilters={(patch) => dispatch({ type: 'HOTEL_SET_FILTERS', filters: patch })}
            onAdd={hotelAddDraft}
            onGoCheckout={() => changeView('hotel-checkout')}
          />
        )}
        {state.view === 'hotel-room' && !currentRoom && (
          <main className="mx-auto max-w-2xl px-4 py-10 text-center text-charcoal-500">
            <Button variant="ghost" size="sm" onClick={() => changeView('hotel-home')}>{t('hotel.back_home')}</Button>
            <p className="mt-6">Room not found.</p>
          </main>
        )}

        {state.view === 'hotel-checkout' && (
          <HotelCheckoutView
            rooms={state.hotel.rooms}
            draft={state.hotel.draft}
            checkIn={state.hotel.filters.checkIn}
            checkOut={state.hotel.filters.checkOut}
            onBack={() => changeView(state.hotel.currentRoomId ? 'hotel-room' : 'hotel-home')}
            onSubmit={hotelSubmit}
          />
        )}

        {state.view === 'hotel-orders' && (
          <HotelOrdersView
            orders={state.hotel.orders}
            onBack={() => changeView('hotel-home')}
            onSelect={(orderId) => { dispatch({ type: 'HOTEL_VIEW_ORDER', orderId }); changeView('hotel-order-detail') }}
          />
        )}

        {state.view === 'hotel-order-detail' && currentOrder && (
          <HotelOrderDetailView
            order={currentOrder}
            onBack={() => changeView('hotel-orders')}
            onPay={hotelPay}
            onCancel={(orderId) => dispatch({ type: 'HOTEL_CANCEL_ORDER', orderId })}
            onRebook={(roomId) => {
              const room = state.hotel.rooms.find((r) => r.id === roomId)
              if (!room || room.status !== 'listed') {
                dispatch({ type: 'SET_MESSAGE', message: t('hotel.error.room_unavailable') })
                changeView('hotel-home')
                return
              }
              dispatch({ type: 'HOTEL_VIEW_ROOM', roomId })
              changeView('hotel-room')
            }}
            onSupport={(orderId) => hotelOpenSupport(orderId, 'submit')}
          />
        )}
        {state.view === 'hotel-order-detail' && !currentOrder && (
          <main className="mx-auto max-w-2xl px-4 py-10 text-center text-charcoal-500">
            <Button variant="ghost" size="sm" onClick={() => changeView('hotel-orders')}>{t('hotel.orders_title')}</Button>
            <p className="mt-6">{t('hotel.empty_orders')}</p>
          </main>
        )}

        {state.view === 'hotel-admin' && (
          <HotelAdminView
            rooms={state.hotel.rooms}
            orders={state.hotel.orders}
            tickets={state.hotel.tickets}
            payFailRate={state.hotel.payFailRate}
            onBack={() => changeView('hotel-home')}
            onUpsertRoom={(room) => dispatch({ type: 'HOTEL_UPSERT_ROOM', room })}
            onToggleListed={(roomId) => dispatch({ type: 'HOTEL_TOGGLE_LISTED', roomId })}
            onDeleteRoom={(roomId) => dispatch({ type: 'HOTEL_DELETE_ROOM', roomId })}
            onCompleteOrder={(orderId) => dispatch({ type: 'HOTEL_COMPLETE_ORDER', orderId })}
            onApproveCancel={(orderId) => dispatch({ type: 'HOTEL_APPROVE_CANCEL', orderId })}
            onRespondTicket={(ticketId, response) => dispatch({ type: 'HOTEL_RESPOND_TICKET', ticketId, response })}
            onSetPayFailRate={(rate) => dispatch({ type: 'HOTEL_SET_PAY_FAIL_RATE', rate })}
            onReset={() => { dispatch({ type: 'HOTEL_RESET' }); changeView('hotel-home') }}
          />
        )}

        <HotelSupportSheet
          open={hotelSupportOpen}
          orders={state.hotel.orders}
          tickets={state.hotel.tickets}
          initialOrderId={hotelSupportContext.orderId}
          initialTab={hotelSupportContext.tab}
          onOpenChange={setHotelSupportOpen}
          onSubmitTicket={(ticket) => dispatch({ type: 'HOTEL_SUBMIT_TICKET', ticket })}
        />

        {/* Mobile bottom nav for hotel */}
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-charcoal-900/5 bg-white/95 px-2 pt-2 backdrop-blur lg:hidden">
          <MobileNav active={state.view === 'hotel-home' || state.view === 'hotel-room'} icon={HomeIcon} label={t('hotel.nav_home')} onClick={() => changeView('hotel-home')} />
          <MobileNav active={state.view === 'hotel-orders' || state.view === 'hotel-order-detail'} icon={Receipt} label={t('hotel.nav_orders')} onClick={() => changeView('hotel-orders')} badge={state.hotel.orders.filter((o) => o.status === 'pending_payment').length} />
          <MobileNav active={hotelSupportOpen} icon={Headphones} label={t('hotel.nav_support')} onClick={() => hotelOpenSupport(undefined, 'faq')} badge={waitingHotelTickets} />
          <MobileNav active={state.view === 'hotel-admin'} icon={LayoutDashboard} label={t('hotel.nav_admin')} onClick={() => changeView('hotel-admin')} />
        </nav>

        <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-charcoal-900/90 px-4 py-2 text-xs font-semibold text-white shadow-float">
          {state.lastMessage}
        </div>
      </div>
    )
  }

  // ---------------- HOTPOT (existing flow) ----------------
  if (state.view === 'home' || !state.table) {
    return <HomeView onBind={(table) => dispatch({ type: 'BIND_TABLE', table })} onEnterHotel={() => switchModule('hotel')} />
  }
  if (state.view === 'welcome') {
    return <WelcomeView table={state.table!} onEnter={() => dispatch({ type: 'SET_VIEW', view: 'menu' })} />
  }

  return (
    <div className="min-h-screen bg-rice-100 paper-noise">
      <TopBar
        module="hotpot"
        view={state.view}
        table={state.table}
        serviceCount={waitingServices}
        language={i18n.language}
        elderly={elderly}
        points={state.points}
        onToggleLanguage={toggleLanguage}
        onToggleElderly={handleToggleElderly}
        onView={changeView}
        onService={() => setServiceOpen(true)}
        onConsole={() => setConsoleOpen(true)}
        onRedeem={(tier) => dispatch({ type: 'REDEEM_POINTS', points: tier.points, value: tier.value })}
        onSwitchModule={switchModule}
      />

      {state.view === 'menu' && (
        <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 pb-28 lg:grid-cols-3 lg:px-6 lg:py-7 lg:pb-8">
          <div className="lg:col-span-2">
            <MenuView diners={state.diners} soldOut={state.soldOut} onAdd={(item) => dispatch({ type: 'ADD_CART', item })} />
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-28">
              <CartPanel items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} />
              <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-100/70 p-4 text-sm text-charcoal-700">
                <p className="font-bold">{t('common.collab_title')}</p>
                <p className="mt-1 leading-6 text-charcoal-500">{t('common.collab_desc')}</p>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => switchModule('hotel')}><BedDouble size={16} />{t('hotel.cta_hotel')}</Button>
            </div>
          </aside>
        </main>
      )}

      {state.view === 'order' && (
        <OrderView
          items={state.orderItems}
          stage={state.orderStage}
          onAddMore={() => changeView('menu')}
          onCancel={(uid) => dispatch({ type: 'REQUEST_CANCEL', uid })}
          onCheckout={() => changeView('checkout')}
        />
      )}

      {state.view === 'checkout' && (
        <CheckoutView items={state.orderItems} points={state.points} paid={state.paid} onPay={(couponIds) => dispatch({ type: 'PAY', couponIds })} onBack={() => changeView('order')} />
      )}

      <ServiceSheet open={serviceOpen} requests={state.services} onOpenChange={setServiceOpen} onCall={(service) => dispatch({ type: 'CALL_SERVICE', service })} />
      <DemoConsole
        open={consoleOpen}
        table={state.table ?? ''}
        stage={state.orderStage}
        soldOut={state.soldOut}
        services={state.services}
        items={state.orderItems}
        points={state.points}
        onOpenChange={setConsoleOpen}
        onStage={(stage) => dispatch({ type: 'SET_STAGE', stage })}
        onSoldOut={(productId) => dispatch({ type: 'TOGGLE_SOLD_OUT', productId })}
        onRespond={() => dispatch({ type: 'RESPOND_SERVICES' })}
        onReset={() => { dispatch({ type: 'RESET' }); setConsoleOpen(false) }}
        onApproveCancel={(uid) => dispatch({ type: 'APPROVE_CANCEL', uid })}
        onGrantPoints={(n) => dispatch({ type: 'GRANT_POINTS', points: n })}
        onExpirePoints={() => dispatch({ type: 'EXPIRE_POINTS' })}
      />

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent title={t('cart.dialog_title')}>
          <div className="mt-5"><CartPanel compact items={state.cart} onQuantity={(uid, delta) => dispatch({ type: 'CHANGE_QTY', uid, delta })} onSubmit={submitOrder} /></div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 lg:hidden">
        {state.view === 'menu' && state.cart.length > 0 && (
          <Button onClick={() => setCartOpen(true)} className="h-12 rounded-full px-5 shadow-float">
            <span className="relative"><ShoppingBasket size={19} /><span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-xs text-charcoal-900">{state.cart.length}</span></span>
            {t('common.view_cart')} · {money(cartTotal)}
          </Button>
        )}
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-charcoal-900/5 bg-white/95 px-2 pt-2 backdrop-blur lg:hidden">
        <MobileNav active={state.view === 'menu'} icon={MenuIcon} label={t('common.nav_menu')} onClick={() => changeView('menu')} />
        <MobileNav active={state.view === 'order'} icon={ClipboardList} label={t('common.nav_order')} onClick={() => changeView('order')} />
        <MobileNav active={serviceOpen} icon={ConciergeBell} label={t('common.nav_service')} badge={waitingServices} onClick={() => setServiceOpen(true)} />
        <MobileNav active={consoleOpen} icon={LayoutDashboard} label={t('common.nav_demo')} onClick={() => setConsoleOpen(true)} />
      </nav>

      <div className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded-full bg-charcoal-900/90 px-4 py-2 text-xs font-semibold text-white shadow-float">
        {state.lastMessage}
      </div>
    </div>
  )
}

function MobileNav({ active, icon: Icon, label, badge, onClick }: { active: boolean; icon: typeof MenuIcon; label: string; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition ${active ? 'bg-chili-50 text-chili-500' : 'text-charcoal-500'}`}>
      <Icon size={20} />{label}
      {badge ? <span className="absolute right-4 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chili-500 px-1 text-white">{badge}</span> : null}
    </button>
  )
}
