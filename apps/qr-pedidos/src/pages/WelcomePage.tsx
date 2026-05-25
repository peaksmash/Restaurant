// src/pages/WelcomePage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isFirebaseAuthConfigured } from '@/lib/firebase'
import { useAuthStore } from '@/store/useAuthStore'
import styles from './WelcomePage.module.css'

type Step = 'home' | 'phone' | 'otp' | 'guest'

export default function WelcomePage() {
  const navigate = useNavigate()
  const { user, loginGoogle, loginPhone, verifyOtp, loginGuest, loading, error, clearError } = useAuthStore()
  const [step, setStep] = useState<Step>('home')
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState('+34')
  const [otp, setOtp] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('+34')

  useEffect(() => {
    if (user) navigate('/menu', { replace: true })
  }, [user, navigate])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    clearError()
    try { await fn() } finally { setBusy(false) }
  }

  const disabled = busy || loading

  return (
    <div className={styles.page}>
      <div className={styles.bgGlow} />

      <div className={styles.card}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandBadge}>🍽️</div>
          <div className={styles.brandName}>Smashme</div>
          <div className={styles.brandSub}>Pide en mesa, para recoger o a domicilio</div>
        </div>

        {/* Step: Home */}
        {step === 'home' && (
          <div className={styles.options}>
            <button
              className={`${styles.optionBtn} ${styles.googleBtn}`}
              onClick={() => run(loginGoogle)}
              disabled={disabled || !isFirebaseAuthConfigured}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            <button
              className={styles.optionBtn}
              onClick={() => setStep('phone')}
              disabled={disabled || !isFirebaseAuthConfigured}
            >
              <span>📱</span>
              Continuar con teléfono
            </button>

            <button
              className={`${styles.optionBtn} ${styles.guestBtn}`}
              onClick={() => setStep('guest')}
              disabled={disabled}
            >
              <span>👤</span>
              Continuar como invitado
            </button>
          </div>
        )}

        {/* Step: Phone */}
        {step === 'phone' && (
          <div className={styles.form}>
            <div className={styles.formTitle}>Tu número de teléfono</div>
            <input
              className={styles.input}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 612 345 678"
              autoFocus
            />
            <div id="recaptcha-container" />
            <button
              className={styles.submitBtn}
              onClick={() => run(() => loginPhone(phone, 'recaptcha-container')
                .then(() => setStep('otp'))
              )}
              disabled={disabled || phone.length < 9}
            >
              {busy ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}/> : 'Enviar código'}
            </button>
            <button className={styles.backLink} onClick={() => setStep('home')}>← Volver</button>
          </div>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <div className={styles.form}>
            <div className={styles.formTitle}>Introduce el código</div>
            <div className={styles.formSub}>Te hemos enviado un SMS a {phone}</div>
            <input
              className={`${styles.input} ${styles.inputCode}`}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
            />
            <button
              className={styles.submitBtn}
              onClick={() => run(() => verifyOtp(otp))}
              disabled={disabled || otp.length < 6}
            >
              {busy ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}/> : 'Verificar'}
            </button>
            <button className={styles.backLink} onClick={() => setStep('phone')}>← Volver</button>
          </div>
        )}

        {/* Step: Guest */}
        {step === 'guest' && (
          <div className={styles.form}>
            <div className={styles.formTitle}>¿Cómo te llamamos?</div>
            <input
              className={styles.input}
              type="text"
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              placeholder="Tu nombre"
              autoFocus
            />
            <input
              className={styles.input}
              type="tel"
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              placeholder="Teléfono (opcional)"
            />
            <button
              className={styles.submitBtn}
              onClick={() => run(() => loginGuest(guestName, guestPhone))}
              disabled={disabled || !guestName.trim()}
            >
              {busy ? <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }}/> : 'Entrar'}
            </button>
            <button className={styles.backLink} onClick={() => setStep('home')}>← Volver</button>
          </div>
        )}

        {!isFirebaseAuthConfigured && (
          <div className={styles.error}>
            Firebase Auth no está configurado todavía. Puedes seguir como invitado o rellenar
            `VITE_FIREBASE_*` en `.env.local`.
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </div>
  )
}
