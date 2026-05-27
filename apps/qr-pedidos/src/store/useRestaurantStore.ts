import { create } from 'zustand'
import { getCatalog, getConfig, getBootstrap } from '@/lib/api'
import type { BootstrapResponse } from '@/lib/api'
import type { Catalog, RestaurantConfig, LocationInfo } from '@/types'

export type BootstrapOrderMode = 'delivery' | 'pickup' | 'table'

interface RestaurantStore {
  config: RestaurantConfig | null
  catalog: Catalog | null
  locationInfo: LocationInfo | null
  orderMode: BootstrapOrderMode
  loading: boolean
  loaded: boolean
  error: string | null
  bootstrapSource: 'qr-server' | 'local-server' | null
  setOrderMode: (mode: BootstrapOrderMode) => void
  load: () => Promise<void>
}

// Map bootstrap response → existing Catalog type
function bootstrapToCatalog(b: BootstrapResponse): Catalog {
  return {
    fromCache: false,
    categories: b.catalog.categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      enabled: cat.enabled,
      products: cat.products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        enabled: p.enabled,
        imageUrl: p.imageUrl ?? undefined,
        type: p.type,
        modifierGroups: p.modifierGroups,
      })),
    })),
    modifierGroups: b.catalog.modifierGroups.map((mg) => ({
      id: mg.id,
      name: mg.name,
      enabled: true,
      min: mg.min,
      max: mg.max,
      allowRepeat: mg.allowRepeat,
      modifiers: mg.modifiers.map((m) => ({
        id: m.id,
        name: m.name,
        enabled: true,
        priceImpact: m.priceImpact,
        organizationModifierId: m.organizationModifierId,
      })),
    })),
  }
}

// Map bootstrap response → RestaurantConfig
function bootstrapToConfig(b: BootstrapResponse): RestaurantConfig {
  return {
    restaurantName: b.tenant.displayName,
    logoUrl: b.tenant.branding.logoUrl,
    paymentsSimulated: false,
  }
}

// Map bootstrap response → LocationInfo
function bootstrapToLocationInfo(b: BootstrapResponse): LocationInfo {
  return {
    name: b.location.displayName,
    address: '',
    lat: 0,
    lng: 0,
    preparationMinutes: b.lastLocation.preparationMinutes,
    deliveryAreas: b.lastLocation.deliveryAreas.map((area) => ({
      id: area.id,
      name: area.name,
      type: area.type,
      geometry: area.geometry ?? null,
      fee: area.deliveryFee,
      deliveryFee: area.deliveryFee,
      minimumBasket: area.minimumBasket,
      estimatedDeliveryMinutes: area.estimatedDeliveryMinutes,
      enabled: area.enabled,
    })),
    paymentMethods: [],
    horarios: b.lastLocation.workingTimesKeys,
  }
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  config: null,
  catalog: null,
  locationInfo: null,
  orderMode: 'delivery',
  loading: false,
  loaded: false,
  error: null,
  bootstrapSource: null,

  setOrderMode: (mode: BootstrapOrderMode) => {
    if (get().orderMode === mode) return
    set({ orderMode: mode, loaded: false, catalog: null, locationInfo: null, error: null })
  },

  load: async () => {
    if (get().loading || get().loaded) {
      return
    }

    set({ loading: true, error: null })

    // Try qr-server bootstrap first
    try {
      const bootstrap = await getBootstrap(get().orderMode)
      set({
        config: bootstrapToConfig(bootstrap),
        catalog: bootstrapToCatalog(bootstrap),
        locationInfo: bootstrapToLocationInfo(bootstrap),
        loading: false,
        loaded: true,
        error: null,
        bootstrapSource: 'qr-server',
      })
      return
    } catch (bootstrapError) {
      console.warn('[useRestaurantStore] bootstrap failed, falling back to local-server:', bootstrapError)
    }

    // Fallback: existing local-server flow
    try {
      const [config, catalog] = await Promise.all([getConfig(), getCatalog()])
      set({
        config,
        catalog,
        locationInfo: null,
        loading: false,
        loaded: true,
        error: null,
        bootstrapSource: 'local-server',
      })
    } catch (error) {
      set({
        loading: false,
        loaded: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el restaurante',
        bootstrapSource: null,
      })
    }
  },
}))
