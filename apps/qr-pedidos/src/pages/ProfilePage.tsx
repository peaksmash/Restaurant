import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useCustomerStore } from '@/store/useCustomerStore'
import { useSavedAddress } from '@/hooks/useSavedAddress'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { user, logout, extraPhone, setExtraPhone } = useAuthStore()
  const customer = useCustomerStore((state) => state.customer)
  const points = useCustomerStore((state) => state.customer?.points ?? null)
  const refreshPoints = useCustomerStore((state) => state.refreshPoints)
  const { savedAddress, clearAddress } = useSavedAddress()
  const navigate = useNavigate()

  // Phone editing state
  const realPhone = user?.phone  // from Firebase (phone auth)
  const currentPhone = realPhone ?? extraPhone
  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneSaving, setPhoneSaving] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!customer) return
    void refreshPoints()
  }, [customer?.id, refreshPoints])

  const initials = user?.name
    ? user.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const guestName = localStorage.getItem('qrp_guest_name')
  const guestPhone = localStorage.getItem('qrp_guest_phone')
  const displayName = user?.name || guestName || 'Invitado'
  const displayContact = user?.email || currentPhone || guestPhone || 'Sin sesión iniciada'

  const handleSavePhone = async () => {
    const raw = phoneInput.trim()
    if (!raw) {
      setPhoneError('Introduce tu número de teléfono')
      return
    }
    // Auto-prefijo +34 si son 9 dígitos sin prefijo
    const digits = raw.replace(/\D/g, '')
    const normalized = digits.length === 9 ? `+34${digits}` : (raw.startsWith('+') ? raw : `+${raw}`)
    if (!/^\+[0-9]{9,15}$/.test(normalized)) {
      setPhoneError('Número no válido — ej. 622 583 560 o +34 622 583 560')
      return
    }
    setPhoneError(null)
    setPhoneSaving(true)
    try {
      await setExtraPhone(normalized)
      setEditingPhone(false)
      setPhoneInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setPhoneError(
        msg.includes('400') ? 'Ese número no fue aceptado — prueba con +34 622 583 560' : 'No se pudo guardar el teléfono'
      )
    } finally {
      setPhoneSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {user?.photoURL ? (
          <img className={styles.avatarImg} src={user.photoURL} alt={displayName} />
        ) : (
          <div className={styles.avatarInitials}>{initials}</div>
        )}
        <div className={styles.userCopy}>
          <div className={styles.eyebrow}>Tu cuenta</div>
          <div className={styles.userName}>{displayName}</div>
          <div className={styles.userEmail}>{displayContact}</div>
        </div>
        {!user && (
          <button className={styles.loginBtn} onClick={() => navigate('/bienvenida')}>
            Iniciar sesión
          </button>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Mi cuenta</div>
        <button className={styles.row} onClick={() => navigate('/pedidos')}>
          <div className={styles.rowIcon}><OrdersIcon /></div>
          <span className={styles.rowLabel}>Mis pedidos</span>
          <ChevronRight />
        </button>
        <div className={styles.row}>
          <div className={styles.rowIcon}><StarIcon /></div>
          <span className={styles.rowLabel}>Puntos de fidelidad</span>
          <span className={styles.rowValue}>{points == null ? 'Sin vincular' : `${points} pts`}</span>
        </div>

        {/* Teléfono — obligatorio para vincular puntos */}
        {user && !user.isAnonymous && (
          <div className={styles.phoneBlock}>
            <div className={styles.row} style={{ borderBottom: editingPhone ? 'none' : undefined }}>
              <div className={styles.rowIcon}><PhoneIcon /></div>
              <div style={{ flex: 1 }}>
                <span className={styles.rowLabel}>Teléfono</span>
                {currentPhone && !editingPhone && (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{currentPhone}</div>
                )}
              </div>
              {realPhone ? (
                <span className={styles.rowValue}>{realPhone}</span>
              ) : editingPhone ? (
                <button
                  style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}
                  onClick={() => { setEditingPhone(false); setPhoneError(null) }}
                >
                  Cancelar
                </button>
              ) : (
                <button
                  style={{ fontSize: 12, color: 'var(--accent-dark)', fontWeight: 800 }}
                  onClick={() => { setEditingPhone(true); setPhoneInput(extraPhone ?? '') }}
                >
                  {currentPhone ? 'Cambiar' : 'Añadir'}
                </button>
              )}
            </div>
            {editingPhone && (
              <div className={styles.phoneEdit}>
                <input
                  className={styles.phoneInput}
                  type="tel"
                  placeholder="+34 612 345 678"
                  value={phoneInput}
                  onChange={(e) => { setPhoneInput(e.target.value); setPhoneError(null) }}
                  autoFocus
                />
                {phoneError && <p className={styles.phoneError}>{phoneError}</p>}
                <button
                  className={styles.phoneSaveBtn}
                  onClick={handleSavePhone}
                  disabled={phoneSaving}
                >
                  {phoneSaving ? 'Guardando...' : 'Guardar teléfono'}
                </button>
              </div>
            )}
            {!currentPhone && !editingPhone && (
              <p className={styles.phoneHint}>
                Añade tu teléfono para vincular tus puntos de fidelidad
              </p>
            )}
          </div>
        )}

        <div className={styles.row}>
          <div className={styles.rowIcon}><LocationIcon /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className={styles.rowLabel}>Dirección guardada</span>
            {savedAddress && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {savedAddress.address}
              </div>
            )}
          </div>
          {savedAddress ? (
            <button
              style={{ fontSize: 12, color: 'var(--red)', fontWeight: 800, flexShrink: 0 }}
              onClick={clearAddress}
            >
              Eliminar
            </button>
          ) : (
            <span className={styles.rowValue}>Aún no guardada</span>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Ayuda</div>
        <div className={styles.row}>
          <div className={styles.rowIcon}><ChatIcon /></div>
          <span className={styles.rowLabel}>Contactar con el restaurante</span>
          <ChevronRight />
        </div>
        <div className={styles.row}>
          <div className={styles.rowIcon}><DocumentIcon /></div>
          <span className={styles.rowLabel}>Términos y privacidad</span>
          <ChevronRight />
        </div>
      </div>

      {user && (
        <div className={styles.section}>
          <button className={styles.logoutBtn} onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 2.7 5.47 6.03.88-4.36 4.25 1.03 6-5.4-2.84-5.4 2.84 1.03-6L3.27 9.35l6.03-.88L12 3Z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.9a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  )
}
