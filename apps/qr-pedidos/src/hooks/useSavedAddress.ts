import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'

export interface SavedAddress {
  address: string
  lat: number
  lng: number
  floor?: string
  door?: string
  riderNotes?: string
}

function storageKey(uid: string | null | undefined) {
  return `qrp_saved_address_${uid ?? 'guest'}`
}

export function useSavedAddress() {
  const user = useAuthStore((s) => s.user)
  const key = storageKey(user?.uid)

  const [savedAddress, setSavedAddressState] = useState<SavedAddress | null>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as SavedAddress) : null
    } catch {
      return null
    }
  })

  // Re-leer cuando cambia el usuario (cambio de cuenta)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      setSavedAddressState(raw ? (JSON.parse(raw) as SavedAddress) : null)
    } catch {
      setSavedAddressState(null)
    }
  }, [key])

  const saveAddress = useCallback((addr: SavedAddress) => {
    localStorage.setItem(key, JSON.stringify(addr))
    setSavedAddressState(addr)
  }, [key])

  const clearAddress = useCallback(() => {
    localStorage.removeItem(key)
    setSavedAddressState(null)
  }, [key])

  return { savedAddress, saveAddress, clearAddress }
}
