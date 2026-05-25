import { create } from 'zustand'
import { getCatalog, getConfig } from '@/lib/api'
import type { Catalog, RestaurantConfig } from '@/types'

interface RestaurantStore {
  config: RestaurantConfig | null
  catalog: Catalog | null
  loading: boolean
  loaded: boolean
  error: string | null
  load: () => Promise<void>
}

export const useRestaurantStore = create<RestaurantStore>((set, get) => ({
  config: null,
  catalog: null,
  loading: false,
  loaded: false,
  error: null,

  load: async () => {
    if (get().loading || get().loaded) {
      return
    }

    set({ loading: true, error: null })

    try {
      const [config, catalog] = await Promise.all([getConfig(), getCatalog()])
      set({
        config,
        catalog,
        loading: false,
        loaded: true,
        error: null,
      })
    } catch (error) {
      set({
        loading: false,
        loaded: false,
        error: error instanceof Error ? error.message : 'No se pudo cargar el restaurante',
      })
    }
  },
}))
