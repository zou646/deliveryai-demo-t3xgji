import i18next from 'i18next'
import type { AppAction, AppState } from '@/types'
import { orderReducer } from '@/state/orderReducer'
import { hotelReducer } from '@/state/hotelReducer'

/**
 * Combined root reducer. Hotpot state lives at top-level, hotel state at state.hotel.
 * HOTEL_RESET keeps hotpot state intact; RESET keeps hotel state intact (per Spec NFR-H-008).
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_MODULE': {
      const target = action.module
      if (target === state.appModule) return state
      if (target === 'hotel') {
        return {
          ...state,
          appModule: 'hotel',
          view: 'hotel-home',
          lastMessage: state.hotel.lastMessage,
        }
      }
      return {
        ...state,
        appModule: 'hotpot',
        view: state.table ? 'menu' : 'home',
        lastMessage: i18next.t('message.welcome'),
      }
    }
    case 'HOTEL_RESET': {
      const nextHotel = hotelReducer(state.hotel, action)
      return { ...state, hotel: nextHotel, lastMessage: i18next.t('hotel.message.reset') }
    }
    default:
      break
  }

  if (typeof action.type === 'string' && action.type.startsWith('HOTEL_')) {
    const nextHotel = hotelReducer(state.hotel, action)
    return { ...state, hotel: nextHotel, lastMessage: nextHotel.lastMessage }
  }

  // Hotpot actions
  if (action.type === 'RESET') {
    const next = orderReducer(state, action)
    return { ...next, appModule: state.appModule, hotel: state.hotel }
  }

  const next = orderReducer(state, action)
  return { ...next, appModule: state.appModule, hotel: state.hotel }
}

export { hotelReducer, createInitialHotelState } from '@/state/hotelReducer'
export { initialState as hotpotInitialState } from '@/state/orderReducer'
