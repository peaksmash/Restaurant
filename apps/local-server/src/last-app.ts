import {
  createOrderEvent,
  createOrderRecord,
  getCatalogCache,
  saveCatalogCache,
  updateOrderRecord
} from './db.js';
import type { RuntimeConfig } from './config.js';
import {
  LastApiError,
  buildLastHeaders,
  readResponseBody,
  requestLastJson
} from '@kiosk/last-app';

const LAST_APP_BASE_URL = 'https://api.last.app/v2';

export interface OrderModifierInput {
  id: string;
  name: string;
  priceImpact: number;
  quantity?: number;
}

export interface OrderCustomerInput {
  name?: string;
  surname?: string;
  phoneNumber?: string;
  email?: string;
}

export interface OrderItemInput {
  productId?: string;
  id?: string;
  name: string;
  price: number;
  quantity: number;
  type: 'PRODUCT' | 'COMBO';
  comments?: string;
  promotionId?: string;
  promotion?: {
    id: string;
    name?: string;
    discountType?: string;
    discountAmount?: number;
    label?: string;
  };
  modifiers?: OrderModifierInput[];
}

export interface CreateOrderPayload {
  orderMode?: 'eatIn' | 'takeAway' | 'delivery';
  customer?: OrderCustomerInput;
  items: OrderItemInput[];
  notes?: string;
  source?: string;
  operationalCode?: string;
  tableId?: string;
  preferredPaymentMethod?: string;
  payments?: Array<{
    method: string;
    paidAmount: number;
  }>;
  discount?: {
    type: 'currency' | 'percentage';
    amount: number;
  };
}

export interface SetupAutoPayload {
  organizationId: string;
  locationId: string;
}

export interface SetupSelectionPayload {
  organizationId?: string;
  locationId?: string;
  brandId?: string;
  catalogId?: string;
}

interface LastBrand {
  id?: string;
  name?: string;
  catalogs?: Record<string, string | undefined> | { default?: string };
  fullCatalogs?: {
    default?: {
      onsiteCatalogId?: string;
      takeawayCatalogId?: string;
      deliveryCatalogId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface LastLocation {
  id?: string;
  name?: string;
  brands?: LastBrand[];
  [key: string]: unknown;
}

export interface LastTable {
  id: string;
  name: string;
  min?: number | null;
  max?: number | null;
  seats?: number | null;
  flatFeeSurcharge?: number | null;
}

export interface LastFloorplan {
  id: string;
  name: string;
  locationId: string;
  tables: LastTable[];
}

export type LastOrderStatusValue =
  | 'CREATED'
  | 'KITCHEN'
  | 'READY_TO_PICKUP'
  | 'ON_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'CLOSED';

export interface LastTabListItem {
  id: string;
  name?: string | null;
  creationTime?: string | null;
  activationTime?: string | null;
  closeTime?: string | null;
  cancelTime?: string | null;
  source?: string | null;
  tableName?: string | null;
  code?: string | null;
  pickupType?: string | null;
  schedulingTime?: string | null;
  pickupTime?: string | null;
  customerId?: string | null;
  customerNote?: string | null;
  kitchenNote?: string | null;
  externalId?: string | null;
}

export interface LastTabProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  comments?: string | null;
  finalPrice?: number | null;
  type?: 'PRODUCT' | 'COMBO' | null;
  modifiers: Array<{
    id?: string | null;
    name: string;
    priceImpact: number;
    quantity: number;
  }>;
}

export interface LastTabDetail extends LastTabListItem {
  customerInfo?: {
    name?: string | null;
    surname?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
  } | null;
  products: LastTabProduct[];
  delivery?: {
    address?: string | null;
    details?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    courier?: {
      name?: string | null;
      id?: string | null;
    } | null;
  } | null;
  employeeName?: string | null;
  waiters?: string[] | null;
  total?: number | null;
  bills?: Array<{
    total?: number | null;
  }> | null;
}

export interface LastCustomerRecord {
  id?: string;
  externalId?: string | null;
  name?: string | null;
  surname?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  points?: number | null;
  [key: string]: unknown;
}

export interface CreateOrFindCustomerPayload {
  name: string;
  phoneNumber: string;
  email?: string;
  externalId?: string;
}

interface LastPromotion {
  id?: string;
  organizationId?: string;
  name?: string;
  description?: string;
  discountType?: string;
  discountAmount?: number | null;
  startTime?: string;
  endTime?: string;
  enabled?: boolean;
  availableInShop?: boolean;
  availableInPos?: boolean;
  products?: string[];
  categories?: string[];
  customers?: string[];
  locations?: string[];
  weekdays?: string[];
  [key: string]: unknown;
}

interface PromotionSummary {
  id: string;
  name: string;
  discountType: string;
  discountAmount: number;
  label: string;
}

interface CatalogProductWithPromotion extends Record<string, unknown> {
  id?: string;
  organizationProductId?: string;
  externalId?: string;
  price?: number;
  promotion?: PromotionSummary;
  displayPrice?: number;
}

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toLastClientConfig(config: RuntimeConfig) {
  return {
    token: config.lastApp.token,
    locationId: config.lastApp.locationId,
    organizationId: config.lastApp.organizationId
  };
}

function assertToken(config: RuntimeConfig) {
  if (!config.lastApp.token) {
    throw new HttpError(400, 'Missing Last.app token', {
      missingFields: ['LAST_TOKEN']
    });
  }
}

function assertLastAppConfig(config: RuntimeConfig) {
  const missingFields = [
    ['LAST_TOKEN', config.lastApp.token],
    ['organizationId', config.lastApp.organizationId],
    ['locationId', config.lastApp.locationId],
    ['brandId', config.lastApp.brandId],
    ['catalogId', config.lastApp.catalogId]
  ].filter(([, value]) => !value);

  if (missingFields.length > 0) {
    throw new HttpError(400, 'Missing Last.app configuration fields', {
      missingFields: missingFields.map(([field]) => field)
    });
  }
}

async function requestLastData<T>(
  config: RuntimeConfig,
  path: string,
  init: {
    method: string;
    body?: unknown;
    headers?: {
      locationId?: string;
      organizationId?: string;
      includeContentType?: boolean;
    };
  }
): Promise<T> {
  try {
    const result = await requestLastJson<T>(toLastClientConfig(config), path, init);
    return result as T;
  } catch (error) {
    if (error instanceof LastApiError) {
      throw new HttpError(error.status, 'Last API error', {
        status: error.status,
        lastError: (() => {
          try {
            return JSON.parse(error.body);
          } catch {
            return error.body || null;
          }
        })()
      });
    }

    throw error;
  }
}

function extractCatalogsFromBrand(brand: LastBrand) {
  const catalogs: Array<{ id: string; name: string; type: string; source: string }> = [];
  const seen = new Set<string>();

  const addCatalog = (id: unknown, name: string, type: string, source: string) => {
    if (!hasText(id) || seen.has(id)) {
      return;
    }

    seen.add(id);
    catalogs.push({ id, name, type, source });
  };

  addCatalog(brand.fullCatalogs?.default?.onsiteCatalogId, 'Onsite catalog', 'onsite', 'fullCatalogs.default.onsiteCatalogId');
  addCatalog(brand.fullCatalogs?.default?.takeawayCatalogId, 'Takeaway catalog', 'takeAway', 'fullCatalogs.default.takeawayCatalogId');
  addCatalog(brand.fullCatalogs?.default?.deliveryCatalogId, 'Delivery catalog', 'delivery', 'fullCatalogs.default.deliveryCatalogId');
  addCatalog((brand.catalogs as { default?: string } | undefined)?.default, 'Default catalog', 'default', 'catalogs.default');

  return catalogs;
}

function getCatalogIdFromBrand(brand: LastBrand) {
  return (
    brand.fullCatalogs?.default?.onsiteCatalogId ||
    brand.fullCatalogs?.default?.takeawayCatalogId ||
    (brand.catalogs as { default?: string } | undefined)?.default ||
    ''
  );
}

function normalizeBrands(location: LastLocation | null) {
  if (!location || !Array.isArray(location.brands)) {
    return [];
  }

  return location.brands.map((brand) => ({
    id: brand.id ?? '',
    name: brand.name ?? '',
    catalogs: extractCatalogsFromBrand(brand)
  }));
}

function normalizeLastTable(value: unknown): LastTable | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!hasText(record.id) || !hasText(record.name)) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    min: typeof record.min === 'number' ? record.min : null,
    max: typeof record.max === 'number' ? record.max : null,
    seats: typeof record.seats === 'number' ? record.seats : null,
    flatFeeSurcharge: typeof record.flatFeeSurcharge === 'number' ? record.flatFeeSurcharge : null
  };
}

function normalizeLastFloorplan(value: unknown): LastFloorplan | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!hasText(record.id) || !hasText(record.name) || !hasText(record.locationId)) {
    return null;
  }

  const rawTables = Array.isArray(record.tables) ? record.tables : [];
  const tables = rawTables
    .map(normalizeLastTable)
    .filter((table): table is LastTable => table !== null);

  return {
    id: record.id,
    name: record.name,
    locationId: record.locationId,
    tables
  };
}

export function extractTablesFromFloorplans(floorplans: LastFloorplan[]) {
  return floorplans.flatMap((floorplan) =>
    floorplan.tables.map((table) => ({
      ...table,
      floorplanId: floorplan.id,
      floorplanName: floorplan.name
    }))
  );
}

export function findLastTableById(floorplans: LastFloorplan[], lastTableId: string) {
  return extractTablesFromFloorplans(floorplans).find((table) => table.id === lastTableId) ?? null;
}

export async function fetchOrganizations(config: RuntimeConfig) {
  assertToken(config);

  return requestLastData<unknown[]>(config, '/organizations', {
    method: 'GET',
    headers: {
      includeContentType: true
    }
  });
}

export async function fetchLocations(config: RuntimeConfig, organizationId: string) {
  assertToken(config);

  if (!hasText(organizationId)) {
    throw new HttpError(400, 'Missing organizationId', {
      missingFields: ['organizationId']
    });
  }

  return requestLastData<unknown[]>(config, `/locations?organizationId=${encodeURIComponent(organizationId)}`, {
    method: 'GET',
    headers: {
      organizationId,
      includeContentType: true
    }
  });
}

export async function fetchLocation(config: RuntimeConfig, locationId: string) {
  assertToken(config);

  if (!hasText(locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  return requestLastData<LastLocation>(config, `/locations/${encodeURIComponent(locationId)}`, {
    method: 'GET',
    headers: {
      locationId,
      includeContentType: true
    }
  });
}

export async function fetchFloorplans(config: RuntimeConfig) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  const data = await requestLastData<unknown[]>(
    config,
    `/floorplans?locationId=${encodeURIComponent(config.lastApp.locationId)}`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(normalizeLastFloorplan)
    .filter((floorplan): floorplan is LastFloorplan => floorplan !== null);
}

export async function fetchLastTabs(
  config: RuntimeConfig,
  options?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    open?: boolean;
  }
) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const defaultEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();
  const limit = Math.min(Math.max(options?.limit ?? 50, 5), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  const query = new URLSearchParams({
    locationId: config.lastApp.locationId,
    startDate: options?.startDate ?? defaultStart,
    endDate: options?.endDate ?? defaultEnd,
    limit: String(limit),
    offset: String(offset)
  });

  if (typeof options?.open === 'boolean') {
    query.set('open', String(options.open));
  }

  return requestLastData<LastTabListItem[]>(
    config,
    `/tabs?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

export async function fetchLastTabById(config: RuntimeConfig, tabId: string) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  if (!hasText(tabId)) {
    throw new HttpError(400, 'Missing tabId', {
      missingFields: ['tabId']
    });
  }

  return requestLastData<LastTabDetail>(
    config,
    `/tabs/${encodeURIComponent(tabId)}`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

export async function fetchLastOrderStatus(config: RuntimeConfig, tabId: string) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  if (!hasText(tabId)) {
    throw new HttpError(400, 'Missing tabId', {
      missingFields: ['tabId']
    });
  }

  return requestLastData<{ status: LastOrderStatusValue }>(
    config,
    `/orders/${encodeURIComponent(tabId)}/status`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

export async function fetchLastOrderStatusDetail(config: RuntimeConfig, tabId: string) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  if (!hasText(tabId)) {
    throw new HttpError(400, 'Missing tabId', {
      missingFields: ['tabId']
    });
  }

  return requestLastData<{
    status: LastOrderStatusValue;
    delivery?: {
      courier?: unknown;
      statuses?: unknown[];
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  }>(
    config,
    `/orders/${encodeURIComponent(tabId)}/status`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

async function findLastCustomerByPhone(config: RuntimeConfig, phoneNumber: string) {
  assertToken(config);

  const normalizedPhone = phoneNumber.trim();
  if (!normalizedPhone) {
    return null;
  }

  const query = new URLSearchParams({ phoneNumber: normalizedPhone });
  if (hasText(config.lastApp.organizationId)) {
    query.set('organizationId', config.lastApp.organizationId);
  }
  if (hasText(config.lastApp.locationId)) {
    query.set('locationId', config.lastApp.locationId);
  }

  try {
    const response = await requestLastData<unknown>(
      config,
      `/customers?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          locationId: config.lastApp.locationId,
          organizationId: config.lastApp.organizationId,
          includeContentType: true
        }
      }
    );

    const customers = Array.isArray(response)
      ? response
      : Array.isArray((response as { items?: unknown[] } | null | undefined)?.items)
        ? ((response as { items?: unknown[] }).items ?? [])
        : [];

    return (
      customers.find((value) => {
        const customer = value as LastCustomerRecord;
        return hasText(customer.phoneNumber) && customer.phoneNumber.trim() === normalizedPhone;
      }) as LastCustomerRecord | undefined
    ) ?? null;
  } catch (error) {
    if (error instanceof HttpError && (error.statusCode === 404 || error.statusCode === 405)) {
      return null;
    }
    throw error;
  }
}

export async function createOrFindLastCustomer(
  config: RuntimeConfig,
  payload: CreateOrFindCustomerPayload
) {
  assertToken(config);

  const normalizedPayload = {
    name: payload.name.trim(),
    phoneNumber: payload.phoneNumber.trim(),
    ...(hasText(payload.email) ? { email: payload.email.trim() } : {}),
    ...(hasText(payload.externalId) ? { externalId: payload.externalId.trim() } : {})
  };

  const existing = await findLastCustomerByPhone(config, normalizedPayload.phoneNumber);
  if (existing) {
    return existing;
  }

  try {
    return await requestLastData<LastCustomerRecord>(
      config,
      '/customers',
      {
        method: 'POST',
        body: normalizedPayload,
        headers: {
          locationId: config.lastApp.locationId,
          organizationId: config.lastApp.organizationId,
          includeContentType: true
        }
      }
    );
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 409) {
      const conflictExisting = await findLastCustomerByPhone(config, normalizedPayload.phoneNumber);
      if (conflictExisting) {
        return conflictExisting;
      }
    }
    throw error;
  }
}

export async function fetchLastCustomerById(config: RuntimeConfig, customerId: string) {
  assertToken(config);

  if (!hasText(customerId)) {
    throw new HttpError(400, 'Missing customerId', {
      missingFields: ['customerId']
    });
  }

  return requestLastData<LastCustomerRecord>(
    config,
    `/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'GET',
      headers: {
        locationId: config.lastApp.locationId,
        organizationId: config.lastApp.organizationId,
        includeContentType: true
      }
    }
  );
}

export async function updateLastCustomerPoints(
  config: RuntimeConfig,
  customerId: string,
  payload: { points: number; concept: string }
) {
  assertToken(config);

  if (!hasText(customerId)) {
    throw new HttpError(400, 'Missing customerId', {
      missingFields: ['customerId']
    });
  }

  return requestLastData<LastCustomerRecord>(
    config,
    `/customers/${encodeURIComponent(customerId)}/update-points`,
    {
      method: 'PUT',
      body: {
        points: payload.points,
        concept: payload.concept.trim()
      },
      headers: {
        locationId: config.lastApp.locationId,
        organizationId: config.lastApp.organizationId,
        includeContentType: true
      }
    }
  );
}

export async function updateLastOrderStatus(
  config: RuntimeConfig,
  tabId: string,
  newStatus: LastOrderStatusValue
) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  if (!hasText(tabId)) {
    throw new HttpError(400, 'Missing tabId', {
      missingFields: ['tabId']
    });
  }

  return requestLastData<{ status: LastOrderStatusValue }>(
    config,
    `/orders/${encodeURIComponent(tabId)}/status`,
    {
      method: 'PUT',
      body: {
        newStatus
      },
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

export async function cancelLastOrder(
  config: RuntimeConfig,
  tabId: string,
  errorMessage = 'Cancelled manually from orders'
) {
  assertToken(config);

  if (!hasText(config.lastApp.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  if (!hasText(tabId)) {
    throw new HttpError(400, 'Missing tabId', {
      missingFields: ['tabId']
    });
  }

  return requestLastData<unknown>(
    config,
    `/orders/${encodeURIComponent(tabId)}/cancel`,
    {
      method: 'POST',
      body: {
        errorMessage
      },
      headers: {
        locationId: config.lastApp.locationId,
        includeContentType: true
      }
    }
  );
}

export async function fetchCatalog(config: RuntimeConfig) {
  const snapshot = await fetchCatalogSnapshot(config);

  return {
    fromCache: snapshot.fromCache,
    categories: snapshot.categories,
    modifierGroups: snapshot.modifierGroups
  };
}

async function fetchCatalogSnapshot(config: RuntimeConfig) {
  assertLastAppConfig(config);

  try {
    const response = await fetch(`${LAST_APP_BASE_URL}/catalogs/${config.lastApp.catalogId}`, {
      method: 'GET',
      headers: buildLastHeaders(toLastClientConfig(config), {
        locationId: config.lastApp.locationId
      })
    });

    if (!response.ok) {
      throw new HttpError(response.status, 'Last API error', {
        status: response.status,
        lastError: await readResponseBody(response)
      });
    }

    const rawText = await response.text();
    saveCatalogCache(config.lastApp.catalogId, rawText);
    const catalog = JSON.parse(rawText) as Record<string, unknown>;

    return {
      catalogId: config.lastApp.catalogId,
      catalogName: hasText(catalog.name) ? catalog.name : '',
      fromCache: false,
      categories: Array.isArray(catalog.categories) ? catalog.categories : [],
      modifierGroups: Array.isArray(catalog.modifierGroups) ? catalog.modifierGroups : [],
      raw: catalog
    };
  } catch (error) {
    const cache = getCatalogCache(config.lastApp.catalogId);

    if (cache) {
      const cached = JSON.parse(cache.rawJson) as Record<string, unknown>;
      return {
        catalogId: config.lastApp.catalogId,
        catalogName: hasText(cached.name) ? cached.name : '',
        fromCache: true,
        categories: Array.isArray(cached.categories) ? cached.categories : [],
        modifierGroups: Array.isArray(cached.modifierGroups) ? cached.modifierGroups : [],
        raw: cached
      };
    }

    throw error;
  }
}

function getProductImageUrl(product: Record<string, unknown>) {
  if (hasText(product.imageUrl)) {
    return product.imageUrl;
  }

  const image = product.image;
  if (image && typeof image === 'object' && hasText((image as { url?: unknown }).url)) {
    return (image as { url: string }).url;
  }

  const images = product.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      if (item && typeof item === 'object' && hasText((item as { url?: unknown }).url)) {
        return (item as { url: string }).url;
      }
    }
  }

  if (hasText(product.photoUrl)) {
    return product.photoUrl;
  }

  return null;
}

function getProductModifierGroupsCount(product: Record<string, unknown>) {
  if (Array.isArray(product.modifierGroups)) {
    return product.modifierGroups.length;
  }

  if (Array.isArray(product.modifiersGroups)) {
    return product.modifiersGroups.length;
  }

  return 0;
}

export async function fetchCatalogDiagnostics(config: RuntimeConfig) {
  const snapshot = await fetchCatalogSnapshot(config);
  const categories = snapshot.categories.map((category) => {
    const record = category as Record<string, unknown>;
    const products = Array.isArray(record.products) ? record.products : [];

    return {
      id: hasText(record.id) ? record.id : '',
      name: hasText(record.name) ? record.name : '',
      enabled: record.enabled !== false,
      productsCount: products.length
    };
  });

  const products = snapshot.categories.flatMap((category) => {
    const categoryRecord = category as Record<string, unknown>;
    const categoryName = hasText(categoryRecord.name) ? categoryRecord.name : '';
    const items = Array.isArray(categoryRecord.products) ? categoryRecord.products : [];

    return items.map((product) => {
      const record = product as Record<string, unknown>;
      const imageUrl = getProductImageUrl(record);
      const modifierGroupsCount = getProductModifierGroupsCount(record);

      return {
        id: hasText(record.id) ? record.id : '',
        name: hasText(record.name) ? record.name : '',
        price: typeof record.price === 'number' ? record.price : 0,
        enabled: record.enabled !== false,
        categoryName,
        imageUrl,
        hasImage: Boolean(imageUrl),
        modifierGroupsCount,
        externalId: hasText(record.externalId) ? record.externalId : '',
        organizationProductId: hasText(record.organizationProductId) ? record.organizationProductId : ''
      };
    });
  });

  const productsCount = products.length;
  const productsWithImageCount = products.filter((product) => product.hasImage).length;
  const productsWithoutImageCount = productsCount - productsWithImageCount;
  const productsWithModifiersCount = products.filter((product) => product.modifierGroupsCount > 0).length;
  const disabledProductsCount = products.filter((product) => !product.enabled).length;
  const warnings: string[] = [];

  if (productsCount === 0) {
    warnings.push('El catálogo seleccionado no tiene productos asignados.');
  }

  if (productsWithoutImageCount > 0) {
    warnings.push('Hay productos sin imagen.');
  }

  if (disabledProductsCount > 0) {
    warnings.push('Hay productos deshabilitados.');
  }

  if (categories.length === 0) {
    warnings.push('El catálogo no tiene categorías.');
  }

  return {
    catalogId: snapshot.catalogId,
    catalogName: snapshot.catalogName,
    fromCache: snapshot.fromCache,
    categoriesCount: categories.length,
    productsCount,
    modifierGroupsCount: snapshot.modifierGroups.length,
    productsWithImageCount,
    productsWithoutImageCount,
    productsWithModifiersCount,
    disabledProductsCount,
    categories,
    products,
    warnings
  };
}

function isPromotionActive(promotion: LastPromotion, now: Date) {
  if (promotion.enabled === false) {
    return false;
  }

  const hasShopFlag = typeof promotion.availableInShop === 'boolean';
  const hasPosFlag = typeof promotion.availableInPos === 'boolean';

  if ((hasShopFlag || hasPosFlag) && !promotion.availableInShop && !promotion.availableInPos) {
    return false;
  }

  if (hasText(promotion.startTime)) {
    const start = new Date(promotion.startTime);

    if (!Number.isNaN(start.valueOf()) && now < start) {
      return false;
    }
  }

  if (hasText(promotion.endTime)) {
    const end = new Date(promotion.endTime);

    if (!Number.isNaN(end.valueOf()) && now > end) {
      return false;
    }
  }

  return true;
}

function normalizePromotionsResponse(data: unknown) {
  if (Array.isArray(data)) {
    return data as LastPromotion[];
  }

  if (data && typeof data === 'object' && Array.isArray((data as { promotions?: unknown[] }).promotions)) {
    return (data as { promotions: LastPromotion[] }).promotions;
  }

  return [];
}

async function fetchPromotionDetails(config: RuntimeConfig, promotionId: string) {
  return requestLastJson<LastPromotion>(
    toLastClientConfig(config),
    `/promotions/${encodeURIComponent(promotionId)}`,
    {
      method: 'GET',
      headers: {
        organizationId: config.lastApp.organizationId,
        includeContentType: true
      }
    }
  );
}

function normalizePromotion(promotion: LastPromotion) {
  return {
    id: promotion.id ?? '',
    name: promotion.name ?? '',
    enabled: promotion.enabled ?? true,
    discountType: promotion.discountType ?? '',
    discountAmount: promotion.discountAmount ?? 0,
    startTime: promotion.startTime ?? null,
    endTime: promotion.endTime ?? null,
    products: Array.isArray(promotion.products) ? promotion.products : [],
    categories: Array.isArray(promotion.categories) ? promotion.categories : [],
    customers: Array.isArray(promotion.customers) ? promotion.customers : [],
    locations: Array.isArray(promotion.locations) ? promotion.locations : [],
    weekdays: Array.isArray(promotion.weekdays) ? promotion.weekdays : [],
    availableInShop: promotion.availableInShop ?? null,
    availableInPos: promotion.availableInPos ?? null,
    raw: promotion
  };
}

function buildPromotionLabel(discountType: string, discountAmount: number) {
  if (discountType === '2x1') {
    return '2x1';
  }

  if (discountType === 'percentage') {
    return `-${discountAmount}%`;
  }

  if (discountType === 'currency') {
    return `-${discountAmount}`;
  }

  return discountType;
}

function calculateDisplayPrice(price: number, discountType: string, discountAmount: number) {
  if (discountType === 'percentage') {
    return Math.max(Math.round(price * (1 - discountAmount / 100)), 0);
  }

  if (discountType === 'currency') {
    return Math.max(price - discountAmount, 0);
  }

  if (discountType === '2x1') {
    return price;
  }

  return price;
}

function matchesPromotion(promotion: LastPromotion, categoryId: string | undefined, product: CatalogProductWithPromotion) {
  const promoProducts = Array.isArray(promotion.products) ? promotion.products : [];
  const promoCategories = Array.isArray(promotion.categories) ? promotion.categories : [];
  const hasExplicitTargets = promoProducts.length > 0 || promoCategories.length > 0;

  if (!hasExplicitTargets) {
    return false;
  }

  const productMatch =
    (hasText(product.id) && promoProducts.includes(product.id as string)) ||
    (hasText(product.organizationProductId) && promoProducts.includes(product.organizationProductId as string)) ||
    (hasText(product.externalId) && promoProducts.includes(product.externalId as string));

  const categoryMatch = hasText(categoryId) && promoCategories.includes(categoryId as string);

  return productMatch || categoryMatch;
}

function choosePromotionForProduct(promotions: LastPromotion[], categoryId: string | undefined, product: CatalogProductWithPromotion) {
  if (!hasText(product.id) || typeof product.price !== 'number') {
    return null;
  }

  const matches: Array<{ promotion: PromotionSummary; displayPrice: number }> = [];

  for (const promotion of promotions) {
    if (!matchesPromotion(promotion, categoryId, product)) {
      continue;
    }

    const discountType = hasText(promotion.discountType) ? promotion.discountType : '';
    const discountAmount = typeof promotion.discountAmount === 'number' ? promotion.discountAmount : 0;
    const displayPrice = calculateDisplayPrice(product.price, discountType, discountAmount);

    matches.push({
      promotion: {
        id: promotion.id ?? '',
        name: promotion.name ?? '',
        discountType,
        discountAmount,
        label: buildPromotionLabel(discountType, discountAmount)
      },
      displayPrice
    });
  }

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    console.warn(
      `[promotions] product ${product.id as string} matched ${matches.length} promotions — using first (${matches[0].promotion.name}); others: ${matches
        .slice(1)
        .map((m) => m.promotion.name)
        .join(', ')}`
    );
  }

  return matches[0];
}

async function fetchActivePromotions(config: RuntimeConfig): Promise<LastPromotion[]> {
  assertToken(config);

  if (!hasText(config.lastApp.organizationId)) {
    throw new HttpError(400, 'Missing organizationId', {
      missingFields: ['organizationId']
    });
  }

  const data = await requestLastJson<{ promotions?: LastPromotion[] } | LastPromotion[]>(
    toLastClientConfig(config),
    `/promotions?organizationId=${encodeURIComponent(config.lastApp.organizationId)}`,
    {
      method: 'GET',
      headers: {
        organizationId: config.lastApp.organizationId,
        includeContentType: true
      }
    }
  );

  const simplePromotions = normalizePromotionsResponse(data);

  const completePromotions = await Promise.all(
    simplePromotions.map(async (promotion) => {
      if (!hasText(promotion.id)) {
        return promotion;
      }

      try {
        return await fetchPromotionDetails(config, promotion.id);
      } catch (error) {
        console.warn(
          `[promotions] failed to fetch detail for promotion ${promotion.id} (${promotion.name ?? 'unknown'})`,
          error instanceof Error ? error.message : String(error)
        );
        return promotion;
      }
    })
  );

  const now = new Date();
  return completePromotions.filter((promotion) => isPromotionActive(promotion, now));
}

export async function fetchPromotions(config: RuntimeConfig) {
  const active = await fetchActivePromotions(config);

  return active.map(normalizePromotion);
}

export async function fetchCatalogWithPromotions(config: RuntimeConfig) {
  const catalog = await fetchCatalog(config);

  let promotions: LastPromotion[] = [];
  let promotionsError = false;

  try {
    promotions = await fetchActivePromotions(config);
  } catch (err) {
    promotionsError = true;
    console.warn(
      '[promotions] failed to fetch promotions — returning catalog without enrichment:',
      err instanceof Error ? err.message : String(err)
    );
  }

  if (promotionsError) {
    return {
      fromCache: catalog.fromCache ?? false,
      categories: catalog.categories,
      modifierGroups: catalog.modifierGroups ?? [],
      promotionsError: true
    };
  }

  let enrichedCount = 0;

  const categories = (catalog.categories ?? []).map((category) => {
    const categoryRecord = category as Record<string, unknown>;
    const categoryId = hasText(categoryRecord.id) ? (categoryRecord.id as string) : undefined;
    const products = Array.isArray(categoryRecord.products) ? categoryRecord.products : [];

    return {
      ...categoryRecord,
      products: products.map((product) => {
        const productRecord = { ...(product as CatalogProductWithPromotion) };
        const matched = choosePromotionForProduct(promotions, categoryId, productRecord);

        if (!matched) {
          return productRecord;
        }

        enrichedCount++;
        return {
          ...productRecord,
          promotion: matched.promotion,
          displayPrice: matched.displayPrice
        };
      })
    };
  });


  return {
    fromCache: catalog.fromCache ?? false,
    categories,
    modifierGroups: catalog.modifierGroups ?? [],
    promotions: promotions.map(normalizePromotion)
  };
}

export function generateOrderCode() {
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  return `KIOSK-${randomNumber}`;
}

function buildOperationalCode(orderCode: string) {
  return orderCode.replace('KIOSK-', '').slice(-4);
}

function validateOrderNotes(notes?: string) {
  if (typeof notes === 'string' && notes.length > 200) {
    throw new HttpError(400, 'Order notes must be 200 characters or less');
  }
}

function getEffectiveOrderMode(config: RuntimeConfig, requestedMode?: CreateOrderPayload['orderMode']) {
  if (requestedMode === 'eatIn' || requestedMode === 'delivery' || requestedMode === 'takeAway') {
    return requestedMode;
  }

  if (config.kiosk.defaultOrderMode === 'eatIn' || config.kiosk.defaultOrderMode === 'delivery') {
    return config.kiosk.defaultOrderMode;
  }

  if (config.kiosk.pickupType === 'delivery') {
    return 'delivery';
  }

  if (config.kiosk.pickupType === 'onsite' || config.kiosk.pickupType === 'eatIn') {
    return 'eatIn';
  }

  return 'takeAway';
}

function validateCustomerFields(config: RuntimeConfig, customer?: OrderCustomerInput) {
  const missingFields: string[] = [];

  if (config.kiosk.customerFields.name.enabled && config.kiosk.customerFields.name.required && !hasText(customer?.name)) {
    missingFields.push('customer.name');
  }

  if (
    config.kiosk.customerFields.phoneNumber.enabled &&
    config.kiosk.customerFields.phoneNumber.required &&
    !hasText(customer?.phoneNumber)
  ) {
    missingFields.push('customer.phoneNumber');
  }

  if (config.kiosk.customerFields.email.enabled && config.kiosk.customerFields.email.required && !hasText(customer?.email)) {
    missingFields.push('customer.email');
  }

  if (missingFields.length > 0) {
    throw new HttpError(400, 'Missing required customer fields', {
      missingFields
    });
  }
}

function mapOrderCustomer(customer?: OrderCustomerInput) {
  if (!customer) {
    return undefined;
  }

  const mapped = {
    ...(hasText(customer.name) ? { name: customer.name.trim() } : {}),
    ...(hasText(customer.surname) ? { surname: customer.surname.trim() } : {}),
    ...(hasText(customer.phoneNumber) ? { phoneNumber: customer.phoneNumber.trim() } : {}),
    ...(hasText(customer.email) ? { email: customer.email.trim() } : {})
  };

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function resolvePromotionId(item: OrderItemInput) {
  if (item.promotionId !== undefined) {
    return item.promotionId;
  }

  return item.promotion?.id;
}

function mapOrderProducts(items: OrderItemInput[], config: RuntimeConfig) {
  return items.map((item) => {
    const promotionId = resolvePromotionId(item);

    return {
      id: item.productId ?? item.id ?? '',
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      type: item.type,
      ...(config.kiosk.notes.productCommentsEnabled && hasText(item.comments) ? { comments: item.comments.trim() } : {}),
      ...(hasText(promotionId) ? { promotionId: promotionId.trim() } : {}),
      ...(config.kiosk.features.modifiers
        ? {
            modifiers: (item.modifiers ?? []).map((modifier) => ({
              id: modifier.id,
              name: modifier.name,
              quantity: modifier.quantity ?? 1,
              priceImpact: modifier.priceImpact ?? 0
            }))
          }
        : {})
    };
  });
}

function buildCustomerDisplayName(customer?: OrderCustomerInput) {
  const parts = [customer?.name?.trim(), customer?.surname?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

function buildLastOrderNotes(
  effectiveOrderMode: 'eatIn' | 'takeAway' | 'delivery',
  customerNotes?: string
) {
  const prefix =
    effectiveOrderMode === 'eatIn'
      ? '[TOMAR AQUI]'
      : effectiveOrderMode === 'takeAway'
        ? '[PARA LLEVAR]'
        : '';

  const normalizedNotes = hasText(customerNotes) ? customerNotes.trim() : '';

  if (prefix && normalizedNotes) {
    return `${prefix}\n${normalizedNotes}`;
  }

  if (prefix) {
    return prefix;
  }

  if (normalizedNotes) {
    return normalizedNotes;
  }

  return undefined;
}

function buildLastOrderPayload(config: RuntimeConfig, payload: CreateOrderPayload, code: string) {
  const effectiveOrderMode = getEffectiveOrderMode(config, payload.orderMode);
  const mappedCustomer = mapOrderCustomer(payload.customer);
  const finalNotes = buildLastOrderNotes(effectiveOrderMode, payload.notes);
  const source = hasText(payload.source) ? payload.source.trim() : config.kiosk.source;
  const operationalCode = hasText(payload.operationalCode)
    ? payload.operationalCode.trim()
    : buildOperationalCode(code);
  const preferredPaymentMethod = hasText(payload.preferredPaymentMethod)
    ? payload.preferredPaymentMethod.trim()
    : config.kiosk.payment.preferredPaymentMethod;

  return {
    brandId: config.lastApp.brandId,
    source,
    products: mapOrderProducts(payload.items, config),
    code,
    operationalCode,
    preferredPaymentMethod,
    ...(mappedCustomer ? { customer: mappedCustomer } : {}),
    ...(finalNotes ? { notes: finalNotes } : {}),
    ...(Array.isArray(payload.payments) && payload.payments.length > 0
      ? { payments: payload.payments }
      : {}),
    ...(payload.discount && payload.discount.amount > 0
      ? { discount: payload.discount }
      : {}),
    ...(hasText(payload.tableId) ? { tableId: payload.tableId.trim() } : {}),
    ...(effectiveOrderMode === 'takeAway' ? { pickupType: 'takeAway' } : {}),
    ...(effectiveOrderMode === 'delivery' ? { pickupType: 'delivery' } : {}),
    ...(effectiveOrderMode === 'eatIn'
      ? {
          dineIn: true
        }
      : {})
  };
}

function extractFirstBill(raw: Record<string, unknown>) {
  if (!Array.isArray(raw.bills) || raw.bills.length === 0) {
    return null;
  }

  const firstBill = raw.bills[0];
  return firstBill && typeof firstBill === 'object' ? (firstBill as Record<string, unknown>) : null;
}

function extractNullableNumber(value: unknown) {
  return typeof value === 'number' ? value : null;
}

function extractLastOrderSummary(raw: Record<string, unknown>, fallbackCode: string) {
  const firstBill = extractFirstBill(raw);
  const lastProducts = Array.isArray(firstBill?.products)
    ? firstBill.products
    : Array.isArray(raw.products)
      ? raw.products
      : null;
  const code = hasText(raw.code) ? raw.code : fallbackCode;

  return {
    code,
    orderCode: code,
    lastTabId: hasText(raw.id) ? raw.id : null,
    totals: {
      total: extractNullableNumber(firstBill?.total),
      discountTotal: extractNullableNumber(firstBill?.discountTotal),
      tax: extractNullableNumber(firstBill?.tax)
    },
    lastProducts
  };
}

export async function createOrderInLast(config: RuntimeConfig, payload: CreateOrderPayload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new HttpError(400, 'Order must include at least one item');
  }

  assertLastAppConfig(config);
  validateCustomerFields(config, payload.customer);
  validateOrderNotes(payload.notes);

  const invalidItems = payload.items
    .map((item, index) => ({
      index,
      hasId: Boolean(item.productId ?? item.id),
      hasName: hasText(item.name),
      hasPrice: typeof item.price === 'number',
      hasQuantity: typeof item.quantity === 'number',
      hasType: item.type === 'PRODUCT' || item.type === 'COMBO',
      hasValidPromotionId:
        resolvePromotionId(item) === undefined || hasText(resolvePromotionId(item))
    }))
    .filter((item) => !item.hasId || !item.hasName || !item.hasPrice || !item.hasQuantity || !item.hasType || !item.hasValidPromotionId);

  if (invalidItems.length > 0) {
    throw new HttpError(400, 'Invalid order items', {
      invalidItems: invalidItems.map((item) => item.index)
    });
  }

  const code = generateOrderCode();
  const lastPayload = buildLastOrderPayload(config, payload, code);
  const orderRecord = createOrderRecord({
    orderCode: code,
    customerName: buildCustomerDisplayName(payload.customer),
    total: 0,
    rawPayload: lastPayload
  });

  createOrderEvent({
    orderId: orderRecord.id,
    type: 'last_request',
    message: 'Payload sent to Last.app',
    rawJson: lastPayload
  });

  const productsWithPromotionCount = Array.isArray(lastPayload.products)
    ? lastPayload.products.filter((product) => {
        if (!product || typeof product !== 'object') {
          return false;
        }

        return hasText((product as { promotionId?: unknown }).promotionId);
      }).length
    : 0;

  if (productsWithPromotionCount > 0) {
    createOrderEvent({
      orderId: orderRecord.id,
      type: 'promotion_sent',
      message: `${productsWithPromotionCount} product(s) sent with promotionId`,
      rawJson: {
        productsWithPromotionCount,
        products: lastPayload.products
      }
    });
  }

  const response = await fetch(`${LAST_APP_BASE_URL}/tabs`, {
    method: 'POST',
    headers: buildLastHeaders(toLastClientConfig(config), {
      locationId: config.lastApp.locationId
    }),
    body: JSON.stringify(lastPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorBody: unknown;

    try {
      errorBody = JSON.parse(errorText);
    } catch {
      errorBody = errorText;
    }

    console.error('LAST_CREATE_TAB_ERROR', {
      status: response.status,
      body: errorBody
    });

    updateOrderRecord(orderRecord.id, {
      status: 'failed',
      rawResponse: JSON.stringify(errorBody),
      error: 'Last API error'
    });

    createOrderEvent({
      orderId: orderRecord.id,
      type: 'last_error',
      message: `Last.app error ${response.status}`,
      rawJson: {
        status: response.status,
        body: errorBody
      }
    });

    throw new HttpError(response.status, 'Last API error', {
      status: response.status,
      lastError: errorBody,
      sentPayload: lastPayload
    });
  }

  const raw = await response.json() as Record<string, unknown>;
  const summary = extractLastOrderSummary(raw, code);

  updateOrderRecord(orderRecord.id, {
    status: 'created',
    lastTabId: summary.lastTabId,
    total: summary.totals.total ?? 0,
    rawResponse: JSON.stringify(raw),
    error: null
  });

  createOrderEvent({
    orderId: orderRecord.id,
    type: 'last_success',
    message: 'Order created in Last.app',
    rawJson: raw
  });

  return {
    success: true,
    code: summary.code,
    orderCode: summary.orderCode,
    lastTabId: summary.lastTabId,
    totals: summary.totals,
    lastProducts: summary.lastProducts,
    raw
  };
}

export function normalizeSetupOptions(location: LastLocation | null, selected: SetupSelectionPayload) {
  return {
    brands: normalizeBrands(location),
    selected: {
      organizationId: selected.organizationId ?? '',
      locationId: selected.locationId ?? '',
      brandId: selected.brandId ?? '',
      catalogId: selected.catalogId ?? ''
    }
  };
}

export async function fetchSetupOptions(config: RuntimeConfig) {
  const tokenConfigured = Boolean(config.lastApp.token);
  const organizations = tokenConfigured ? await fetchOrganizations(config).catch(() => []) : [];
  const locations =
    tokenConfigured && hasText(config.lastApp.organizationId)
      ? await fetchLocations(config, config.lastApp.organizationId).catch(() => [])
      : [];
  const location =
    tokenConfigured && hasText(config.lastApp.locationId)
      ? await fetchLocation(config, config.lastApp.locationId).catch(() => null)
      : null;

  const normalized = normalizeSetupOptions(location, config.lastApp);

  return {
    tokenConfigured,
    organizations,
    locations,
    brands: normalized.brands,
    selected: normalized.selected
  };
}

export async function buildAutoSetupPatch(
  config: RuntimeConfig,
  payload: SetupAutoPayload
): Promise<{
  restaurantName?: string;
  organizationId: string;
  locationId: string;
  brandId?: string;
  catalogId?: string;
  setupCompleted: number;
}> {
  assertToken(config);

  if (!hasText(payload.organizationId)) {
    throw new HttpError(400, 'Missing organizationId', {
      missingFields: ['organizationId']
    });
  }

  if (!hasText(payload.locationId)) {
    throw new HttpError(400, 'Missing locationId', {
      missingFields: ['locationId']
    });
  }

  const location = await fetchLocation(config, payload.locationId);
  const firstBrand = Array.isArray(location.brands) && location.brands.length === 1 ? location.brands[0] : undefined;
  const brandId = firstBrand?.id ?? '';
  const catalogId = firstBrand ? getCatalogIdFromBrand(firstBrand) : '';

  return {
    restaurantName: hasText(location.name) ? location.name.trim() : undefined,
    organizationId: payload.organizationId.trim(),
    locationId: payload.locationId.trim(),
    ...(brandId ? { brandId } : {}),
    ...(catalogId ? { catalogId } : {}),
    setupCompleted: payload.organizationId && payload.locationId && brandId && catalogId ? 1 : 0
  };
}

export async function createBillInLast(
  config: RuntimeConfig,
  tabId: string,
  discountTotal: number
): Promise<{ id: string; total?: number | null; discountTotal?: number | null }> {
  assertToken(config);
  assertLastAppConfig(config);

  const body: Record<string, unknown> = { tabId };
  if (discountTotal > 0) {
    body.discount = { type: 'currency', amount: discountTotal, concept: 'Descuento' };
  }

  return requestLastData<{ id: string; total?: number | null; discountTotal?: number | null }>(config, '/bills', {
    method: 'POST',
    body,
    headers: { locationId: config.lastApp.locationId, includeContentType: true }
  });
}

export async function createPaymentInLast(
  config: RuntimeConfig,
  billId: string,
  amount: number,
  paymentType: string
): Promise<unknown> {
  assertToken(config);
  assertLastAppConfig(config);

  return requestLastData<unknown>(config, '/payments', {
    method: 'POST',
    body: { billId, amount, type: paymentType },
    headers: { locationId: config.lastApp.locationId, includeContentType: true }
  });
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
