import type { DeliveryArea } from '@/types'

interface Point {
  lat: number
  lng: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function readNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null
}

function readPoint(value: unknown): Point | null {
  const record = asRecord(value)
  if (record) {
    const lat =
      readNumber(record.lat) ??
      readNumber(record.latitude) ??
      readNumber(record.y)
    const lng =
      readNumber(record.lng) ??
      readNumber(record.longitude) ??
      readNumber(record.lon) ??
      readNumber(record.x)

    if (lat != null && lng != null) {
      return { lat, lng }
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const first = readNumber(value[0])
    const second = readNumber(value[1])
    if (first != null && second != null) {
      return Math.abs(first) <= 90
        ? { lat: first, lng: second }
        : { lat: second, lng: first }
    }
  }

  return null
}

function toPointList(value: unknown): Point[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(readPoint)
    .filter((point): point is Point => point != null)
}

function extractPolygonPoints(geometry: unknown): Point[] {
  if (Array.isArray(geometry)) {
    if (geometry.length > 0 && Array.isArray(geometry[0])) {
      const nested = geometry[0] as unknown[]
      const nestedPoints = toPointList(nested)
      if (nestedPoints.length > 0) {
        return nestedPoints
      }
    }
    return toPointList(geometry)
  }

  const record = asRecord(geometry)
  if (!record) {
    return []
  }

  const candidates = [
    toPointList(record.points),
    toPointList(record.path),
    toPointList(record.paths),
    toPointList(record.coordinates),
  ]

  return candidates.find((entry) => entry.length > 0) ?? []
}

function extractCircle(geometry: unknown): { center: Point; radiusMeters: number } | null {
  const record = asRecord(geometry)
  if (!record) {
    return null
  }

  const center =
    readPoint(record.center) ??
    readPoint(record.origin) ??
    readPoint(record.coordinates) ??
    readPoint(record)
  const radiusMeters =
    readNumber(record.radiusMeters) ??
    readNumber(record.radius) ??
    readNumber(record.distance) ??
    readNumber(record.distanceMeters)

  if (!center || radiusMeters == null) {
    return null
  }

  return { center, radiusMeters }
}

function haversineDistanceMeters(a: Point, b: Point): number {
  const earthRadius = 6_371_000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180

  const arc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng
    const yi = polygon[i].lat
    const xj = polygon[j].lng
    const yj = polygon[j].lat

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function detectAreaType(area: DeliveryArea): string | null {
  if (typeof area.type === 'string' && area.type.trim()) {
    return area.type.trim().toLowerCase()
  }

  const record = asRecord(area.geometry)
  const candidate = typeof record?.type === 'string' ? record.type.trim().toLowerCase() : ''
  if (candidate) {
    return candidate
  }

  if (extractCircle(area.geometry)) {
    return 'circle'
  }

  if (extractPolygonPoints(area.geometry).length > 2) {
    return 'polygon'
  }

  return null
}

export function getEnabledDeliveryAreas(areas: DeliveryArea[] | undefined): DeliveryArea[] {
  return (areas ?? []).filter((area) => area.enabled !== false)
}

export function getDeliveryAreaFee(area: DeliveryArea | null): number {
  if (!area) {
    return 0
  }
  return area.fee ?? area.deliveryFee ?? 0
}

export function findMatchingDeliveryArea(
  areas: DeliveryArea[] | undefined,
  lat: number | null,
  lng: number | null,
): DeliveryArea | null {
  if (lat == null || lng == null) {
    return null
  }

  const point = { lat, lng }

  for (const area of getEnabledDeliveryAreas(areas)) {
    const areaType = detectAreaType(area)

    if (areaType === 'circle') {
      const circle = extractCircle(area.geometry)
      if (circle && haversineDistanceMeters(circle.center, point) <= circle.radiusMeters) {
        return area
      }
    }

    if (areaType === 'polygon') {
      const polygon = extractPolygonPoints(area.geometry)
      if (polygon.length >= 3 && isPointInPolygon(point, polygon)) {
        return area
      }
    }
  }

  return null
}
