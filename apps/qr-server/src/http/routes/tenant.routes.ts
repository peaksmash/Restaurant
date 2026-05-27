import type { FastifyInstance, FastifyRequest } from 'fastify';
import { loadEnv } from '../../config/env.js';
import type { QrServerEnv } from '../../config/env.js';
import { getFirestoreDb } from '../../config/firebaseAdmin.js';
import { FirestoreTenantRepository } from '../../domain/tenant/tenantRepository.js';
import type { TenantDocument, TenantLocationDocument } from '../../domain/tenant/tenantTypes.js';
import { resolveTenantConfig } from '../../domain/tenant/tenantResolver.js';
import { getLocationDetail, getCatalogSummary } from '../../infrastructure/lastApp/lastAppClient.js';

// ─── Shared helpers ──────────────────────────────────────────────────────────

type OrderMode = 'table' | 'pickup' | 'delivery';

function fail(statusCode: number, message: string): never {
  const e = new Error(message) as Error & { statusCode?: number };
  e.statusCode = statusCode;
  throw e;
}

function resolveHost(request: FastifyRequest) {
  const forwardedHost = request.headers['x-forwarded-host'];
  const rawHost = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost ?? request.headers.host ?? '';
  return String(rawHost);
}

function getQueryString(request: FastifyRequest, key: string): string | undefined {
  if (typeof request.query !== 'object' || request.query === null) return undefined;
  const value = (request.query as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requireQueryString(request: FastifyRequest, key: string): string {
  const value = getQueryString(request, key);
  if (!value) fail(400, `Missing required query param: ${key}`);
  return value;
}

function requireOrderMode(raw: string | undefined): OrderMode {
  if (raw !== 'table' && raw !== 'pickup' && raw !== 'delivery') {
    fail(400, 'orderMode must be one of: table, pickup, delivery');
  }
  return raw;
}

function catalogIdForMode(location: TenantLocationDocument, orderMode: OrderMode): string {
  const channelMap = {
    table: location.catalogsByChannel.qr_table.catalogId,
    pickup: location.catalogsByChannel.qr_pickup.catalogId,
    delivery: location.catalogsByChannel.qr_delivery.catalogId,
  };
  const catalogId = channelMap[orderMode];
  if (!catalogId) {
    fail(404, `No catalogId configured for orderMode '${orderMode}' in location '${location.locationKey}'.`);
  }
  return catalogId;
}

async function resolveTenantAndLocation(
  env: QrServerEnv,
  tenantSlug: string,
  locationKey: string,
): Promise<{ tenant: TenantDocument; location: TenantLocationDocument }> {
  const firestore = getFirestoreDb(env);
  const repository = new FirestoreTenantRepository(firestore);

  const tenant = await repository.findTenantBySlug(tenantSlug);
  if (!tenant) fail(404, 'Tenant not found.');
  if (!tenant.online.enabled) fail(403, 'Tenant is disabled for online usage.');

  const locations = await repository.listEnabledLocations(tenant.tenantId);
  const location = locations.find((loc) => loc.locationKey === locationKey);
  if (!location) fail(404, `Location '${locationKey}' not found or not enabled.`);

  return { tenant, location };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function registerTenantRoutes(app: FastifyInstance) {
  // GET /api/tenant/config
  app.get('/api/tenant/config', async (request) => {
    const env = loadEnv();
    const firestore = getFirestoreDb(env);
    const repository = new FirestoreTenantRepository(firestore);
    const tenantSlug = getQueryString(request, 'tenant');

    return resolveTenantConfig(repository, {
      hostname: resolveHost(request),
      ...(tenantSlug ? { tenantSlug } : {}),
    });
  });

  // GET /api/tenant/location-detail
  app.get('/api/tenant/location-detail', async (request) => {
    const env = loadEnv();
    const tenantSlug = requireQueryString(request, 'tenant');
    const locationKey = requireQueryString(request, 'locationKey');

    const { tenant, location } = await resolveTenantAndLocation(env, tenantSlug, locationKey);

    const lastLocation = await getLocationDetail(
      env.lastApp,
      location.lastApp.organizationId,
      location.lastApp.locationId,
    );

    return {
      mode: 'resolved',
      tenant: { tenantId: tenant.tenantId, tenantSlug: tenant.tenantSlug },
      location: {
        locationKey: location.locationKey,
        slug: location.slug,
        displayName: location.displayName,
        lastApp: {
          organizationId: location.lastApp.organizationId,
          locationId: location.lastApp.locationId,
          brandId: location.lastApp.brandId,
        },
      },
      lastLocation,
    };
  });

  // GET /api/tenant/catalog
  app.get('/api/tenant/catalog', async (request) => {
    const env = loadEnv();
    const tenantSlug = requireQueryString(request, 'tenant');
    const locationKey = requireQueryString(request, 'locationKey');
    const orderMode = requireOrderMode(getQueryString(request, 'orderMode'));

    const { tenant, location } = await resolveTenantAndLocation(env, tenantSlug, locationKey);
    const catalogId = catalogIdForMode(location, orderMode);

    const catalogSummary = await getCatalogSummary(
      env.lastApp,
      location.lastApp.organizationId,
      location.lastApp.locationId,
      catalogId,
    );

    return {
      mode: 'resolved',
      tenant: { tenantId: tenant.tenantId, tenantSlug: tenant.tenantSlug },
      location: {
        locationKey: location.locationKey,
        lastApp: { locationId: location.lastApp.locationId, brandId: location.lastApp.brandId },
      },
      catalog: { ...catalogSummary, orderMode },
    };
  });

  // GET /api/tenant/bootstrap
  app.get('/api/tenant/bootstrap', async (request) => {
    const env = loadEnv();
    const tenantSlug = requireQueryString(request, 'tenant');
    const locationKey = requireQueryString(request, 'locationKey');
    const orderMode = requireOrderMode(getQueryString(request, 'orderMode'));

    const { tenant, location } = await resolveTenantAndLocation(env, tenantSlug, locationKey);
    const catalogId = catalogIdForMode(location, orderMode);

    // Fetch location detail + catalog in parallel
    const [lastLocation, catalogSummary] = await Promise.all([
      getLocationDetail(env.lastApp, location.lastApp.organizationId, location.lastApp.locationId),
      getCatalogSummary(env.lastApp, location.lastApp.organizationId, location.lastApp.locationId, catalogId),
    ]);

    return {
      mode: 'resolved',
      tenant: {
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        displayName: tenant.displayName,
        branding: tenant.branding,
        features: tenant.features,
      },
      location: {
        locationKey: location.locationKey,
        slug: location.slug,
        displayName: location.displayName,
        timezone: location.timezone,
        lastApp: {
          organizationId: location.lastApp.organizationId,
          locationId: location.lastApp.locationId,
          brandId: location.lastApp.brandId,
        },
        online: location.online,
      },
      lastLocation: {
        preparationMinutes: lastLocation.preparationMinutes,
        deliveryAreas: lastLocation.deliveryAreas,
        workingTimesKeys: lastLocation.workingTimesKeys,
        paymentMethods: lastLocation.paymentMethods,
        offlinePaymentMethods: lastLocation.offlinePaymentMethods,
      },
      catalog: { ...catalogSummary, orderMode },
    };
  });
}
