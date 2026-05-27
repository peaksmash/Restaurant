import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { loadEnv } from '../../config/env.js';
import { getFirestoreDb } from '../../config/firebaseAdmin.js';
import { FirestoreTenantRepository } from '../../domain/tenant/tenantRepository.js';
import { getLocationDetail } from '../../infrastructure/lastApp/lastAppClient.js';
import { findMatchingDeliveryArea } from '../../domain/delivery/deliveryZoneValidator.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderMode = 'delivery' | 'pickup' | 'table';
type PaymentMode = 'online' | 'cashier';
type Currency = 'EUR';

interface OrderSessionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifiers?: {
    modifierId: string;
    modifierName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  notes?: string | null;
}

interface OrderSessionTotals {
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: Currency;
}

/**
 * Fields that map 1:1 to Last POST /tabs delivery object.
 * Only confirmed Last OpenAPI fields are allowed here.
 */
interface LastDeliveryInput {
  address: string;
  details?: string | null;
  latitude: number;
  longitude: number;
  fee: number;
  comments?: string | null;
  external?: boolean;
  needCutlery?: boolean;
}

/**
 * Internal snapshot of the matched delivery zone.
 * Used for audit and validation only — NOT sent to Last.
 */
interface LastDeliveryAreaSnapshot {
  id: string | null;
  name: string | null;
  deliveryFee: number;
  minimumBasket: number;
  estimatedDeliveryMinutes: number;
}

interface CreateOrderSessionBody {
  tenant: string;
  locationKey: string;
  orderMode: OrderMode;
  paymentMode: PaymentMode;
  items: OrderSessionItem[];
  totals: OrderSessionTotals;
  lastDeliveryInput?: LastDeliveryInput | null;
  lastDeliveryAreaSnapshot?: LastDeliveryAreaSnapshot | null;
}

export interface OrderSessionDocument {
  orderSessionId: string;
  tenantId: string;
  locationKey: string;
  channel: 'qr_order';
  orderMode: OrderMode;
  paymentMode: PaymentMode;
  operationalStatus: 'draft';
  paymentStatus: 'unpaid';
  lastSyncStatus: 'not_sent';
  items: OrderSessionItem[];
  totals: OrderSessionTotals;
  /** What will be sent to Last POST /tabs delivery — only Last-confirmed fields */
  lastDeliveryInput: LastDeliveryInput | null;
  /** Internal zone snapshot — audit only, never sent to Last */
  lastDeliveryAreaSnapshot: LastDeliveryAreaSnapshot | null;
  catalogId: string;
  lastApp: {
    organizationId: string;
    locationId: string;
    brandId: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fail(statusCode: number, message: string): never {
  const e = new Error(message) as Error & { statusCode?: number };
  e.statusCode = statusCode;
  throw e;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseLastDeliveryInput(raw: unknown): LastDeliveryInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const address = asString(d.address);
  if (!address) return null;
  return {
    address,
    details: asString(d.details) || null,
    latitude: asNumber(d.latitude) ?? 0,
    longitude: asNumber(d.longitude) ?? 0,
    fee: asNumber(d.fee) ?? 0,
    comments: asString(d.comments) || null,
    external: asBoolean(d.external, false),
    needCutlery: asBoolean(d.needCutlery, false),
  };
}

function parseLastDeliveryAreaSnapshot(raw: unknown): LastDeliveryAreaSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  return {
    id: asString(d.id) || null,
    name: asString(d.name) || null,
    deliveryFee: asNumber(d.deliveryFee) ?? 0,
    minimumBasket: asNumber(d.minimumBasket) ?? 0,
    estimatedDeliveryMinutes: asNumber(d.estimatedDeliveryMinutes) ?? 0,
  };
}

function parseBody(raw: unknown): CreateOrderSessionBody {
  if (!raw || typeof raw !== 'object') fail(400, 'Request body is required.');
  const b = raw as Record<string, unknown>;

  const tenant = asString(b.tenant);
  const locationKey = asString(b.locationKey);
  const orderMode = asString(b.orderMode) as OrderMode;
  const paymentMode = asString(b.paymentMode) as PaymentMode;

  if (!tenant) fail(400, 'tenant is required.');
  if (!locationKey) fail(400, 'locationKey is required.');
  if (!['delivery', 'pickup', 'table'].includes(orderMode))
    fail(400, 'orderMode must be one of: delivery, pickup, table.');
  if (!['online', 'cashier'].includes(paymentMode))
    fail(400, 'paymentMode must be one of: online, cashier.');

  const items = Array.isArray(b.items) ? (b.items as OrderSessionItem[]) : [];
  if (items.length === 0) fail(400, 'items must not be empty.');

  const t = b.totals && typeof b.totals === 'object' ? (b.totals as Record<string, unknown>) : {};
  const totals: OrderSessionTotals = {
    subtotal: asNumber(t.subtotal) ?? 0,
    deliveryFee: asNumber(t.deliveryFee) ?? 0,
    total: asNumber(t.total) ?? 0,
    currency: 'EUR',
  };

  return {
    tenant,
    locationKey,
    orderMode,
    paymentMode,
    items,
    totals,
    lastDeliveryInput: parseLastDeliveryInput(b.lastDeliveryInput),
    lastDeliveryAreaSnapshot: parseLastDeliveryAreaSnapshot(b.lastDeliveryAreaSnapshot),
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export function registerOrderSessionsRoutes(app: FastifyInstance) {

  // ── POST /api/order-sessions ───────────────────────────────────────────────
  app.post('/api/order-sessions', async (request) => {
    const env = loadEnv();
    const firestore = getFirestoreDb(env);
    const repository = new FirestoreTenantRepository(firestore);

    const body = parseBody(request.body);

    // 1. Resolve tenant
    const tenant = await repository.findTenantBySlug(body.tenant);
    if (!tenant) fail(404, 'Tenant not found.');
    if (!tenant.online.enabled) fail(403, 'Tenant is disabled for online usage.');

    // 2. Resolve location
    const locations = await repository.listEnabledLocations(tenant.tenantId);
    const location = locations.find((loc) => loc.locationKey === body.locationKey);
    if (!location) fail(404, `Location '${body.locationKey}' not found or not enabled.`);

    // 3. Validate catalogId for orderMode
    const channelMap = {
      table: location.catalogsByChannel.qr_table.catalogId,
      pickup: location.catalogsByChannel.qr_pickup.catalogId,
      delivery: location.catalogsByChannel.qr_delivery.catalogId,
    };
    const catalogId = channelMap[body.orderMode];
    if (!catalogId) fail(422, `No catalog configured for orderMode '${body.orderMode}'.`);

    // 4. Delivery-specific validations (server-side — never trust client zone data)
    let resolvedDeliveryInput: LastDeliveryInput | null = body.lastDeliveryInput ?? null;
    let resolvedAreaSnapshot: LastDeliveryAreaSnapshot | null = null;

    if (body.orderMode === 'delivery') {
      // address required
      if (!resolvedDeliveryInput?.address) {
        fail(422, 'lastDeliveryInput.address is required for orderMode=delivery.');
      }
      // coordinates required — reject 0,0 or missing
      const lat = resolvedDeliveryInput?.latitude ?? 0;
      const lng = resolvedDeliveryInput?.longitude ?? 0;
      if (lat === 0 && lng === 0) {
        fail(422, 'lastDeliveryInput.latitude and longitude are required for orderMode=delivery (0,0 not accepted).');
      }

      // Fetch real delivery areas from Last.app and run server-side zone matching
      const lastLocation = await getLocationDetail(
        env.lastApp,
        location.lastApp.organizationId,
        location.lastApp.locationId,
      );

      const matchedArea = findMatchingDeliveryArea(lastLocation.deliveryAreas, lat, lng);
      if (!matchedArea) {
        fail(422, `Coordinates (${lat}, ${lng}) do not fall within any enabled delivery area.`);
      }

      // Minimum basket check using Last.app's authoritative value
      if (matchedArea.minimumBasket > 0 && body.totals.subtotal < matchedArea.minimumBasket) {
        fail(422, `Subtotal ${body.totals.subtotal} is below minimumBasket ${matchedArea.minimumBasket} for zone '${matchedArea.name}'.`);
      }

      // Override fee from Last.app — never trust client-supplied fee
      resolvedDeliveryInput = {
        ...resolvedDeliveryInput!,
        fee: matchedArea.deliveryFee,
      };

      // Build authoritative area snapshot from Last.app data
      resolvedAreaSnapshot = {
        id: matchedArea.id || null,
        name: matchedArea.name || null,
        deliveryFee: matchedArea.deliveryFee,
        minimumBasket: matchedArea.minimumBasket,
        estimatedDeliveryMinutes: matchedArea.estimatedDeliveryMinutes,
      };
    }

    // 5. Build and write OrderSession document
    const orderSessionId = randomUUID();
    const now = new Date().toISOString();

    const doc: OrderSessionDocument = {
      orderSessionId,
      tenantId: tenant.tenantId,
      locationKey: location.locationKey,
      channel: 'qr_order',
      orderMode: body.orderMode,
      paymentMode: body.paymentMode,
      operationalStatus: 'draft',
      paymentStatus: 'unpaid',
      lastSyncStatus: 'not_sent',
      items: body.items,
      totals: body.totals,
      lastDeliveryInput: resolvedDeliveryInput,
      lastDeliveryAreaSnapshot: resolvedAreaSnapshot,
      catalogId,
      lastApp: {
        organizationId: location.lastApp.organizationId,
        locationId: location.lastApp.locationId,
        brandId: location.lastApp.brandId,
      },
      createdAt: now,
      updatedAt: now,
    };

    await firestore
      .collection('tenants')
      .doc(tenant.tenantId)
      .collection('orderSessions')
      .doc(orderSessionId)
      .set(doc);

    return {
      orderSessionId,
      operationalStatus: doc.operationalStatus,
      paymentStatus: doc.paymentStatus,
      lastSyncStatus: doc.lastSyncStatus,
      totals: doc.totals,
      createdAt: doc.createdAt,
      ...(resolvedAreaSnapshot ? { deliveryArea: resolvedAreaSnapshot } : {}),
    };
  });

  // ── GET /api/order-sessions/:orderSessionId/last-payload-preview ──────────
  app.get('/api/order-sessions/:orderSessionId/last-payload-preview', async (request) => {
    const env = loadEnv();
    const firestore = getFirestoreDb(env);
    const repository = new FirestoreTenantRepository(firestore);

    const { orderSessionId } = request.params as { orderSessionId: string };
    const tenantSlug = asString((request.query as Record<string, unknown>).tenant);
    if (!tenantSlug) fail(400, 'tenant query param is required.');

    const tenant = await repository.findTenantBySlug(tenantSlug);
    if (!tenant) fail(404, 'Tenant not found.');

    const sessionSnap = await firestore
      .collection('tenants')
      .doc(tenant.tenantId)
      .collection('orderSessions')
      .doc(orderSessionId)
      .get();

    if (!sessionSnap.exists) fail(404, `OrderSession '${orderSessionId}' not found.`);
    const session = sessionSnap.data() as OrderSessionDocument;

    if (session.orderMode === 'table') {
      fail(422, 'Missing lastTableId for table order — cannot build Last payload until table is assigned.');
    }

    // Derive short codes from UUID (deterministic, digits-only for the numeric part)
    const digits = orderSessionId.replace(/[^0-9]/g, '');
    // Pad with repeating digits from UUID hex if not enough decimal digits
    const hexDigits = orderSessionId.replace(/-/g, '').replace(/[^0-9a-f]/gi, '');
    const numericSeed = digits.length >= 3
      ? digits
      : (digits + hexDigits.split('').map((c) => parseInt(c, 16).toString()).join('')).replace(/\D/g, '');
    const threeDigits = numericSeed.slice(0, 3).padStart(3, '0');

    const modePrefix: Record<OrderMode, string> = { table: 'Q', delivery: 'D', pickup: 'L' };
    const prefix = modePrefix[session.orderMode] ?? 'Q';
    const operationalCode = `${prefix}${threeDigits}`;   // e.g. D004, L543, Q123 — length 4
    const hex = orderSessionId.replace(/-/g, '').toUpperCase();
    const code = `QR${hex.slice(0, 6)}`;

    const preferredPaymentMethod = session.paymentMode === 'online' ? 'card' : 'cash';

    // Map items → Last products
    const products = session.items.map((item) => ({
      id: item.productId,
      name: item.productName,
      type: 'PRODUCT',
      quantity: item.quantity,
      price: item.unitPrice,
      ...(item.modifiers && item.modifiers.length > 0
        ? {
            modifiers: item.modifiers.map((mod) => ({
              id: mod.modifierId,
              name: mod.modifierName,
              quantity: mod.quantity,
              priceImpact: mod.unitPrice,
            })),
          }
        : {}),
    }));

    // Build Last delivery block — only confirmed Last OpenAPI fields
    const warnings: string[] = [];
    let deliveryBlock: Record<string, unknown> | undefined;

    if (session.orderMode === 'delivery') {
      const di = session.lastDeliveryInput;
      if (!di) {
        warnings.push('lastDeliveryInput is missing — delivery block cannot be built.');
      } else {
        const missingCoords = (di.latitude === 0 && di.longitude === 0);
        if (missingCoords) {
          warnings.push('Missing delivery coordinates — set latitude/longitude before sending to Last.');
        }
        // Only include Last-confirmed fields
        deliveryBlock = {
          address: di.address,
          ...(di.details ? { details: di.details } : {}),
          latitude: di.latitude,
          longitude: di.longitude,
          fee: di.fee,
          ...(di.comments ? { comments: di.comments } : {}),
          ...(di.external !== undefined ? { external: di.external } : {}),
          ...(di.needCutlery !== undefined ? { needCutlery: di.needCutlery } : {}),
        };
      }
    }

    const readyForLastSync = warnings.length === 0;

    const lastPayload: Record<string, unknown> = {
      brandId: session.lastApp.brandId,
      source: 'PideAhora QR',
      code,
      operationalCode,
      externalId: session.orderSessionId,
      preferredPaymentMethod,
      products,
      ...(deliveryBlock ? { delivery: deliveryBlock } : {}),
    };

    return {
      _preview: true,
      _readyForLastSync: readyForLastSync,
      ...(warnings.length > 0 ? { _warnings: warnings } : {}),
      _note: 'This payload is NOT sent to Last. Read-only preview for validation.',
      orderSessionId: session.orderSessionId,
      orderMode: session.orderMode,
      lastPayload,
    };
  });
}
