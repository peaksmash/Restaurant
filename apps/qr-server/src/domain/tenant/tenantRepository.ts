import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  TenantConfigResponse,
  TenantDocument,
  TenantLocationDocument,
  TenantBranding,
  TenantFeatures,
} from './tenantTypes.js';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

function fail(statusCode: number, message: string): never {
  const error = new Error(message) as ErrorWithStatusCode;
  error.statusCode = statusCode;
  throw error;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readNullableString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeBranding(value: unknown): TenantBranding {
  const record = asRecord(value);
  return {
    logoUrl: readNullableString(record.logoUrl),
    primaryColor: readNullableString(record.primaryColor),
    secondaryColor: readNullableString(record.secondaryColor),
  };
}

function normalizeFeatures(value: unknown): TenantFeatures {
  const record = asRecord(value);
  return {
    qrEnabled: readBoolean(record.qrEnabled, true),
    deliveryEnabled: readBoolean(record.deliveryEnabled, true),
    pickupEnabled: readBoolean(record.pickupEnabled, true),
    tableQrEnabled: readBoolean(record.tableQrEnabled, true),
  };
}

function normalizeTenantDocument(snapshot: QueryDocumentSnapshot): TenantDocument {
  const data = asRecord(snapshot.data());
  const orderWeb = asRecord(data.orderWeb);
  const lastApp = asRecord(data.lastApp);
  const online = asRecord(data.online);

  const tenantId = readString(data.tenantId) || snapshot.id;
  const tenantSlug = readString(data.tenantSlug);
  const displayName = readString(data.displayName);
  const hostname = readString(orderWeb.hostname).toLowerCase();
  const organizationId = readString(lastApp.organizationId);

  if (!tenantSlug || !displayName || !hostname || !organizationId) {
    fail(500, `Tenant document ${snapshot.ref.path} is incomplete.`);
  }

  return {
    tenantId,
    tenantSlug,
    displayName,
    orderWeb: {
      hostname,
    },
    lastApp: {
      organizationId,
    },
    online: {
      enabled: readBoolean(online.enabled, false),
    },
    branding: normalizeBranding(data.branding),
    features: normalizeFeatures(data.features),
  };
}

function normalizeLocationDocument(snapshot: QueryDocumentSnapshot): TenantLocationDocument {
  const data = asRecord(snapshot.data());
  const lastApp = asRecord(data.lastApp);
  const geo = asRecord(data.geo);
  const online = asRecord(data.online);
  const catalogsByChannel = asRecord(data.catalogsByChannel);

  const readCatalogId = (key: keyof TenantLocationDocument['catalogsByChannel']) => {
    const channelRecord = asRecord(catalogsByChannel[key]);
    return { catalogId: readNullableString(channelRecord.catalogId) };
  };

  const locationKey = readString(data.locationKey) || snapshot.id;
  const slug = readString(data.slug);
  const displayName = readString(data.displayName);
  const organizationId = readString(lastApp.organizationId);
  const locationId = readString(lastApp.locationId);
  const brandId = readString(lastApp.brandId);

  if (!locationKey || !slug || !displayName || !organizationId || !locationId || !brandId) {
    fail(500, `Location document ${snapshot.ref.path} is incomplete.`);
  }

  return {
    locationKey,
    slug,
    displayName,
    lastApp: {
      organizationId,
      locationId,
      brandId,
    },
    geo: {
      lat: readNullableNumber(geo.lat),
      lng: readNullableNumber(geo.lng),
    },
    catalogsByChannel: {
      kiosk: readCatalogId('kiosk'),
      qr_table: readCatalogId('qr_table'),
      qr_pickup: readCatalogId('qr_pickup'),
      qr_delivery: readCatalogId('qr_delivery'),
    },
    online: {
      enabled: readBoolean(online.enabled, false),
      deliveryEnabled: readBoolean(online.deliveryEnabled, false),
      pickupEnabled: readBoolean(online.pickupEnabled, false),
      tableQrEnabled: readBoolean(online.tableQrEnabled, false),
    },
    timezone: readNullableString(data.timezone),
  };
}

export class FirestoreTenantRepository {
  constructor(private readonly firestore: Firestore) {}

  async findTenantByHostname(hostname: string) {
    const snapshot = await this.firestore
      .collection('tenants')
      .where('orderWeb.hostname', '==', hostname)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return normalizeTenantDocument(snapshot.docs[0]);
  }

  async findTenantBySlug(tenantSlug: string) {
    const snapshot = await this.firestore
      .collection('tenants')
      .where('tenantSlug', '==', tenantSlug)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return normalizeTenantDocument(snapshot.docs[0]);
  }

  async listEnabledLocations(tenantId: string) {
    const snapshot = await this.firestore
      .collection('tenants')
      .doc(tenantId)
      .collection('locations')
      .where('online.enabled', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => normalizeLocationDocument(doc))
      .sort((left, right) => left.displayName.localeCompare(right.displayName, 'es'));
  }
}

export function buildTenantConfigResponse(
  tenant: TenantDocument,
  locations: TenantLocationDocument[],
): TenantConfigResponse {
  return {
    mode: 'resolved',
    tenant: {
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      displayName: tenant.displayName,
      hostname: tenant.orderWeb.hostname,
    },
    branding: tenant.branding,
    lastApp: {
      organizationId: tenant.lastApp.organizationId,
    },
    locations,
  };
}
