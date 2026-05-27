/**
 * Server-side delivery zone validator.
 * Polygon and circle matching — mirrors the logic in apps/qr-pedidos/src/lib/delivery.ts.
 * Only pure geometry math; no HTTP, no Firestore.
 */

import type { LastDeliveryArea } from '../../infrastructure/lastApp/lastAppClient.js';

interface Point {
  lat: number;
  lng: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPoint(value: unknown): Point | null {
  const r = asRecord(value);
  if (r) {
    const lat = readNum(r.lat) ?? readNum(r.latitude) ?? readNum(r.y);
    const lng = readNum(r.lng) ?? readNum(r.longitude) ?? readNum(r.lon) ?? readNum(r.x);
    if (lat != null && lng != null) return { lat, lng };
  }
  if (Array.isArray(value) && value.length >= 2) {
    const first = readNum(value[0]);
    const second = readNum(value[1]);
    if (first != null && second != null) {
      return Math.abs(first) <= 90
        ? { lat: first, lng: second }
        : { lat: second, lng: first };
    }
  }
  return null;
}

function toPointList(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).map(readPoint).filter((p): p is Point => p != null);
}

function extractPolygonPoints(geometry: unknown): Point[] {
  if (Array.isArray(geometry)) {
    if (geometry.length > 0 && Array.isArray(geometry[0])) {
      const nested = toPointList(geometry[0] as unknown[]);
      if (nested.length > 0) return nested;
    }
    return toPointList(geometry);
  }
  const r = asRecord(geometry);
  if (!r) return [];
  const candidates = [
    toPointList(r.points),
    toPointList(r.path),
    toPointList(r.paths),
    toPointList(r.coordinates),
  ];
  return candidates.find((entry) => entry.length > 0) ?? [];
}

function extractCircle(geometry: unknown): { center: Point; radiusMeters: number } | null {
  const r = asRecord(geometry);
  if (!r) return null;
  const center =
    readPoint(r.center) ??
    readPoint(r.origin) ??
    readPoint(r.coordinates) ??
    readPoint(r);
  const radiusMeters =
    readNum(r.radiusMeters) ??
    readNum(r.radius) ??
    readNum(r.distance) ??
    readNum(r.distanceMeters);
  if (!center || radiusMeters == null) return null;
  return { center, radiusMeters };
}

function haversineMeters(a: Point, b: Point): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const arc =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function detectType(area: LastDeliveryArea): string | null {
  if (area.type?.trim()) return area.type.trim().toLowerCase();
  const r = asRecord(area.geometry);
  const candidate = typeof r?.type === 'string' ? r.type.trim().toLowerCase() : '';
  if (candidate) return candidate;
  if (extractCircle(area.geometry)) return 'circle';
  if (extractPolygonPoints(area.geometry).length > 2) return 'polygon';
  return null;
}

/**
 * Find the first enabled delivery area that contains the given point.
 * Returns null if none match.
 */
export function findMatchingDeliveryArea(
  areas: LastDeliveryArea[],
  lat: number,
  lng: number,
): LastDeliveryArea | null {
  const point: Point = { lat, lng };
  for (const area of areas) {
    if (!area.enabled) continue;
    const areaType = detectType(area);
    if (areaType === 'polygon') {
      const polygon = extractPolygonPoints(area.geometry);
      if (polygon.length >= 3 && isPointInPolygon(point, polygon)) return area;
    }
    if (areaType === 'circle') {
      const circle = extractCircle(area.geometry);
      if (circle && haversineMeters(circle.center, point) <= circle.radiusMeters) return area;
    }
  }
  return null;
}
