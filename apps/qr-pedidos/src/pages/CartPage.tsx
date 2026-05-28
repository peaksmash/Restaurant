import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DeliveryAddressSection from '@/components/checkout/DeliveryAddressSection'
import { CrosssellChip } from '@/components/suggestions/CrosssellChip'
import { createOrder, getLocation } from '@/lib/api'
import { findMatchingDeliveryArea, getDeliveryAreaFee, getEnabledDeliveryAreas } from '@/lib/delivery'
import { isFirebaseAuthConfigured } from '@/lib/firebase'
import { formatEuro } from '@/lib/utils'
import { useAuthStore } from '@/store/useAuthStore'
import { useCartStore } from '@/store/useCartStore'
import { useCustomerStore } from '@/store/useCustomerStore'
import { useRestaurantStore } from '@/store/useRestaurantStore'
import { useToastStore } from '@/store/useToastStore'
import { useSavedAddress } from '@/hooks/useSavedAddress'
import type { LocationInfo, OrderMode, PaymentMethod, StoredOrder } from '@/types'
import type { CrosssellSuggestion } from '@/suggestions'
import styles from './CartPage.module.css'

type CheckoutPaymentMode = 'online' | 'cashier'

interface Props {
  suggestionEngine: {
    activeCrosssells: CrosssellSuggestion[]
    acceptCrosssell: (ruleId: string, productId: string) => void
    dismissCrosssell: (ruleId: string) => void
  }
}

interface OrderCustomerPayload {
  name: string
  phoneNumber: string | null
  email: string | null
  externalId: string | null
  surname: null
}

export default function CartPage({ suggestionEngine }: Props) {
  const loyaltyDismissedKey = 'qrp_cart_loyalty_prompt_dismissed'
  const navigate = useNavigate()
  const {
    items,
    mode,
    tableId,
    tableName,
    address,
    addressLat,
    addressLng,
    setAddress,
    notes,
    setNotes,
    changeQty,
    clearCart,
    subtotal,
  } = useCartStore()
  const { user, loginGoogle } = useAuthStore()
  const syncCustomer = useCustomerStore((state) => state.sync)
  const syncAfterOrder = useCustomerStore((state) => state.syncAfterOrder)
  const showToast = useToastStore((state) => state.show)
  const { locationInfo, orderMode: bootstrapOrderMode } = useRestaurantStore()
  const [sending, setSending] = useState(false)
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null)
  const [needCutlery, setNeedCutlery] = useState(false)
  const [location, setLocation] = useState<LocationInfo | null>(null)
  const [locationLoading, setLocationLoading] = useState(!locationInfo)
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<CheckoutPaymentMode>('online')
  const [loginBusy, setLoginBusy] = useState(false)
  const [showLoyaltyPrompt, setShowLoyaltyPrompt] = useState(false)
  const { savedAddress, saveAddress, clearAddress } = useSavedAddress()

  // Sincronizar dirección guardada con el cartStore al montar
  useEffect(() => {
    if (savedAddress && mode === 'domicilio') {
      setAddress(savedAddress.address, savedAddress.lat || undefined, savedAddress.lng || undefined)
    }
  }, [savedAddress?.address])

  useEffect(() => {
    // Skip API call if bootstrap already provides locationInfo
    if (locationInfo) return

    let cancelled = false

    getLocation()
      .then((data) => {
        if (!cancelled) {
          setLocation(data)
        }
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) {
          setLocation(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLocationLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [locationInfo])

  // locationInfo from bootstrap takes priority over local-server API result
  const effectiveLocation: LocationInfo | null = locationInfo ?? location

  const sub = subtotal()
  const isEmpty = items.length === 0
  const enabledDeliveryAreas = useMemo(
    () => getEnabledDeliveryAreas(effectiveLocation?.deliveryAreas),
    [effectiveLocation?.deliveryAreas],
  )
  const matchedDeliveryArea = useMemo(() => {
    if (mode !== 'domicilio') return null
    // Only real polygon/circle match — no provisional fallback once coords are present
    return findMatchingDeliveryArea(enabledDeliveryAreas, addressLat, addressLng)
  }, [addressLat, addressLng, enabledDeliveryAreas, mode])
  const noDeliveryAvailable = mode === 'domicilio' && enabledDeliveryAreas.length === 0
  const missingCoords = mode === 'domicilio' && address.trim().length > 0 &&
    (addressLat == null || addressLng == null || (addressLat === 0 && addressLng === 0))
  const hasCoords = addressLat != null && addressLng != null && !(addressLat === 0 && addressLng === 0)
  const outOfZone = mode === 'domicilio' && hasCoords && enabledDeliveryAreas.length > 0 && !matchedDeliveryArea
  const deliveryFee = mode === 'domicilio' ? getDeliveryAreaFee(matchedDeliveryArea) : 0
  const total = sub + deliveryFee
  const minimumBasket = matchedDeliveryArea?.minimumBasket ?? 0
  const belowMinimum = mode === 'domicilio' && minimumBasket > 0 && sub < minimumBasket
  const isMesaMode = mode === 'mesa'

  const paymentOptions = useMemo(() => {
    if (!isMesaMode) {
      return [{
        mode: 'online' as const,
        label: 'Tarjeta online',
        description: 'Pago seguro al confirmar el pedido',
        icon: <CardIcon />,
      }]
    }
    return buildPaymentOptions(effectiveLocation?.paymentMethods, mode)
  }, [isMesaMode, effectiveLocation?.paymentMethods, mode])

  useEffect(() => {
    if (!isMesaMode) {
      setSelectedPaymentMode('online')
      return
    }
    if (paymentOptions.some((option) => option.mode === selectedPaymentMode)) {
      return
    }
    setSelectedPaymentMode(paymentOptions[0]?.mode ?? 'online')
  }, [isMesaMode, paymentOptions, selectedPaymentMode])

  useEffect(() => {
    if (
      !isFirebaseAuthConfigured ||
      isEmpty ||
      (user && !user.isAnonymous) ||
      sessionStorage.getItem(loyaltyDismissedKey) === '1'
    ) {
      setShowLoyaltyPrompt(false)
      return
    }

    setShowLoyaltyPrompt(true)
  }, [isEmpty, user])

  const deliveryStatusMessage = useMemo(() => {
    if (mode !== 'domicilio') {
      return null
    }

    if (locationLoading) {
      return 'Calculando zonas de reparto...'
    }

    if (enabledDeliveryAreas.length === 0) {
      return 'Domicilio no disponible ahora.'
    }

    if (!address.trim()) {
      return 'Introduce tu direccion para calcular la tarifa real y validar si llegamos.'
    }

    if (addressLat == null || addressLng == null) {
      return enabledDeliveryAreas.length === 1
        ? 'Usaremos la tarifa de la unica zona activa. Con Google Maps podremos validar el punto exacto.'
        : 'Selecciona una sugerencia de Google Maps para validar la direccion contra las zonas reales.'
    }

    if (!matchedDeliveryArea) {
      return 'Esa direccion queda fuera de nuestras zonas de reparto activas.'
    }

    const estimate = matchedDeliveryArea.estimatedDeliveryMinutes || effectiveLocation?.preparationMinutes || 20
    const areaName = matchedDeliveryArea.name ? ` · ${matchedDeliveryArea.name}` : ''
    return `Entrega estimada ${estimate} min${areaName}`
  }, [
    address,
    addressLat,
    addressLng,
    enabledDeliveryAreas.length,
    location?.preparationMinutes,
    locationLoading,
    matchedDeliveryArea,
    mode,
  ])

  const handleConfirm = async () => {
    if (isEmpty) {
      return
    }

    if (mode === 'domicilio' && !address.trim()) {
      showToast('⚠️ Introduce tu direccion de entrega')
      return
    }

    if (mode === 'domicilio' && enabledDeliveryAreas.length > 0 && !matchedDeliveryArea) {
      showToast('⚠️ Esa direccion no entra en una zona de reparto activa')
      return
    }

    if (belowMinimum) {
      showToast(`⚠️ El pedido minimo para esa zona es ${formatEuro(minimumBasket)}`)
      return
    }

    // Online: delegate to CheckoutPage (Stripe Elements flow)
    if (selectedPaymentMode === 'online') {
      navigate('/checkout')
      return
    }

    setSending(true)

    try {
      const customer = buildOrderCustomer(user)
      const orderItems = items.map((item) => {
        const modifiersTotal = item.modifiers.reduce((sum, modifier) => sum + modifier.priceImpact, 0)
        const unitPrice = item.price + modifiersTotal

        return {
          id: item.cartItemId,
          productId: item.productId,
          productName: item.name,
          quantity: item.qty,
          unitPrice,
          totalPrice: unitPrice * item.qty,
          notes: item.notes ?? null,
          modifiers: item.modifiers.map((modifier) => ({
            modifierId: modifier.id,
            modifierName: modifier.name,
            quantity: 1,
            unitPrice: modifier.priceImpact,
            totalPrice: modifier.priceImpact,
          })),
        }
      })

      const deliveryDetails = mode === 'domicilio' && savedAddress
        ? [
            savedAddress.floor ? `Piso: ${savedAddress.floor}` : '',
            savedAddress.door ? `Puerta: ${savedAddress.door}` : '',
          ].filter(Boolean).join(', ')
        : ''

      const orderNotes = [
        notes.trim(),
        mode === 'domicilio' ? `Entrega: ${address}` : '',
        deliveryDetails,
        mode === 'domicilio' && matchedDeliveryArea?.name ? `Zona: ${matchedDeliveryArea.name}` : '',
        mode === 'domicilio' && savedAddress?.riderNotes ? `Repartidor: ${savedAddress.riderNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      const result = await createOrder({
        externalId: `qrp_${crypto.randomUUID()}`,
        channel: 'qr_order',
        paymentMode: selectedPaymentMode,
        customer,
        notes: orderNotes || null,
        items: orderItems,
        subtotal: sub,
        discountTotal: 0,
        total,
        currency: 'EUR',
        tableId: mode === 'mesa' ? tableId ?? undefined : undefined,
        tableNameSnapshot: mode === 'mesa' ? tableName ?? undefined : undefined,
        suggestedPreparationMinutes: location?.preparationMinutes ?? null,
      })

      let customerId: string | null = null
      if (customer.name && customer.phoneNumber) {
        await syncCustomer({
          name: customer.name,
          phoneNumber: customer.phoneNumber,
          email: customer.email ?? undefined,
        })
        customerId = useCustomerStore.getState().customer?.id ?? null
      }

      const order: StoredOrder = {
        id: result.orderSessionId,
        code: result.code || result.operationalCode || `#${result.orderSessionId.slice(-4).toUpperCase()}`,
        operationalCode: result.operationalCode,
        mode,
        items: [...items],
        total,
        address: mode === 'domicilio' ? address : undefined,
        tableName: mode === 'mesa' ? tableName ?? undefined : undefined,
        customerId,
        paymentMode: selectedPaymentMode,
        paymentStatus: result.paymentStatus as StoredOrder['paymentStatus'],
        status: 'CREATED',
        createdAt: new Date().toISOString(),
        lastSyncStatus: result.lastSyncStatus,
        pin4: result.pin4 ?? null,
        qrToken: result.qrToken ?? null,
        expiresAt: result.expiresAt ?? null,
      }

      // cashier: no syncAfterOrder — puntos solo tras pago confirmado
      clearCart()
      navigate(`/pedidos/${result.orderSessionId}`, { state: { order } })
    } catch (error) {
      console.error(error)
      showToast('❌ Error al enviar el pedido. Intentalo de nuevo')
    } finally {
      setSending(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoginBusy(true)
    try {
      await loginGoogle()
      setShowLoyaltyPrompt(false)
      showToast('Cuenta conectada. Activamos puntos, regalos y notificaciones del pedido.')
    } catch (error) {
      console.error(error)
      showToast('No hemos podido iniciar sesion con Google')
    } finally {
      setLoginBusy(false)
    }
  }

  const handleSkipLoyalty = () => {
    sessionStorage.setItem(loyaltyDismissedKey, '1')
    setShowLoyaltyPrompt(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/menu')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className={styles.title}>Tu cesta</h1>
        {!isEmpty && (
          <span className={styles.itemCount}>
            {items.reduce((sum, item) => sum + item.qty, 0)} productos
          </span>
        )}
      </div>

      <div className={styles.scroll}>
        {mode === 'domicilio' && (
          <div className={styles.addrSection}>
            <DeliveryAddressSection
              savedAddress={savedAddress}
              onSave={(addr) => {
                saveAddress(addr)
                setAddress(addr.address, addr.lat || undefined, addr.lng || undefined)
              }}
              onClear={() => {
                clearAddress()
                setAddress('', undefined, undefined)
              }}
              restaurantLat={effectiveLocation?.lat}
              restaurantLng={effectiveLocation?.lng}
              deliveryAreas={enabledDeliveryAreas}
            />
            {deliveryStatusMessage && (
              <div className={`${styles.deliveryHint} ${matchedDeliveryArea ? styles.deliveryHintOk : styles.deliveryHintWarn}`}>
                {deliveryStatusMessage}
              </div>
            )}
            {matchedDeliveryArea && (
              <div className={styles.deliveryMetaRow}>
                <span className={styles.deliveryMetaPill}>Tarifa {formatEuro(deliveryFee)}</span>
                {minimumBasket > 0 && (
                  <span className={styles.deliveryMetaPill}>
                    Pedido min. {formatEuro(minimumBasket)}
                  </span>
                )}
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: 14, color: '#555', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={needCutlery}
                onChange={(e) => setNeedCutlery(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Incluir cubiertos
            </label>
          </div>
        )}

        {mode === 'mesa' && tableId && (
          <div className={styles.mesaInfo}>
            <span className={styles.mesaInfoIcon}><TableIcon /></span>
            <span>
              Pedido para <strong>{tableName || `Mesa ${tableId}`}</strong>
            </span>
          </div>
        )}

        {isEmpty ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><CartIcon /></div>
            <div className={styles.emptyTitle}>Tu cesta esta vacia</div>
            <div className={styles.emptySub}>Anade productos desde el menu para empezar</div>
            <button className={styles.emptyBtn} onClick={() => navigate('/menu')}>
              Ver menu
            </button>
          </div>
        ) : (
          <>
            <div className={styles.itemsList}>
              {items.map((item) => {
                const modExtra = item.modifiers.reduce((sum, modifier) => sum + modifier.priceImpact, 0)
                const unitPrice = item.price + modExtra

                return (
                  <div key={item.cartItemId} className={styles.cartItem}>
                    <div className={styles.cartItemImg}>
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }}
                        />
                      ) : (
                        <div className={styles.cartItemPlaceholder}><ProductIcon /></div>
                      )}
                    </div>
                    <div className={styles.cartItemInfo}>
                      <div className={styles.cartItemName}>{item.name}</div>
                      {item.modifiers.length > 0 && (
                        <div className={styles.cartItemMods}>
                          {item.modifiers.map((modifier) => modifier.name).join(', ')}
                        </div>
                      )}
                      <div className={styles.cartItemBottom}>
                        <div className={styles.qtyCtrl}>
                          <button className={styles.qtyBtn} onClick={() => changeQty(item.cartItemId, -1)}>−</button>
                          <span className={styles.qtyNum}>{item.qty}</span>
                          <button className={styles.qtyBtn} onClick={() => changeQty(item.cartItemId, 1)}>+</button>
                        </div>
                        <span className={styles.cartItemPrice}>{formatEuro(unitPrice * item.qty)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className={styles.notesSection}>
              <div className={styles.fieldLabel}>Notas para el pedido</div>
              <textarea
                className={styles.notesField}
                placeholder="Sin cebolla, alergias, instrucciones especiales..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.crosssellWrap}>
              <CrosssellChip
                suggestions={suggestionEngine.activeCrosssells}
                onAccept={suggestionEngine.acceptCrosssell}
                onDismiss={suggestionEngine.dismissCrosssell}
              />
            </div>

            {isMesaMode && (
              <div className={styles.paymentSection}>
                <div className={styles.fieldLabel}>Metodo de pago</div>
                <div className={styles.paymentGrid}>
                  {paymentOptions.map((option) => (
                    <button
                      key={option.mode}
                      type="button"
                      className={`${styles.paymentCard} ${selectedPaymentMode === option.mode ? styles.paymentCardActive : ''}`}
                      onClick={() => setSelectedPaymentMode(option.mode)}
                    >
                      <div className={styles.paymentCardTop}>
                        <span className={styles.paymentIcon}>{option.icon}</span>
                        {selectedPaymentMode === option.mode && (
                          <span className={styles.paymentCheck}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className={styles.paymentLabel}>{option.label}</div>
                      <div className={styles.paymentSub}>{option.description}</div>
                    </button>
                  ))}
                </div>
                <div className={styles.paymentHint}>
                  {selectedPaymentMode === 'online'
                    ? 'Pagaras ahora con tarjeta. Tu pedido va a cocina al confirmar el pago.'
                    : 'Recibiras un PIN y un QR. Paga en barra o en el kiosko del local. Tu pedido no va a cocina hasta que se confirme el pago.'}
                </div>
              </div>
            )}

            <div className={styles.summary}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Subtotal</span>
                <span className={styles.summaryVal}>{formatEuro(sub)}</span>
              </div>
              {mode === 'domicilio' && (
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Envio</span>
                  <span className={styles.summaryVal}>{formatEuro(deliveryFee)}</span>
                </div>
              )}
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span className={styles.summaryTotalLabel}>Total</span>
                <span className={styles.summaryTotalVal}>{formatEuro(total)}</span>
              </div>
            </div>

            {noDeliveryAvailable && (
              <div className={styles.deliveryHint} style={{ margin: '0 0 8px' }}>
                Domicilio no disponible ahora
              </div>
            )}
            {belowMinimum && !noDeliveryAvailable && (
              <div className={styles.deliveryHint} style={{ margin: '0 0 8px' }}>
                Pedido mínimo {formatEuro(minimumBasket)} para esta zona
              </div>
            )}
            {missingCoords && !noDeliveryAvailable && (
              <div className={styles.deliveryHint} style={{ margin: '0 0 8px' }}>
                Pulsa "Usar mi ubicación" para confirmar tus coordenadas
              </div>
            )}
            {outOfZone && (
              <div className={styles.deliveryHint} style={{ margin: '0 0 8px', background: 'rgba(180,0,0,0.07)', color: '#b00020' }}>
                Dirección fuera de zona de reparto
              </div>
            )}
            {draftSessionId && (
              <div className={styles.deliveryHint} style={{ margin: '0 0 8px', background: 'rgba(0,128,0,0.08)', color: '#1a6b1a' }}>
                Sesión {draftSessionId.slice(0, 8)}… creada
              </div>
            )}

            <div className={styles.ctaWrap}>
              <button className={styles.ctaBtn} onClick={() => void handleConfirm()} disabled={sending || belowMinimum || noDeliveryAvailable || missingCoords || outOfZone}>
                {sending ? (
                  <>
                    <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <span>{selectedPaymentMode === 'online' ? 'Pagar y confirmar' : 'Confirmar pedido'}</span>
                    <span className={styles.ctaAmount}>{formatEuro(total)}</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {showLoyaltyPrompt && (
        <div className={styles.loyaltyModalBackdrop} onClick={handleSkipLoyalty}>
          <div className={styles.loyaltyModal} onClick={(event) => event.stopPropagation()}>
            <div className={styles.loyaltyModalIcon}>
              <GiftIcon />
            </div>
            <div className={styles.loyaltyModalTitle}>Consigue puntos y regalos con esta compra</div>
            <div className={styles.loyaltyModalText}>
              Entra con Google y te avisaremos de ofertas y del estado de tu pedido.
            </div>
            <button
              type="button"
              className={styles.loyaltyModalPrimary}
              onClick={handleGoogleLogin}
              disabled={loginBusy || !isFirebaseAuthConfigured}
            >
              {loginBusy ? 'Conectando...' : 'Entrar con Google'}
            </button>
            <button
              type="button"
              className={styles.loyaltyModalSecondary}
              onClick={handleSkipLoyalty}
            >
              Seguir sin puntos
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function buildOrderCustomer(user: ReturnType<typeof useAuthStore.getState>['user']): OrderCustomerPayload {
  const guestName = localStorage.getItem('qrp_guest_name')
  const guestPhone = localStorage.getItem('qrp_guest_phone')
  const extraPhone = useAuthStore.getState().extraPhone

  return {
    name: user?.name || guestName || 'Cliente QR',
    phoneNumber: user?.phone || extraPhone || guestPhone || null,
    email: user?.email || null,
    externalId: (user && !user.isAnonymous) ? user.uid : null,
    surname: null,
  }
}

function buildPaymentOptions(
  methods: PaymentMethod[] | undefined,
  mode: OrderMode,
): Array<{ mode: CheckoutPaymentMode; label: string; description: string; icon: ReactNode }> {
  const normalized = (methods ?? []).filter((method) => method.enabled !== false)
  const hasOnline = normalized.some((method) => matchesAny(method, ['stripe', 'card', 'online', 'tarjeta', 'credit', 'debit']))
  const hasCashier = normalized.some((method) => matchesAny(method, ['cash', 'cashier', 'counter', 'restaurant', 'store', 'efectivo']))

  const options: Array<{ mode: CheckoutPaymentMode; label: string; description: string; icon: ReactNode }> = []

  if (hasOnline || normalized.length === 0) {
    options.push({
      mode: 'online',
      label: 'Tarjeta online',
      description: 'Base lista para Stripe y pagos inmediatos',
      icon: <CardIcon />,
    })
  }

  if (hasCashier || normalized.length === 0) {
    options.push({
      mode: 'cashier',
      label: mode === 'domicilio' ? 'Pago a la entrega' : 'Pago en local',
      description: mode === 'domicilio' ? 'Efectivo o TPV al recibir' : 'Cobro en mostrador o al recoger',
      icon: <CashIcon />,
    })
  }

  return options.length > 0
    ? options
    : [{
        mode: 'online',
        label: 'Tarjeta online',
        description: 'Pago seguro al confirmar el pedido',
        icon: <CardIcon />,
      }]
}

function matchesAny(method: PaymentMethod, tokens: string[]) {
  const haystack = [
    method.name,
    method.provider,
    method.financialMethod,
    method.behavior,
    method.type,
    method.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return tokens.some((token) => haystack.includes(token))
}

function TableIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10h18" />
      <path d="M5 10v9" />
      <path d="M19 10v9" />
      <path d="M8 5h8a2 2 0 0 1 2 2v3H6V7a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

function ProductIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 9l10 6 10-6-10-6Z" />
      <path d="M2 15l10 6 10-6" />
      <path d="M2 9v6" />
      <path d="M22 9v6" />
    </svg>
  )
}

function CardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <path d="M2 10h20" />
    </svg>
  )
}

function CashIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7" />
      <path d="M2 7h20v5H2z" />
      <path d="M12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7Z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7Z" />
    </svg>
  )
}
