import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useCustomerStore } from '@/store/useCustomerStore'
import styles from './PhoneSetupModal.module.css'

/** Normaliza el teléfono: si son 9 dígitos sin prefijo, añade +34 automáticamente */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 9) return `+34${digits}`
  if (!raw.startsWith('+')) return `+${raw.trim()}`
  return raw.trim()
}

export default function PhoneSetupModal() {
  const { user, extraPhone, setExtraPhone } = useAuthStore()
  const customer = useCustomerStore((s) => s.customer)
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  // Si el usuario tiene un extraPhone guardado pero no tiene customer vinculado,
  // significa que el sync anterior falló — limpiamos extraPhone para mostrar el modal de nuevo.
  useEffect(() => {
    if (extraPhone && !customer && user && !user.isAnonymous && !user.phone) {
      useAuthStore.setState({ extraPhone: null })
    }
  }, []) // solo al montar

  // Mostrar solo para usuarios reales sin teléfono y sin customer vinculado
  const needsPhone =
    user &&
    !user.isAnonymous &&
    !user.phone &&
    !extraPhone &&
    !customer &&
    !dismissed

  if (!needsPhone) return null

  const handleSave = async () => {
    const raw = phone.trim()
    if (!raw) {
      setError('Introduce tu número de teléfono')
      return
    }

    const normalized = normalizePhone(raw)

    if (!/^\+[0-9]{9,15}$/.test(normalized)) {
      setError('Número no válido — ej. 622 583 560 o +34 622 583 560')
      return
    }

    setError(null)
    setSaving(true)
    try {
      await setExtraPhone(normalized)
      // Si setExtraPhone no lanzó, el sync fue exitoso y extraPhone ya está guardado.
      // El modal desaparece porque customer y extraPhone ya no son null.
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('400') || msg.includes('invalid') || msg.toLowerCase().includes('phone')) {
        setError('Ese número no es válido para Last App. Prueba con formato +34 622 583 560')
      } else {
        setError('No se pudo conectar. Inténtalo de nuevo.')
      }
      setSaving(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.sheet}>
        <div className={styles.iconWrap}>
          <div className={styles.iconBg}>
            <GiftIcon />
          </div>
        </div>

        <h2 className={styles.title}>Activa tus puntos</h2>
        <p className={styles.subtitle}>
          Añade tu teléfono para acumular puntos en cada pedido y recibir ofertas exclusivas.
        </p>

        <div className={`${styles.inputWrap} ${error ? styles.inputError : ''}`}>
          <PhoneIcon />
          <input
            className={styles.input}
            type="tel"
            placeholder="622 583 560"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(null) }}
            onKeyDown={handleKey}
            autoFocus
            autoComplete="tel"
          />
        </div>
        <p className={styles.formatHint}>
          {error
            ? <span className={styles.errorText}>{error}</span>
            : 'Usaremos +34 automáticamente si no incluyes prefijo'}
        </p>

        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <span className={styles.spinner} /> : 'Activar puntos de fidelidad'}
        </button>

        <button className={styles.skipBtn} onClick={() => setDismissed(true)}>
          Ahora no
        </button>
      </div>
    </div>
  )
}

function GiftIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v10H4V12" />
      <path d="M22 7H2v5h20V7z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-3)' }}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.9a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}
