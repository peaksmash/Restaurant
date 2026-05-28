/**
 * Thin HTTP client for Last.app API v2.
 * No caching.
 */

export interface LastAppClientConfig {
  token: string;
  baseUrl: string;
}

export interface LastDeliveryArea {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  deliveryFee: number;
  minimumBasket: number;
  estimatedDeliveryMinutes: number;
  deliveryExtraMinutes: number | null;
  /** Raw geometry from Last.app — polygon points or circle definition. Preserved for zone matching. */
  geometry: unknown;
}

export interface LastBrand {
  id: string;
  name: string;
  catalogs: Record<string, unknown>;
  fullCatalogs: Record<string, unknown>;
}

export interface LastLocationDetail {
  id: string;
  name: string;
  preparationMinutes: number;
  brands: LastBrand[];
  deliveryAreas: LastDeliveryArea[];
  shopAreasCount: number;
  workingTimesKeys: string[];
  paymentMethods: unknown[];
  offlinePaymentMethods: unknown[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function lastGet<T>(
  config: LastAppClientConfig,
  path: string,
  headers: Record<string, string> = {},
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    const error = new Error(`Last.app ${res.status} on ${path}: ${body}`) as Error & { statusCode?: number };
    error.statusCode = res.status >= 500 ? 502 : res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

async function lastPost<T>(
  config: LastAppClientConfig,
  path: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    const error = new Error(`Last.app ${res.status} on POST ${path}: ${body}`) as Error & { statusCode?: number };
    error.statusCode = res.status >= 500 ? 502 : res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

function normalizeDeliveryArea(raw: unknown): LastDeliveryArea {
  const r = asRecord(raw);
  return {
    id: readString(r.id),
    name: readString(r.name),
    enabled: readBoolean(r.enabled),
    type: readString(r.type),
    deliveryFee: readNumber(r.deliveryFee),
    minimumBasket: readNumber(r.minimumBasket),
    estimatedDeliveryMinutes: readNumber(r.estimatedDeliveryMinutes),
    deliveryExtraMinutes: readNullableNumber(r.deliveryExtraMinutes),
    geometry: r.geometry ?? null,  // raw — preserved for polygon/circle zone matching
  };
}

function normalizeBrand(raw: unknown): LastBrand {
  const r = asRecord(raw);
  return {
    id: readString(r.id),
    name: readString(r.name),
    catalogs: asRecord(r.catalogs),
    fullCatalogs: asRecord(r.fullCatalogs),
  };
}

// ─── Catalog types ──────────────────────────────────────────────────────────

export interface LastCatalogModifier {
  id: string;
  name: string;
  priceImpact: number;
  organizationModifierId?: string;
}

export interface LastCatalogModifierGroup {
  id: string;
  name: string;
  min: number;
  max: number;
  allowRepeat: boolean;
  modifiers: LastCatalogModifier[];
}

export interface LastCatalogProduct {
  id: string;
  name: string;
  type: string;
  price: number;
  enabled: boolean;
  imageUrl: string | null;
  modifierGroups: string[];
}

export interface LastCatalogCategory {
  id: string;
  name: string;
  enabled: boolean;
  productsCount: number;
  products: LastCatalogProduct[];
}

export interface LastCatalogSummary {
  catalogId: string;
  categoriesCount: number;
  modifierGroupsCount: number;
  modifierGroups: LastCatalogModifierGroup[];
  categories: LastCatalogCategory[];
}

function normalizeCatalogModifier(raw: unknown): LastCatalogModifier {
  const r = asRecord(raw);
  return {
    id: readString(r.id),
    name: readString(r.name),
    priceImpact: readNumber(r.priceImpact),
    organizationModifierId: typeof r.organizationModifierId === 'string' ? r.organizationModifierId : undefined,
  };
}

function normalizeCatalogModifierGroup(raw: unknown): LastCatalogModifierGroup {
  const r = asRecord(raw);
  return {
    id: readString(r.id),
    name: readString(r.name),
    min: readNumber(r.min),
    max: readNumber(r.max),
    allowRepeat: readBoolean(r.allowRepeat),
    modifiers: asArray(r.modifiers).map(normalizeCatalogModifier),
  };
}

function normalizeCatalogProduct(raw: unknown): LastCatalogProduct {
  const r = asRecord(raw);
  const modifierGroups = asArray(r.modifierGroups).filter((m) => typeof m === 'string') as string[];
  return {
    id: readString(r.id),
    name: readString(r.name),
    type: readString(r.type) || 'PRODUCT',
    price: readNumber(r.price),
    enabled: readBoolean(r.enabled, true),
    imageUrl: typeof r.imageUrl === 'string' && r.imageUrl.trim() ? r.imageUrl.trim() : null,
    modifierGroups,
  };
}

function normalizeCatalogCategory(raw: unknown, productLimit: number): LastCatalogCategory {
  const r = asRecord(raw);
  const allProducts = asArray(r.products).map(normalizeCatalogProduct);
  return {
    id: readString(r.id),
    name: readString(r.name),
    enabled: readBoolean(r.enabled, true),
    productsCount: allProducts.length,
    products: allProducts.slice(0, productLimit),
  };
}

export async function postTab(
  config: LastAppClientConfig,
  organizationId: string,
  locationId: string,
  payload: unknown,
): Promise<unknown> {
  return lastPost<unknown>(config, '/tabs', payload, {
    OrganizationID: organizationId,
    LocationID: locationId,
  });
}

export async function getCatalogSummary(
  config: LastAppClientConfig,
  organizationId: string,
  locationId: string,
  catalogId: string,
  productLimit = 10,
): Promise<LastCatalogSummary> {
  const raw = await lastGet<Record<string, unknown>>(
    config,
    `/catalogs/${catalogId}`,
    {
      OrganizationID: organizationId,
      LocationID: locationId,
    },
  );

  const modifierGroups = asArray(raw.modifierGroups).map(normalizeCatalogModifierGroup);
  const categories = asArray(raw.categories).map((c) => normalizeCatalogCategory(c, productLimit));

  return {
    catalogId,
    categoriesCount: categories.length,
    modifierGroupsCount: modifierGroups.length,
    modifierGroups,
    categories,
  };
}

export async function getLocationDetail(
  config: LastAppClientConfig,
  organizationId: string,
  locationId: string,
): Promise<LastLocationDetail> {
  const raw = await lastGet<Record<string, unknown>>(
    config,
    `/locations/${locationId}`,
    {
      OrganizationID: organizationId,
      LocationID: locationId,
    },
  );

  const brands = asArray(raw.brands).map(normalizeBrand);
  const deliveryAreas = asArray(raw.deliveryAreas).map(normalizeDeliveryArea);
  const shopAreas = asArray(raw.shopAreas);
  const workingTimes = asRecord(raw.workingTimes);

  return {
    id: readString(raw.id),
    name: readString(raw.name),
    preparationMinutes: readNumber(raw.preparationMinutes),
    brands,
    deliveryAreas,
    shopAreasCount: shopAreas.length,
    workingTimesKeys: Object.keys(workingTimes),
    paymentMethods: asArray(raw.paymentMethods),
    offlinePaymentMethods: asArray(raw.offlinePaymentMethods),
  };
}
