import { useEffect, useRef, useState } from 'react'
import styles from './AddressPicker.module.css'
import { getPlacesAutocomplete } from '../../lib/googleMaps'

interface AddressSelection {
  address: string
  lat?: number
  lng?: number
}

interface Props {
  value: string
  onChange: (selection: AddressSelection) => void
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export default function AddressPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fallbackRef = useRef<HTMLInputElement | null>(null)
  const onChangeRef = useRef(onChange)
  const [mapsReady, setMapsReady] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)

  onChangeRef.current = onChange

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return

    const timeout = setTimeout(() => {
      setMapsError('Google Maps no respondió. Escribe tu dirección manualmente.')
    }, 8000)

    getPlacesAutocomplete()
      .then(() => {
        clearTimeout(timeout)
        setMapsReady(true)
      })
      .catch(() => {
        clearTimeout(timeout)
        setMapsError('Google Maps no se ha podido cargar. Escribe tu dirección manualmente.')
      })

    return () => clearTimeout(timeout)
  }, [])

  // Montar PlaceAutocompleteElement (nueva API)
  useEffect(() => {
    if (!mapsReady || !containerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PlaceAutocompleteElement = (google.maps.places as any).PlaceAutocompleteElement
    if (!PlaceAutocompleteElement) {
      setMapsError('Versión de Maps no compatible. Escribe tu dirección manualmente.')
      return
    }

    const placeEl: HTMLElement = new PlaceAutocompleteElement({
      componentRestrictions: { country: 'es' },
      types: ['address'],
    })

    placeEl.addEventListener('gmp-select', async (event: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { placePrediction } = event as any
      if (!placePrediction) return

      const place = placePrediction.toPlace()
      await place.fetchFields({ fields: ['formattedAddress', 'location'] }).catch(() => {})

      const address: string = place.formattedAddress ?? placePrediction.text?.text ?? ''
      const lat: number | undefined = place.location?.lat()
      const lng: number | undefined = place.location?.lng()

      onChangeRef.current({ address, lat, lng })
    })

    containerRef.current.appendChild(placeEl)
    return () => { placeEl.remove() }
  }, [mapsReady])

  const showFallback = !GOOGLE_MAPS_API_KEY || !!mapsError

  return (
    <div className={styles.wrap}>
      {showFallback ? (
        <div className={styles.inputWrap}>
          <MapPinIcon />
          <input
            ref={fallbackRef}
            className={styles.input}
            placeholder="Calle, número, ciudad..."
            value={value}
            onChange={(e) => onChange({ address: e.target.value })}
          />
        </div>
      ) : (
        <div ref={containerRef} className={styles.placeAutocompleteWrap} />
      )}

      <div className={styles.metaRow}>
        <div className={styles.pill}>
          <MapPinIcon />
          {mapsReady ? 'Búsqueda con Google Maps' : showFallback ? 'Entrada manual' : 'Cargando...'}
        </div>
        <div className={styles.status}>
          {mapsError ? (
            mapsError
          ) : mapsReady ? (
            <span className={styles.statusStrong}>
              Selecciona una sugerencia para validar la zona de reparto.
            </span>
          ) : GOOGLE_MAPS_API_KEY ? (
            'Cargando autocompletado...'
          ) : (
            'Añade tu API key de Google Maps para autocompletar.'
          )}
        </div>
      </div>
    </div>
  )
}

function MapPinIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      style={{ color: 'var(--text-3)', flexShrink: 0 }}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
