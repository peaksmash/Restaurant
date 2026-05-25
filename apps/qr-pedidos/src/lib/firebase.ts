import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

function hasRequiredFirebaseConfig() {
  return [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.appId,
  ].every((value) => typeof value === 'string' && value.trim().length > 0)
}

export const isFirebaseAuthConfigured = hasRequiredFirebaseConfig()
export const isFirebaseMessagingConfigured =
  hasRequiredFirebaseConfig() &&
  typeof firebaseConfig.messagingSenderId === 'string' &&
  firebaseConfig.messagingSenderId.trim().length > 0 &&
  typeof import.meta.env.VITE_FIREBASE_VAPID_KEY === 'string' &&
  import.meta.env.VITE_FIREBASE_VAPID_KEY.trim().length > 0

let app: FirebaseApp | null = null
let auth: Auth | null = null
let messaging: Messaging | null = null
let pushTokenPromise: Promise<string | null> | null = null

if (isFirebaseAuthConfigured) {
  app = getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]
  auth = getAuth(app)
} else {
  console.warn(
    '[qr-pedidos] Firebase Auth desactivado: faltan variables VITE_FIREBASE_* en .env.local',
  )
}

async function getMessagingInstance() {
  if (!app || !isFirebaseMessagingConfigured) {
    return null
  }

  const supported = await isSupported().catch(() => false)
  if (!supported) {
    return null
  }

  if (!messaging) {
    messaging = getMessaging(app)
  }

  return messaging
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export async function requestPushNotificationsToken(retries = 1) {
  if (pushTokenPromise) {
    return pushTokenPromise
  }

  pushTokenPromise = (async () => {
    if (
      !isFirebaseMessagingConfigured ||
      typeof window === 'undefined' ||
      typeof Notification === 'undefined' ||
      !('serviceWorker' in navigator)
    ) {
      return null
    }

    try {
      let permission = Notification.permission

      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }

      if (permission !== 'granted') {
        return null
      }

      const instance = await getMessagingInstance()
      if (!instance) {
        return null
      }

      const registration = await navigator.serviceWorker.ready.catch(() => null)
      if (!registration) {
        return null
      }

      for (let attempt = 0; attempt < retries; attempt += 1) {
        const token = await getToken(instance, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        }).catch(() => null)

        if (token) {
          localStorage.setItem('qrp_push_token', token)
          return token
        }

        if (attempt < retries - 1) {
          await sleep(350)
        }
      }

      return null
    } catch (error) {
      console.warn('[qr-pedidos] No se pudo obtener el token FCM', error)
      return null
    } finally {
      pushTokenPromise = null
    }
  })()

  return pushTokenPromise
}

export { app, auth }
