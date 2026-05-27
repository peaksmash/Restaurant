import { useEffect, useRef, useState } from 'react'
import { importLibrary } from '@googlemaps/js-api-loader'
import styles from './DeliveryMap.module.css'

interface Props {
  lat: number
  lng: number
  onPositionChange: (lat: number, lng: number) => void
}

export default function DeliveryMap({ lat, lng, onPositionChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const initializedRef = useRef(false)
  const onChangeRef = useRef(onPositionChange)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  onChangeRef.current = onPositionChange

  useEffect(() => {
    if (initializedRef.current || !mapRef.current) return
    initializedRef.current = true

    async function init() {
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary
      const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary

      if (!mapRef.current) return

      const map = new Map(mapRef.current, {
        center: { lat, lng },
        zoom: 17,
        mapId: 'DEMO_MAP_ID',
        disableDefaultUI: true,
        gestureHandling: 'greedy',
        clickableIcons: false,
      })

      const pin = document.createElement('div')
      pin.innerHTML = `<svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#ffc200"/>
        <circle cx="18" cy="18" r="7" fill="#32170f"/>
      </svg>`

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: pin,
        gmpDraggable: true,
        title: 'Arrastra para ajustar la ubicación',
      })

      marker.addListener('dragend', () => {
        const pos = marker.position as google.maps.LatLng | null
        if (pos) {
          onChangeRef.current(
            typeof pos.lat === 'function' ? pos.lat() : (pos as unknown as { lat: number }).lat,
            typeof pos.lng === 'function' ? pos.lng() : (pos as unknown as { lng: number }).lng,
          )
        }
      })

      mapInstanceRef.current = map
      markerRef.current = marker
    }

    init().catch(() => {/* mapa no disponible */})
  }, [])

  // Sincronizar posición cuando cambia desde fuera (nueva dirección seleccionada)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return
    const pos = { lat, lng }
    mapInstanceRef.current.setCenter(pos)
    markerRef.current.position = pos
  }, [lat, lng])

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
        const pos = { lat: coords.latitude, lng: coords.longitude }
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(pos)
          mapInstanceRef.current.setZoom(17)
        }
        if (markerRef.current) {
          markerRef.current.position = pos
        }
        onChangeRef.current(pos.lat, pos.lng)
      },
      () => {
        setGeoLoading(false)
        setGeoError('No se pudo obtener tu ubicación. Verifica los permisos.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>Confirma la ubicación exacta</span>
        <button
          className={styles.geoBtn}
          onClick={handleGeolocate}
          disabled={geoLoading}
          type="button"
        >
          {geoLoading ? (
            <span className={styles.spinner} />
          ) : (
            <GpsIcon />
          )}
          {geoLoading ? 'Buscando...' : 'Mi ubicación'}
        </button>
      </div>

      <div ref={mapRef} className={styles.map} />

      <p className={styles.hint}>
        Arrastra el pin para ajustar la puerta exacta
      </p>

      {geoError && <p className={styles.error}>{geoError}</p>}
    </div>
  )
}

function GpsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 2" />
    </svg>
  )
}
