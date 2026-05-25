import type { FastifyInstance } from 'fastify';
import { readRuntimeConfig } from '../config.js';
import { getOrderSessionById } from '../db.js';
import {
  createOrFindLastCustomer,
  fetchLastCustomerById,
  fetchLastOrderStatusDetail,
  fetchLocation,
  HttpError,
  updateLastCustomerPoints,
} from '../last-app.js';

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return hasText(value) ? value.trim() : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function mapDeliveryArea(value: unknown) {
  const area = asRecord(value);
  if (!area) {
    return null;
  }

  return {
    id: readString(area.id) ?? readString(area.areaId),
    name: readString(area.name) ?? readString(area.label),
    type: readString(area.type) ?? null,
    fee: readNumber(area.fee),
    minimumBasket: readNumber(area.minimumBasket),
    estimatedDeliveryMinutes:
      readNumber(area.estimatedDeliveryMinutes) ??
      readNumber(area.estimatedDeliveryTimeMinutes),
    geometry: area.geometry ?? area.polygon ?? area.circle ?? null,
    enabled: area.enabled !== false,
  };
}

function extractLocationPayload(location: unknown) {
  const record = asRecord(location) ?? {};
  const address = asRecord(record.address);
  const deliveryConfig = asRecord(record.delivery);

  const deliveryAreas = [
    ...readArray(record.deliveryAreas),
    ...readArray(deliveryConfig?.areas),
  ]
    .map(mapDeliveryArea)
    .filter((item): item is NonNullable<ReturnType<typeof mapDeliveryArea>> => item != null);

  const paymentMethods = readArray(record.paymentMethods).map((method) => {
    const methodRecord = asRecord(method);
    return methodRecord ?? method;
  });

  return {
    id: readString(record.id) ?? readString(record.locationId),
    name: readString(record.name),
    address:
      readString(record.fullAddress) ??
      readString(address?.formatted) ??
      readString(address?.streetAddress) ??
      readString(record.address),
    lat:
      readNumber(record.lat) ??
      readNumber(record.latitude) ??
      readNumber(address?.lat) ??
      readNumber(address?.latitude),
    lng:
      readNumber(record.lng) ??
      readNumber(record.longitude) ??
      readNumber(address?.lng) ??
      readNumber(address?.longitude),
    deliveryAreas,
    paymentMethods,
    preparationMinutes:
      readNumber(record.preparationMinutes) ??
      readNumber(record.estimatedPreparationMinutes) ??
      readNumber(record.averagePreparationMinutes),
    horarios: record.horarios ?? record.openingHours ?? record.schedule ?? null,
  };
}

function normalizeStatuses(value: unknown) {
  return readArray(value).map((entry) => {
    const record = asRecord(entry);
    return record ?? { value: entry };
  });
}

function extractPoints(value: unknown): number {
  const record = asRecord(value);
  if (!record) {
    return 0;
  }

  return (
    readNumber(record.points) ??
    readNumber(record.availablePoints) ??
    readNumber(record.loyaltyPoints) ??
    0
  );
}

export function registerQrOrdersRoutes(app: FastifyInstance) {
  app.get('/api/location', async () => {
    const config = readRuntimeConfig();
    const location = await fetchLocation(config, config.lastApp.locationId);
    return extractLocationPayload(location);
  });

  app.get<{ Params: { id: string } }>('/api/orders/:id/status', async (request) => {
    const config = readRuntimeConfig();
    const maybeSession = getOrderSessionById(request.params.id);
    const tabId = maybeSession?.lastTabId ?? request.params.id;

    if (!hasText(tabId)) {
      throw new HttpError(404, 'Order tab not found', { code: 'last_tab_not_found' });
    }

    const status = await fetchLastOrderStatusDetail(config, tabId);
    const delivery = asRecord(status.delivery);

    return {
      status: readString(status.status) ?? 'CREATED',
      delivery: {
        courier: delivery?.courier ?? null,
        statuses: normalizeStatuses(delivery?.statuses),
      },
    };
  });

  app.post<{
    Body: {
      name?: string;
      phoneNumber?: string;
      email?: string;
      externalId?: string;
    };
  }>('/api/customers', async (request) => {
    const name = readString(request.body?.name);
    const phoneNumber = readString(request.body?.phoneNumber);

    if (!name) {
      throw new HttpError(400, 'Missing name', { missingFields: ['name'] });
    }

    if (!phoneNumber) {
      throw new HttpError(400, 'Missing phoneNumber', { missingFields: ['phoneNumber'] });
    }

    const config = readRuntimeConfig();
    return createOrFindLastCustomer(config, {
      name,
      phoneNumber,
      email: readString(request.body?.email) ?? undefined,
      externalId: readString(request.body?.externalId) ?? undefined,
    });
  });

  app.get<{ Params: { id: string } }>('/api/customers/:id/points', async (request) => {
    const config = readRuntimeConfig();
    const customer = await fetchLastCustomerById(config, request.params.id);

    return {
      id: readString(customer.id) ?? request.params.id,
      points: extractPoints(customer),
      customer,
    };
  });

  app.put<{
    Params: { id: string };
    Body: { points?: number; concept?: string };
  }>('/api/customers/:id/points', async (request) => {
    const points = request.body?.points;
    const concept = readString(request.body?.concept);

    if (typeof points !== 'number' || !Number.isFinite(points)) {
      throw new HttpError(400, 'Invalid points', { field: 'points' });
    }

    if (!concept) {
      throw new HttpError(400, 'Missing concept', { missingFields: ['concept'] });
    }

    const config = readRuntimeConfig();
    return updateLastCustomerPoints(config, request.params.id, { points, concept });
  });
}
