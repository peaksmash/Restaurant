import type { PaymentDevice, PaymentJob, TableQrMapping } from '@kiosk/types';

function resolveApiBase() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, '');
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return '';
}

const BASE = resolveApiBase();

// ── Types ──────────────────────────────────────────────────────────────────

export interface CustomerFieldConfig {
  enabled: boolean;
  required: boolean;
}

export type KioskTheme = 'principal' | 'moderno' | 'simple' | 'morado';

export interface LocalConfig {
  restaurantName: string;
  logoUrl: string;
  paymentsSimulated: boolean;
  paymentsDemoForced: boolean;
  lastApp: {
    tokenConfigured: boolean;
    tokenMasked: string | null;
    token: string; // backend returns masked value here
    organizationId: string;
    locationId: string;
    brandId: string;
    catalogId: string;
  };
  kiosk: {
    source: string;
    pickupType: string;
    defaultOrderMode: 'takeAway' | 'eatIn' | 'delivery';
    theme: KioskTheme;
    customerFields: {
      name: CustomerFieldConfig;
      phoneNumber: CustomerFieldConfig;
      email: CustomerFieldConfig;
    };
    notes: {
      generalEnabled: boolean;
      productCommentsEnabled: boolean;
    };
    features: {
      modifiers: boolean;
      notes: boolean;
      upselling: boolean;
      printTicket: boolean;
    };
    payment: {
      mode: string;
      preferredPaymentMethod: string;
      cashdro: {
        configured: boolean;
        baseUrl: string;
        username: string;
        passwordMasked: string | null;
        posId: string;
        posUser: string;
        allowInsecureTls: boolean;
      };
    };
  };
  printer: {
    mode: 'disabled' | 'browser' | 'escpos';
    escpos: { host: string; port: number; configured: boolean };
  };
  setupCompleted: boolean;
}

export interface SetupOption {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SetupOptions {
  tokenConfigured: boolean;
  organizations: SetupOption[];
  locations: SetupOption[];
  brands: SetupOption[];
  selected: {
    organizationId: string;
    locationId: string;
    brandId: string;
    catalogId: string;
  };
}

export interface SetupSelectionPayload {
  organizationId?: string;
  locationId?: string;
  brandId?: string;
  catalogId?: string;
}

export interface Order {
  id: string;
  orderCode: string | null;
  lastTabId: string | null;
  customerName: string | null;
  total: number;
  status: string;
  createdAt: string;
  error: string | null;
}

export interface CatalogResult {
  categories: Array<{ id: string; name: string; products?: unknown[] }>;
  modifierGroups: unknown[];
  fromCache?: boolean;
}

export interface CatalogDiagnosticsCategory {
  id: string;
  name: string;
  enabled: boolean;
  productsCount: number;
}

export interface CatalogDiagnosticsProduct {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
  categoryName: string;
  imageUrl: string | null;
  hasImage: boolean;
  modifierGroupsCount: number;
  externalId: string;
  organizationProductId: string;
}

export interface CatalogDiagnostics {
  catalogId: string;
  catalogName: string;
  fromCache: boolean;
  categoriesCount: number;
  productsCount: number;
  modifierGroupsCount: number;
  productsWithImageCount: number;
  productsWithoutImageCount: number;
  productsWithModifiersCount: number;
  disabledProductsCount: number;
  categories: CatalogDiagnosticsCategory[];
  products: CatalogDiagnosticsProduct[];
  warnings: string[];
}

export interface LastTableListItem {
  id: string;
  name: string;
  floorplanId?: string | null;
  floorplanName?: string | null;
  min?: number | null;
  max?: number | null;
  seats?: number | null;
  flatFeeSurcharge?: number | null;
}

export interface AdminTableQrMapping extends TableQrMapping {
  createdAt: string;
  updatedAt: string;
}

export interface AdminPaymentDevice extends PaymentDevice {
  queueState: {
    running: boolean;
    queued: number;
  };
}

export interface AdminPaymentJob extends PaymentJob {}

// ── HTTP helpers ───────────────────────────────────────────────────────────

async function readError(res: Response, fallback: string): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return fallback;
  }

  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return body.error ?? body.message ?? fallback;
  } catch {
    return fallback;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(await readError(res, `Error ${res.status} en ${path}`));

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('La API respondió con HTML en lugar de JSON. Revisa VITE_API_BASE_URL o el acceso al backend.');
  }

  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, `Error ${res.status} en ${path}`));

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('La API respondió con HTML en lugar de JSON. Revisa VITE_API_BASE_URL o el acceso al backend.');
  }

  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, `Error ${res.status} en ${path}`));

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('La API respondió con HTML en lugar de JSON. Revisa VITE_API_BASE_URL o el acceso al backend.');
  }

  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, `Error ${res.status} en ${path}`));

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('La API respondió con HTML en lugar de JSON. Revisa VITE_API_BASE_URL o el acceso al backend.');
  }

  return res.json() as Promise<T>;
}

// ── API calls ──────────────────────────────────────────────────────────────

export const getConfig = () => get<LocalConfig>('/api/config');

export const saveConfig = (body: unknown) => put<LocalConfig>('/api/config', body);

export const getSetupOptions = () => get<SetupOptions>('/api/setup/options');

export const saveSetupSelection = (payload: SetupSelectionPayload) =>
  put<LocalConfig>('/api/setup/selection', payload);

export const runAutoSetup = (organizationId: string, locationId: string) =>
  post<LocalConfig>('/api/setup/auto', { organizationId, locationId });

export const getCatalog = () => get<CatalogResult>('/api/catalog');
export const getCatalogDiagnostics = () => get<CatalogDiagnostics>('/api/catalog/diagnostics');

export const getOrders = () => get<Order[]>('/api/orders');
export const getLastTables = () => get<LastTableListItem[]>('/api/last/tables');
export const getTableQrMappings = () => get<AdminTableQrMapping[]>('/api/table-qr-mappings');
export const createTableQrMapping = (payload: { lastTableId: string; tableNameSnapshot?: string }) =>
  post<AdminTableQrMapping>('/api/table-qr-mappings', payload);
export const updateTableQrMapping = (id: string, payload: { lastTableId?: string; tableNameSnapshot?: string }) =>
  patch<AdminTableQrMapping>(`/api/table-qr-mappings/${id}`, payload);
export const regenerateTableQrToken = (id: string) =>
  post<AdminTableQrMapping>(`/api/table-qr-mappings/${id}/regenerate-token`, {});
export const enableTableQrMapping = (id: string) =>
  post<AdminTableQrMapping>(`/api/table-qr-mappings/${id}/enable`, {});
export const disableTableQrMapping = (id: string) =>
  post<AdminTableQrMapping>(`/api/table-qr-mappings/${id}/disable`, {});

export const getPaymentDevices = (locationId?: string) =>
  get<AdminPaymentDevice[]>(locationId ? `/api/payment-devices?locationId=${encodeURIComponent(locationId)}` : '/api/payment-devices');

export const createPaymentDevice = (payload: {
  locationId: string;
  provider: 'cashdro' | 'artemis';
  displayName: string;
  mode: 'demo' | 'real_pending' | 'real';
  configured?: boolean;
  isActive?: boolean;
  configJson?: Record<string, unknown> | null;
}) => post<AdminPaymentDevice>('/api/payment-devices', payload);

export const updatePaymentDevice = (id: string, payload: {
  displayName?: string;
  mode?: 'demo' | 'real_pending' | 'real';
  configured?: boolean;
  isActive?: boolean;
  configJson?: Record<string, unknown> | null;
}) => patch<AdminPaymentDevice>(`/api/payment-devices/${id}`, payload);

export const getPaymentJobs = (locationId?: string) =>
  get<AdminPaymentJob[]>(locationId ? `/api/payment-jobs?locationId=${encodeURIComponent(locationId)}` : '/api/payment-jobs');

// ── Suggestions ────────────────────────────────────────────────────────────

export type TimeSlot = 'all' | 'breakfast' | 'lunch' | 'snack' | 'dinner';

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  suggestProductId: string;
  timeSlot: TimeSlot;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface CrosssellRule {
  id: string;
  ifHasCategoryId: string;
  ifMissingCategoryId: string;
  suggestProductId: string;
  timeSlot: TimeSlot;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface LastminuteItem {
  id: string;
  productId: string;
  timeSlot: TimeSlot;
  position: number;
  isActive: boolean;
  createdAt: string;
}

export interface BundleRule {
  id: string;
  name: string;
  productIds: string[];
  bundlePrice: number | null;
  triggerProductId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CompositionSection {
  categoryId: string;
  categoryName: string;
  label: string;
  maxVisible: number;
}

export interface CompositionRule {
  id: string;
  triggerCategoryId: string;
  triggerCategoryName: string;
  bannerTitle: string;
  sections: CompositionSection[];
  isActive: boolean;
  createdAt: string;
}

export interface SuggestionStats {
  byEngine: {
    upsell: { shown: number; accepted: number; rate: number };
    crosssell: { shown: number; accepted: number; rate: number };
    lastminute: { shown: number; accepted: number; rate: number };
    bundle: { shown: number; accepted: number; rate: number };
  };
  topAccepted: Array<{ productId: string; count: number }>;
  topIgnored: Array<{ productId: string; count: number }>;
}

export interface CatalogProductForSuggestions {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryId: string | undefined;
  categoryName: string;
}

export interface CatalogCategoryForSuggestions {
  id: string;
  name: string;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, `Error ${res.status} en ${path}`));
}

export async function getCatalogForSuggestions(): Promise<{
  products: CatalogProductForSuggestions[];
  categories: CatalogCategoryForSuggestions[];
}> {
  const data = await getCatalogDiagnostics();
  const nameToId = new Map(data.categories.map((c) => [c.name, c.id]));
  return {
    products: data.products
      .filter((p) => p.enabled)
      .map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        imageUrl: p.imageUrl,
        categoryId: nameToId.get(p.categoryName),
        categoryName: p.categoryName,
      })),
    categories: data.categories
      .filter((c) => c.enabled)
      .map((c) => ({ id: c.id, name: c.name })),
  };
}

export const getSuggestionStats = () => get<SuggestionStats>('/api/suggestions/stats');

export const listUpsellRules = () => get<UpsellRule[]>('/api/suggestions/upsell');
export const createUpsellRule = (body: Omit<UpsellRule, 'id' | 'createdAt'>) =>
  post<UpsellRule>('/api/suggestions/upsell', body);
export const updateUpsellRule = (id: string, body: Partial<UpsellRule>) =>
  patch<UpsellRule>(`/api/suggestions/upsell/${id}`, body);
export const deleteUpsellRule = (id: string) => del(`/api/suggestions/upsell/${id}`);

export const listCrosssellRules = () => get<CrosssellRule[]>('/api/suggestions/crosssell');
export const createCrosssellRule = (body: Omit<CrosssellRule, 'id' | 'createdAt'>) =>
  post<CrosssellRule>('/api/suggestions/crosssell', body);
export const updateCrosssellRule = (id: string, body: Partial<CrosssellRule>) =>
  patch<CrosssellRule>(`/api/suggestions/crosssell/${id}`, body);
export const deleteCrosssellRule = (id: string) => del(`/api/suggestions/crosssell/${id}`);

export const listLastminuteItems = () => get<LastminuteItem[]>('/api/suggestions/lastminute');
export const createLastminuteItem = (body: Omit<LastminuteItem, 'id' | 'createdAt'>) =>
  post<LastminuteItem>('/api/suggestions/lastminute', body);
export const updateLastminuteItem = (id: string, body: Partial<LastminuteItem>) =>
  patch<LastminuteItem>(`/api/suggestions/lastminute/${id}`, body);
export const deleteLastminuteItem = (id: string) => del(`/api/suggestions/lastminute/${id}`);

export const listBundleRules = () => get<BundleRule[]>('/api/suggestions/bundles');
export const createBundleRule = (body: Omit<BundleRule, 'id' | 'createdAt'>) =>
  post<BundleRule>('/api/suggestions/bundles', body);
export const updateBundleRule = (id: string, body: Partial<BundleRule>) =>
  patch<BundleRule>(`/api/suggestions/bundles/${id}`, body);
export const deleteBundleRule = (id: string) => del(`/api/suggestions/bundles/${id}`);

export const getCompositionRules = () => get<CompositionRule[]>('/api/suggestions/composition-rules');
export const createCompositionRule = (body: Omit<CompositionRule, 'id' | 'createdAt'>) =>
  post<CompositionRule>('/api/suggestions/composition-rules', body);
export const updateCompositionRule = (id: string, body: Partial<CompositionRule>) =>
  patch<CompositionRule>(`/api/suggestions/composition-rules/${id}`, body);
export const deleteCompositionRule = (id: string) => del(`/api/suggestions/composition-rules/${id}`);
