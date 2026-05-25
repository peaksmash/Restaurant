import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addCustomerPoints, createOrGetCustomer, getCustomerPoints } from '@/lib/api'

interface LastCustomer {
  id: string
  name: string
  points: number
}

interface CustomerStore {
  customer: LastCustomer | null
  loading: boolean
  sync: (p: { name: string; phoneNumber: string; email?: string }) => Promise<void>
  syncAfterOrder: (totalCents: number) => Promise<void>
  refreshPoints: () => Promise<void>
  clear: () => void
}

export const useCustomerStore = create<CustomerStore>()(
  persist(
    (set, get) => ({
      customer: null,
      loading: false,

      sync: async ({ name, phoneNumber, email }) => {
        set({ loading: true })
        try {
          const customer = await createOrGetCustomer({ name, phoneNumber, email })
          set({
            customer: {
              id: customer.id,
              name: customer.name,
              points: customer.points ?? 0,
            },
            loading: false,
          })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      syncAfterOrder: async (totalCents) => {
        const currentCustomer = get().customer
        if (!currentCustomer) {
          return
        }

        const points = Math.floor(totalCents / 100)
        if (points > 0) {
          await addCustomerPoints(currentCustomer.id, points, 'Pedido online')
        }

        await get().refreshPoints()
      },

      refreshPoints: async () => {
        const currentCustomer = get().customer
        if (!currentCustomer) {
          return
        }

        set({ loading: true })
        try {
          const result = await getCustomerPoints(currentCustomer.id)
          set({
            customer: {
              ...currentCustomer,
              points: result.points,
            },
            loading: false,
          })
        } catch (error) {
          set({ loading: false })
          throw error
        }
      },

      clear: () => set({ customer: null }),
    }),
    {
      name: 'qrp-customer',
      partialize: (state) => ({ customer: state.customer }),
    },
  ),
)
