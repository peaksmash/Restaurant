import { useEffect, useMemo, useRef, useState } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
// Ensures setOptions() with the API key runs before any importLibrary call
import '@/lib/googleMaps'
import { findMatchingDeliveryArea } from '@/lib/delivery'
import type { SavedAddress } from '@/hooks/useSavedAddress'
import type { DeliveryArea } from '@/types'
import styles from './DeliveryAddressSection.module.css'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

// Default map center: Spain
const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 }
const DEFAULT_ZOOM = 6

interface Props {
  savedAddress: SavedAddress | null
  onSave: (addr: SavedAddress) => void
  onClear: () => void
  restaurantLat?: number | null
  restaurantLng?: number | null
  /** Enabled delivery areas from bootstrap — used for client-side zone matching */
  deliveryAreas?: DeliveryArea[]
}

export default function DeliveryAddressSection({
  savedAddress,
  onSave,
  onClear,
  restaurantLat,
  restaurantLng,
  deliveryAreas,
}: Props) {
  const [editing, setEditing] = useState(!savedAddress)

  useEffect(() => {
    if (!savedAddress) setEditing(true)
  }, [savedAddress])

  if (!editing && savedAddress) {
    return (
      <SavedAddressCard
        address={savedAddress}
        onChange={() => setEditing(true)}
        onClear={() => { onClear(); setEditing(true) }}
      />
    )
  }

  return (
    <AddressForm
      initial={savedAddress}
      restaurantLat={restaurantLat}
      restaurantLng={restaurantLng}
      deliveryAreas={deliveryAreas}
      onSave={(addr) => { onSave(addr); setEditing(false) }}
      onCancel={savedAddress ? () => setEditing(false) : undefined}
    />
  )
}

// ── Saved address card ─────────────────────────────────────────

function SavedAddressCard({
  address,
  onChange,
  onClear,
}: {
  address: SavedAddress
  onChange: () => void
  onClear: () => void
}) {
  const detail = [address.floor, address.door].filter(Boolean).join(', ')

  return (
    <div className={styles.savedCard}>
      <div className={styles.savedIcon}><HomeIcon /></div>
      <div className={styles.savedInfo}>
        <div className={styles.savedLabel}>Dirección predeterminada</div>
        <div className={styles.savedAddress}>{address.address}</div>
        {detail && <div className={styles.savedDetail}>{detail}</div>}
        {address.lat !== 0 && address.lng !== 0 && (
          <div className={styles.savedDetail} style={{ color: '#4a7a4a', fontWeight: 700 }}>
            ✓ Coordenadas confirmadas
          </div>
        )}
      </div>
      <div className={styles.savedActions}>
        <button className={styles.changeBtn} onClick={onChange} type="button">
          Cambiar
        </button>
        <button className={styles.clearBtn} onClick={onClear} type="button" aria-label="Eliminar dirección">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ── Address form ───────────────────────────────────────────────

function AddressForm({
  initial,
  restaurantLat,
  restaurantLng,
  deliveryAreas,
  onSave,
  onCancel,
}: {
  initial: SavedAddress | null
  restaurantLat?: number | null
  restaurantLng?: number | null
  deliveryAreas?: DeliveryArea[]
  onSave: (addr: SavedAddress) => void
  onCancel?: () => void
}) {
  const [addressText, setAddressText] = useState(initial?.address ?? '')
  const [floor, setFloor] = useState(initial?.floor ?? '')
  const [door, setDoor] = useState(initial?.door ?? '')
  const [riderNotes, setRiderNotes] = useState(initial?.riderNotes ?? '')
  const [lat, setLat] = useState<number | null>(initial?.lat ?? null)
  const [lng, setLng] = useState<number | null>(initial?.lng ?? null)
  const [mapOpen, setMapOpen] = useState(!!initial?.lat)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const mapInitializedRef = useRef(false)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  // ── Autocomplete (classic Autocomplete widget on plain <input>) ──────────
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !inputRef.current) return

    let cancelled = false

    importLibrary('places')
      .then((lib) => {
        if (cancelled || !inputRef.current) return
        const { Autocomplete } = lib as google.maps.PlacesLibrary

        const ac = new Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'es' },
          types: ['address'],
          fields: ['formatted_address', 'geometry'],
        })

        ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          if (!place.geometry?.location) return

          const formatted = place.formatted_address ?? ''
          const newLat = place.geometry.location.lat()
          const newLng = place.geometry.location.lng()

          setAddressText(formatted)
          setLat(newLat)
          setLng(newLng)
          setMapOpen(true)
          setGeoError(null)
        })

        autocompleteRef.current = ac
      })
      .catch(() => {
        // Places failed — fallback to manual input (no-op, input still editable)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ── Map initialisation ───────────────────────────────────────
  useEffect(() => {
    if (!mapOpen || mapInitializedRef.current || !GOOGLE_MAPS_API_KEY) return
    mapInitializedRef.current = true

    const center =
      lat && lng
        ? { lat, lng }
        : restaurantLat && restaurantLng
          ? { lat: restaurantLat, lng: restaurantLng }
          : DEFAULT_CENTER
    const zoom = lat && lng ? 17 : restaurantLat ? 14 : DEFAULT_ZOOM

    async function init() {
      await new Promise<void>((resolve) => {
        const check = () => (mapRef.current ? resolve() : setTimeout(check, 50))
        check()
      })
      if (!mapRef.current) return

      const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = (await importLibrary('marker')) as google.maps.MarkerLibrary

      const map = new Map(mapRef.current, {
        center,
        zoom,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      })

      if (lat && lng) {
        const marker = new AdvancedMarkerElement({
          map,
          position: { lat, lng },
          content: buildPin(),
          gmpDraggable: true,
          title: 'Arrastra para ajustar',
        })
        attachDragEnd(marker, setLat, setLng)
        markerRef.current = marker
      }
      mapInstanceRef.current = map
    }

    init().catch(() => {})
  }, [mapOpen])

  // ── Sync map when lat/lng changes ────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || lat == null || lng == null) return
    mapInstanceRef.current.setCenter({ lat, lng })
    mapInstanceRef.current.setZoom(17)

    if (markerRef.current) {
      markerRef.current.position = { lat, lng }
    } else {
      importLibrary('marker')
        .then((lib) => {
          const { AdvancedMarkerElement } = lib as google.maps.MarkerLibrary
          const marker = new AdvancedMarkerElement({
            map: mapInstanceRef.current!,
            position: { lat, lng },
            content: buildPin(),
            gmpDraggable: true,
            title: 'Arrastra para ajustar',
          })
          attachDragEnd(marker, setLat, setLng)
          markerRef.current = marker
        })
        .catch(() => {})
    }
  }, [lat, lng])

  // ── Geolocation ──────────────────────────────────────────────
  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoLoading(false)
        setLat(coords.latitude)
        setLng(coords.longitude)
        if (!mapOpen) setMapOpen(true)
      },
      () => {
        setGeoLoading(false)
        setGeoError('No se pudo obtener tu ubicación.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const hasCoords = lat != null && lng != null && !(lat === 0 && lng === 0)

  // Zone matching — runs client-side as soon as coordinates are available
  const matchedZone = useMemo(() => {
    if (!hasCoords || !deliveryAreas || deliveryAreas.length === 0) return undefined
    return findMatchingDeliveryArea(deliveryAreas, lat!, lng!)
  }, [hasCoords, lat, lng, deliveryAreas])

  // Out of zone = we have areas, we have coords, but none matched
  const outOfZone = hasCoords && deliveryAreas && deliveryAreas.length > 0 && matchedZone === null

  const canSave = addressText.trim().length > 0 && hasCoords && !outOfZone

  return (
    <div className={styles.form}>
      {/* Address input — Autocomplete when key present, plain input otherwise */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Dirección</label>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={GOOGLE_MAPS_API_KEY ? 'Escribe tu dirección...' : 'Calle, número, ciudad...'}
          value={addressText}
          onChange={(e) => {
            setAddressText(e.target.value)
            // If user edits manually, clear coords so they're forced to re-geolocate
            if (!GOOGLE_MAPS_API_KEY) {
              setLat(null)
              setLng(null)
            }
          }}
          autoComplete="off"
        />
      </div>

      {/* Coordinates feedback + geolocation button */}
      <div className={styles.mapGeoRow} style={{ marginTop: -4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: outOfZone ? '#b00020' : hasCoords ? '#4a7a4a' : '#8a6000' }}>
          {outOfZone
            ? '✗ Dirección fuera de zona de reparto'
            : hasCoords
              ? `✓ Zona: ${matchedZone?.name?.trim() || 'Confirmada'}`
              : GOOGLE_MAPS_API_KEY
                ? 'Selecciona una sugerencia o usa tu ubicación'
                : 'Escribe la dirección y pulsa "Usar mi ubicación"'}
        </span>
        <button
          className={styles.geoBtn}
          type="button"
          onClick={handleGeolocate}
          disabled={geoLoading}
        >
          {geoLoading ? <Spinner /> : <GpsIcon />}
          {geoLoading ? 'Buscando...' : 'Mi ubicación'}
        </button>
      </div>
      {geoError && <p className={styles.geoError}>{geoError}</p>}

      {/* Floor / Door */}
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Piso</label>
          <input className={styles.input} placeholder="2º" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Puerta</label>
          <input className={styles.input} placeholder="B" value={door} onChange={(e) => setDoor(e.target.value)} />
        </div>
      </div>

      {/* Map — opens after autocomplete pick or geolocation */}
      {mapOpen && GOOGLE_MAPS_API_KEY && (
        <div className={styles.mapWrap}>
          <div className={styles.mapGeoRow}>
            <span className={styles.mapHint}>Arrastra el pin para marcar tu entrada exacta</span>
          </div>
          <div ref={mapRef} className={styles.map} />
          <button className={styles.confirmMapBtn} type="button" onClick={() => setMapOpen(false)}>
            Listo
          </button>
        </div>
      )}

      {/* Rider notes */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Notas para el repartidor</label>
        <textarea
          className={styles.textarea}
          placeholder="El portal es el azul, timbre roto, dejar en conserjería..."
          value={riderNotes}
          onChange={(e) => setRiderNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        {onCancel && (
          <button className={styles.cancelBtn} type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          className={styles.saveBtn}
          type="button"
          disabled={!canSave}
          onClick={() =>
            canSave &&
            onSave({
              address: addressText.trim(),
              lat: lat!,
              lng: lng!,
              floor: floor.trim() || undefined,
              door: door.trim() || undefined,
              riderNotes: riderNotes.trim() || undefined,
            })
          }
        >
          {outOfZone
            ? 'Fuera de zona de reparto'
            : !hasCoords
              ? 'Confirma tu ubicación primero'
              : 'Guardar dirección'}
        </button>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function attachDragEnd(
  marker: google.maps.marker.AdvancedMarkerElement,
  setLat: (v: number) => void,
  setLng: (v: number) => void,
) {
  marker.addListener('dragend', () => {
    const pos = marker.position as google.maps.LatLng | null
    if (!pos) return
    setLat(typeof pos.lat === 'function' ? pos.lat() : (pos as unknown as { lat: number }).lat)
    setLng(typeof pos.lng === 'function' ? pos.lng() : (pos as unknown as { lng: number }).lng)
  })
}

function buildPin() {
  const el = document.createElement('div')
  el.innerHTML = `<svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#ffc200"/>
    <circle cx="18" cy="18" r="7" fill="#32170f"/>
  </svg>`
  return el
}

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function GpsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  )
}

function Spinner() {
  return <span className={styles.spinner} />
}
