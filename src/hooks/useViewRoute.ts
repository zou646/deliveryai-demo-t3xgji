import { useEffect } from 'react'
import type { ViewName } from '@/types'

// 视图与 URL hash 一一映射。
// 使用 hash 模式以兼容 Vite base './' 与 GitHub Pages 子路径部署。
const HOTPOT_VIEWS: ViewName[] = ['home', 'welcome', 'menu', 'order', 'checkout']
const HOTEL_VIEWS: ViewName[] = ['hotel-home', 'hotel-room', 'hotel-checkout', 'hotel-orders', 'hotel-order-detail', 'hotel-admin']
const VIEWS: ViewName[] = [...HOTPOT_VIEWS, ...HOTEL_VIEWS]

export const viewToHash = (view: ViewName) => `#/${view}`

export const hashToView = (hash: string): ViewName | null => {
  const name = hash.replace(/^#\/?/, '')
  return (VIEWS as string[]).includes(name) ? (name as ViewName) : null
}

/** 读取 URL hash 请求的初始视图；无有效 hash 时返回 null。 */
export function initialViewFromHash(): ViewName | null {
  if (typeof window === 'undefined') return null
  return hashToView(window.location.hash)
}

interface UseViewRouteOptions {
  onNavigate: (view: ViewName) => void
  canView?: (view: ViewName) => boolean
}

export function isHotelView(view: ViewName): boolean {
  return view.startsWith('hotel-')
}

export function useViewRoute(view: ViewName, { onNavigate, canView }: UseViewRouteOptions) {
  useEffect(() => {
    const target = viewToHash(view)
    if (window.location.hash === target) return
    if (hashToView(window.location.hash)) {
      window.location.hash = target
    } else {
      window.history.replaceState(null, '', target)
    }
  }, [view])

  useEffect(() => {
    const handler = () => {
      const requested = hashToView(window.location.hash)
      const defaultView: ViewName = isHotelView(view) ? 'hotel-home' : 'home'
      const target = requested && (!canView || canView(requested)) ? requested : defaultView
      if (target !== requested) {
        window.history.replaceState(null, '', viewToHash(target))
      }
      if (target !== view) onNavigate(target)
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [view, onNavigate, canView])
}
