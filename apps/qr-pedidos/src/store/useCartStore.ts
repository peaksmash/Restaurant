// src/store/useCartStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, CartModifier, OrderMode } from '@/types'
import { generateId } from '@/lib/utils'

interface CartStore {
  items: CartItem[]
  mode: OrderMode
  tableId: string | null
  tableName: string | null
  address: string
  addressLat: number | null
  addressLng: number | null
  notes: string

  // Actions
  setMode: (mode: OrderMode) => void
  setTable: (tableId: string, tableName: string) => void
  setAddress: (address: string, lat?: number, lng?: number) => void
  setNotes: (notes: string) => void
  addItem: (item: Omit<CartItem, 'cartItemId'>) => void
  removeItem: (cartItemId: string) => void
  changeQty: (cartItemId: string, delta: number) => void
  clearCart: () => void

  // Computed
  totalItems: () => number
  subtotal: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      mode: 'domicilio',
      tableId: null,
      tableName: null,
      address: '',
      addressLat: null,
      addressLng: null,
      notes: '',

      setMode: (mode) => set({ mode }),
      setTable: (tableId, tableName) => set({ tableId, tableName, mode: 'mesa' }),
      setAddress: (address, lat, lng) => set({
        address,
        addressLat: lat ?? null,
        addressLng: lng ?? null,
      }),
      setNotes: (notes) => set({ notes }),

      addItem: (item) => {
        const { items } = get()
        // Check if same product + same modifiers already in cart
        const sameModifiers = (a: CartModifier[], b: CartModifier[]) =>
          JSON.stringify(a.map(m => m.id).sort()) ===
          JSON.stringify(b.map(m => m.id).sort())

        const existing = items.find(
          i => i.productId === item.productId &&
               sameModifiers(i.modifiers, item.modifiers)
        )

        if (existing) {
          set({
            items: items.map(i =>
              i.cartItemId === existing.cartItemId
                ? { ...i, qty: i.qty + item.qty }
                : i
            ),
          })
        } else {
          set({
            items: [...items, { ...item, cartItemId: generateId() }],
          })
        }
      },

      removeItem: (cartItemId) =>
        set({ items: get().items.filter(i => i.cartItemId !== cartItemId) }),

      changeQty: (cartItemId, delta) => {
        const items = get().items.map(i =>
          i.cartItemId === cartItemId ? { ...i, qty: i.qty + delta } : i
        ).filter(i => i.qty > 0)
        set({ items })
      },

      clearCart: () => set({ items: [], notes: '' }),

      totalItems: () => get().items.reduce((s, i) => s + i.qty, 0),

      subtotal: () => get().items.reduce((s, i) => {
        const modExtra = i.modifiers.reduce((ms, m) => ms + m.priceImpact, 0)
        return s + (i.price + modExtra) * i.qty
      }, 0),
    }),
    {
      name: 'qrp-cart',
      partialize: (s) => ({
        items: s.items,
        mode: s.mode,
        tableId: s.tableId,
        tableName: s.tableName,
        address: s.address,
        addressLat: s.addressLat,
        addressLng: s.addressLng,
        notes: s.notes,
      }),
    }
  )
)
