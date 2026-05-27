import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { auth, isFirebaseAuthConfigured, requestPushNotificationsToken } from '@/lib/firebase'
import { useCustomerStore } from '@/store/useCustomerStore'
import type { AuthUser } from '@/types'

interface AuthStore {
  user: AuthUser | null
  loading: boolean
  error: string | null
  _confirmation: ConfirmationResult | null
  /** Teléfono introducido manualmente por usuarios Google (sin phone real) */
  extraPhone: string | null

  init: () => () => void
  loginGoogle: () => Promise<void>
  loginPhone: (phone: string, containerId: string) => Promise<void>
  verifyOtp: (code: string) => Promise<void>
  loginGuest: (name: string, phone: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  /** Guarda el teléfono del usuario y re-sincroniza el cliente */
  setExtraPhone: (phone: string) => Promise<void>
}

function mapUser(user: User): AuthUser {
  return {
    uid: user.uid,
    name: user.displayName ?? user.phoneNumber ?? 'Cliente',
    email: user.email,
    phone: user.phoneNumber,
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  }
}

function ensureFirebaseAuth() {
  if (!auth || !isFirebaseAuthConfigured) {
    throw new Error('Firebase Auth no está configurado todavía. Rellena VITE_FIREBASE_* en apps/qr-pedidos/.env.local.')
  }

  return auth
}

function buildSyncPhone(firebasePhone: string | null | undefined, extraPhone: string | null): string | undefined {
  return firebasePhone ?? extraPhone ?? undefined
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      error: null,
      _confirmation: null,
      extraPhone: null,

      init: () => {
        if (!auth || !isFirebaseAuthConfigured) {
          set({ loading: false, user: null })
          return () => {}
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          set({ user: user ? mapUser(user) : null, loading: false })

          // Sincronizar cliente si hay sesión y aún no está vinculado
          if (user && !useCustomerStore.getState().customer) {
            const phone = buildSyncPhone(user.phoneNumber, get().extraPhone)
            useCustomerStore.getState().sync({
              name: user.displayName ?? user.email ?? 'Cliente',
              ...(phone ? { phoneNumber: phone } : {}),
              email: user.email ?? undefined,
              externalId: user.uid,
            }).catch(() => {})
          }
        })

        return unsubscribe
      },

      loginGoogle: async () => {
        set({ error: null })
        try {
          const authInstance = ensureFirebaseAuth()
          const provider = new GoogleAuthProvider()
          const result = await signInWithPopup(authInstance, provider)
          const { uid, displayName, email, phoneNumber } = result.user
          if (displayName || email) {
            const phone = buildSyncPhone(phoneNumber, get().extraPhone)
            await useCustomerStore.getState().sync({
              name: displayName ?? email ?? 'Cliente',
              ...(phone ? { phoneNumber: phone } : {}),
              email: email ?? undefined,
              externalId: uid,
            }).catch(() => {/* puntos no críticos */})
          }
          await requestPushNotificationsToken(3)
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Error al iniciar sesion con Google' })
          throw error
        }
      },

      loginPhone: async (phone, containerId) => {
        set({ error: null })
        try {
          const authInstance = ensureFirebaseAuth()
          const verifier = new RecaptchaVerifier(authInstance, containerId, { size: 'invisible' })
          const confirmation = await signInWithPhoneNumber(authInstance, phone, verifier)
          set({ _confirmation: confirmation })
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Error al iniciar sesion por telefono' })
          throw error
        }
      },

      verifyOtp: async (code) => {
        const { _confirmation } = get()
        if (!_confirmation) {
          throw new Error('No hay verificación pendiente')
        }

        try {
          await _confirmation.confirm(code)
          set({ _confirmation: null })
        } catch (error) {
          set({ error: 'Codigo incorrecto' })
          throw error
        }
      },

      loginGuest: async (name, phone) => {
        set({ error: null })
        try {
          if (auth && isFirebaseAuthConfigured) {
            await signInAnonymously(auth)
          }
          useCustomerStore.getState().clear()
          localStorage.setItem('qrp_guest_name', name)
          localStorage.setItem('qrp_guest_phone', phone)
          set((state) => ({
            user: state.user ?? {
              uid: `guest_${crypto.randomUUID()}`,
              name,
              email: null,
              phone: phone || null,
              photoURL: null,
              isAnonymous: true,
            },
          }))
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Error al continuar como invitado' })
          throw error
        }
      },

      logout: async () => {
        if (auth && isFirebaseAuthConfigured) {
          await signOut(auth)
        }
        useCustomerStore.getState().clear()
        localStorage.removeItem('qrp_guest_name')
        localStorage.removeItem('qrp_guest_phone')
        set({ user: null, _confirmation: null, extraPhone: null })
      },

      clearError: () => set({ error: null }),

      setExtraPhone: async (phone) => {
        const { user } = get()
        if (!user || user.isAnonymous) {
          set({ extraPhone: phone })
          return
        }
        // Sync primero — solo guardamos el teléfono si Last App lo acepta
        await useCustomerStore.getState().sync({
          name: user.name,
          phoneNumber: phone,
          email: user.email ?? undefined,
          externalId: user.uid,
        })
        // Llegamos aquí solo si sync no lanzó excepción
        set({ extraPhone: phone })
      },
    }),
    {
      name: 'qrp-auth',
      partialize: (state) => ({ user: state.user, extraPhone: state.extraPhone }),
    },
  ),
)
