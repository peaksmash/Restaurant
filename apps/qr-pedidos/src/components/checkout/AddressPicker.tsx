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
  const inputRef = useRef<HTMLInputElement | null>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [mapsReady, setMapsReady] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return

    getPlacesAutocomplete()
      .then(() => setMapsReady(true))
      .catch(() => {
        setMapsError(
          'Google Maps no se ha podido cargar. Puedes seguir escribiendo tu dirección manualmente.',
        )
      })
  }, [])

  useEffect(() => {
    if (!mapsReady || !inputRef.current || autocompleteRef.current) return

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'es' },
      fields: ['formatted_address', 'geometry'],
      types: ['address'],
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const address = place.formatted_address ?? inputRef.current?.value ?? ''
      const lat = place.geometry?.location?.lat()
      const lng = place.geometry?.location?.lng()
      onChange({ address, lat, lng })
    })

    autocompleteRef.current = autocomplete
  }, [mapsReady, onChange])

  return (
    <div className={styles.wrap}>
      <div className={styles.inputWrap}>
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
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Calle, número, ciudad..."
          value={value}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </div>

      <div className={styles.metaRow}>
        <div className={styles.pill}>
          <MapPinIcon />
          {mapsReady ? 'Búsqueda con Google Maps' : 'Entrada manual'}
        </div>
        <div className={styles.status}>
          {mapsError ? (
            mapsError
          ) : mapsReady ? (
            <span className={styles.statusStrong}>
              Selecciona una sugerencia para validar la zona de reparto.
            </span>
          ) : GOOGLE_MAPS_API_KEY ? (
            'Cargando autocompletado de direcciones...'
          ) : (
            'Añade tu API key de Google Maps para autocompletar y validar zonas automáticamente.'
          )}
        </div>
      </div>
    </div>
  )
}

function MapPinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}
