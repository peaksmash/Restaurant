import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  LastOrderLink,
  OperationalTicket,
  OperationalTicketItem,
  OperationalTicketModifier,
  OrderSession,
  OrderSessionEvent,
  PaymentDevice,
  PaymentDeviceMode,
  PaymentJob,
  PaymentJobStatus,
  PaymentProvider,
  PrintJob,
  TableQrMapping
} from '@kiosk/types';

export interface SettingsRow {
  id: string;
  restaurantName: string;
  organizationId: string;
  locationId: string;
  brandId: string;
  catalogId: string;
  source: string;
  pickupType: string;
  defaultOrderMode: string;
  theme: string;
  customerNameEnabled: number;
  customerNameRequired: number;
  customerPhoneEnabled: number;
  customerPhoneRequired: number;
  customerEmailEnabled: number;
  customerEmailRequired: number;
  generalNotesEnabled: number;
  productCommentsEnabled: number;
  featureModifiers: number;
  featureUpselling: number;
  featurePrintTicket: number;
  paymentMode: string;
  preferredPaymentMethod: string;
  paymentsSimulated: number;
  cashdroBaseUrl: string;
  cashdroUsername: string;
  cashdroPassword: string;
  cashdroPosId: string;
  cashdroPosUser: string;
  cashdroAllowInsecureTls: number;
  printerMode: string;
  escposHost: string;
  escposPort: number;
  logoUrl: string;
  setupCompleted: number;
  updatedAt: string;
}

export type KioskTheme = 'principal' | 'moderno' | 'simple' | 'morado';

interface OrderRow {
  id: string;
  orderCode: string | null;
  lastTabId: string | null;
  customerName: string | null;
  total: number;
  status: string;
  rawPayload: string | null;
  rawResponse: string | null;
  error: string | null;
  createdAt: string;
}

interface OrderEventRow {
  id: string;
  orderId: string;
  type: string;
  message: string;
  rawJson: string | null;
  createdAt: string;
}

interface OrderSessionRow {
  orderSessionId: string;
  externalId: string;
  organizationId: string;
  locationId: string;
  brandId: string;
  catalogId: string;
  tableId: string | null;
  lastTableId: string | null;
  tableNameSnapshot: string | null;
  channel: string;
  source: string | null;
  restaurantSlug: string | null;
  operationalStatus: string;
  paymentStatus: string;
  lastSyncStatus: string;
  customerJson: string | null;
  notes: string | null;
  itemsJson: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  currency: string;
  paymentMode: string;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  pin4: string | null;
  qrToken: string | null;
  expiresAt: string | null;
  preparationTimeMode: string | null;
  suggestedPreparationMinutes: number | null;
  confirmedPreparationMinutes: number | null;
  estimatedReadyAt: string | null;
  pickupTimeSyncedToLast: string | null;
  pickupTimeSyncStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrderSessionEventRow {
  id: string;
  orderSessionId: string;
  type: string;
  actorType: string;
  actorId: string | null;
  rawJson: string | null;
  createdAt: string;
}

interface LastOrderLinkRow {
  id: string;
  orderSessionId: string;
  lastTabId: string | null;
  lastBillId: string | null;
  lastPaymentId: string | null;
  lastCode: string | null;
  lastPayloadHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CashdroPaymentRow {
  id: string;
  orderSessionId: string;
  operationId: string;
  aliasId: string | null;
  workflowStatus: string;
  state: string | null;
  total: number;
  totalIn: number;
  totalOut: number;
  changeNotAvailable: number;
  payInProgress: string | null;
  payOutProgress: string | null;
  withError: number;
  messagesJson: string | null;
  rawJson: string | null;
  importedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentDeviceRow {
  id: string;
  locationId: string;
  provider: string;
  displayName: string;
  mode: string;
  configured: number;
  isActive: number;
  configJson: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentJobRow {
  id: string;
  orderSessionId: string;
  locationId: string;
  deviceId: string;
  provider: string;
  status: string;
  idempotencyKey: string;
  requestPayloadJson: string | null;
  responsePayloadJson: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface OperationalTicketRow {
  ticketId: string;
  displayNumber: string;
  source: string;
  sourceLabel: string;
  orderSessionId: string | null;
  lastTabId: string | null;
  lastCode: string | null;
  externalOrderId: string | null;
  tableName: string | null;
  customerName: string | null;
  itemsJson: string;
  notes: string | null;
  subtotal: number | null;
  discountTotal: number | null;
  total: number | null;
  currency: string | null;
  estimatedReadyAt: string | null;
  paid: number;
  operationalStatus: string;
  printStatus: string;
  soundPolicy: string;
  soundPlayedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  rawSourceHash: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PrintJobRow {
  printJobId: string;
  ticketId: string;
  status: string;
  mode: string;
  payloadJson: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  printedAt: string | null;
}

export interface OrderSessionRecord extends OrderSession {}

interface TableRow {
  id: string;
  locationId: string;
  lastTableId: string;
  qrToken: string;
  enabled: number;
  tableNameSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TableQrMappingRecord extends TableQrMapping {
  createdAt: string;
  updatedAt: string;
}

export interface CashdroPaymentRecord {
  id: string;
  orderSessionId: string;
  operationId: string;
  aliasId: string | null;
  workflowStatus: string;
  state: string | null;
  total: number;
  totalIn: number;
  totalOut: number;
  changeNotAvailable: number;
  payInProgress: string | null;
  payOutProgress: string | null;
  withError: boolean;
  messages: number[];
  rawJson: Record<string, unknown> | null;
  importedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDeviceRecord extends PaymentDevice {}

export interface PaymentJobRecord extends PaymentJob {}

export interface OperationalTicketRecord extends OperationalTicket {}

export interface PrintJobRecord extends PrintJob {}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export type SuggestionTimeSlot = 'all' | 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type SuggestionEngine = 'upsell' | 'crosssell' | 'lastminute' | 'bundle' | 'composition';
export type SuggestionOutcome = 'shown' | 'accepted' | 'ignored' | 'rejected';

export interface UpsellRuleRow {
  id: string;
  triggerProductId: string;
  suggestProductId: string;
  timeSlot: SuggestionTimeSlot;
  priority: number;
  isActive: number;
  createdAt: string;
}

export interface CrosssellRuleRow {
  id: string;
  ifHasCategoryId: string;
  ifMissingCategoryId: string;
  suggestProductId: string;
  timeSlot: SuggestionTimeSlot;
  priority: number;
  isActive: number;
  createdAt: string;
}

export interface LastminuteItemRow {
  id: string;
  productId: string;
  timeSlot: SuggestionTimeSlot;
  position: number;
  isActive: number;
  createdAt: string;
}

export interface BundleRuleRow {
  id: string;
  name: string;
  productIds: string; // JSON array
  bundlePrice: number | null;
  triggerProductId: string | null;
  isActive: number;
  createdAt: string;
}

export interface SuggestionEventRow {
  id: string;
  sessionId: string;
  engine: SuggestionEngine;
  ruleId: string;
  suggestedProductId: string;
  outcome: SuggestionOutcome;
  createdAt: string;
}

export interface UpsellRule {
  id: string;
  triggerProductId: string;
  suggestProductId: string;
  timeSlot: SuggestionTimeSlot;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface CrosssellRule {
  id: string;
  ifHasCategoryId: string;
  ifMissingCategoryId: string;
  suggestProductId: string;
  timeSlot: SuggestionTimeSlot;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

export interface LastminuteItem {
  id: string;
  productId: string;
  timeSlot: SuggestionTimeSlot;
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

export interface SuggestionEvent {
  id: string;
  sessionId: string;
  engine: SuggestionEngine;
  ruleId: string;
  suggestedProductId: string;
  outcome: SuggestionOutcome;
  createdAt: string;
}

export interface CompositionSection {
  categoryId: string;
  categoryName: string;
  label: string;
  maxVisible: number;
}

export interface CompositionModalRuleRow {
  id: string;
  triggerCategoryId: string;
  triggerCategoryName: string;
  bannerTitle: string;
  sections: string; // JSON array of CompositionSection
  isActive: number;
  createdAt: string;
}

export interface CompositionModalRule {
  id: string;
  triggerCategoryId: string;
  triggerCategoryName: string;
  bannerTitle: string;
  sections: CompositionSection[];
  isActive: boolean;
  createdAt: string;
}

const DB_PATH = join(process.cwd(), 'database.sqlite');
const LEGACY_CONFIG_PATH = join(process.cwd(), 'config.local.json');

const dbDirectory = dirname(DB_PATH);
mkdirSync(dbDirectory, { recursive: true });

export const db = new Database(DB_PATH);

function nowIso() {
  return new Date().toISOString();
}

function boolToInt(value: boolean) {
  return value ? 1 : 0;
}

function parseJson<T>(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value;
  }
}

function createDefaultSettingsRow(): SettingsRow {
  return {
    id: 'main',
    restaurantName: '',
    organizationId: '',
    locationId: '',
    brandId: '',
    catalogId: '',
    source: 'Kiosk',
    pickupType: 'takeAway',
    defaultOrderMode: 'takeAway',
    theme: 'principal',
    customerNameEnabled: 1,
    customerNameRequired: 1,
    customerPhoneEnabled: 0,
    customerPhoneRequired: 0,
    customerEmailEnabled: 0,
    customerEmailRequired: 0,
    generalNotesEnabled: 1,
    productCommentsEnabled: 1,
    featureModifiers: 1,
    featureUpselling: 0,
    featurePrintTicket: 0,
    paymentMode: 'simulated',
    preferredPaymentMethod: 'Cash',
    paymentsSimulated: 0,
    cashdroBaseUrl: '',
    cashdroUsername: '',
    cashdroPassword: '',
    cashdroPosId: 'Kiosk',
    cashdroPosUser: 'Caja',
    cashdroAllowInsecureTls: 1,
    printerMode: 'disabled',
    escposHost: '',
    escposPort: 9100,
    setupCompleted: 0,
    updatedAt: nowIso()
  };
}

function computeSetupCompleted(row: Pick<SettingsRow, 'organizationId' | 'locationId' | 'brandId' | 'catalogId'>) {
  return row.organizationId && row.locationId && row.brandId && row.catalogId ? 1 : 0;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapTableQrMappingRow(row: TableRow): TableQrMappingRecord {
  return {
    id: row.id,
    locationId: row.locationId,
    lastTableId: row.lastTableId,
    tableNameSnapshot: row.tableNameSnapshot,
    qrToken: row.qrToken,
    enabled: row.enabled === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapOrderSessionRow(row: OrderSessionRow): OrderSessionRecord {
  return {
    orderSessionId: row.orderSessionId,
    externalId: row.externalId,
    organizationId: row.organizationId,
    locationId: row.locationId,
    brandId: row.brandId,
    catalogId: row.catalogId,
    tableId: row.tableId,
    lastTableId: row.lastTableId,
    tableNameSnapshot: row.tableNameSnapshot,
    channel: row.channel as OrderSession['channel'],
    source: row.source,
    restaurantSlug: row.restaurantSlug,
    operationalStatus: row.operationalStatus as OrderSession['operationalStatus'],
    paymentStatus: row.paymentStatus as OrderSession['paymentStatus'],
    lastSyncStatus: row.lastSyncStatus as OrderSession['lastSyncStatus'],
    customer: parseJson<OrderSession['customer']>(row.customerJson),
    notes: row.notes,
    items: JSON.parse(row.itemsJson) as OrderSession['items'],
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    total: row.total,
    currency: row.currency,
    paymentMode: row.paymentMode as OrderSession['paymentMode'],
    stripePaymentIntentId: row.stripePaymentIntentId,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId,
    pin4: row.pin4,
    qrToken: row.qrToken,
    expiresAt: row.expiresAt,
    preparationTimeMode: row.preparationTimeMode as OrderSession['preparationTimeMode'],
    suggestedPreparationMinutes: row.suggestedPreparationMinutes,
    confirmedPreparationMinutes: row.confirmedPreparationMinutes,
    estimatedReadyAt: row.estimatedReadyAt,
    pickupTimeSyncedToLast: row.pickupTimeSyncedToLast,
    pickupTimeSyncStatus: row.pickupTimeSyncStatus as OrderSession['pickupTimeSyncStatus'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapOrderSessionEventRow(row: OrderSessionEventRow): OrderSessionEvent {
  return {
    id: row.id,
    orderSessionId: row.orderSessionId,
    type: row.type,
    actorType: row.actorType as OrderSessionEvent['actorType'],
    actorId: row.actorId,
    rawJson: parseJson<Record<string, unknown>>(row.rawJson),
    createdAt: row.createdAt
  };
}

function mapLastOrderLinkRow(row: LastOrderLinkRow): LastOrderLink {
  return {
    id: row.id,
    orderSessionId: row.orderSessionId,
    lastTabId: row.lastTabId,
    lastBillId: row.lastBillId,
    lastPaymentId: row.lastPaymentId,
    lastCode: row.lastCode,
    lastPayloadHash: row.lastPayloadHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCashdroPaymentRow(row: CashdroPaymentRow): CashdroPaymentRecord {
  return {
    id: row.id,
    orderSessionId: row.orderSessionId,
    operationId: row.operationId,
    aliasId: row.aliasId,
    workflowStatus: row.workflowStatus,
    state: row.state,
    total: row.total,
    totalIn: row.totalIn,
    totalOut: row.totalOut,
    changeNotAvailable: row.changeNotAvailable,
    payInProgress: row.payInProgress,
    payOutProgress: row.payOutProgress,
    withError: row.withError === 1,
    messages: (parseJson<number[]>(row.messagesJson) ?? []) as number[],
    rawJson: parseJson<Record<string, unknown>>(row.rawJson),
    importedAt: row.importedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapPaymentDeviceRow(row: PaymentDeviceRow): PaymentDeviceRecord {
  return {
    id: row.id,
    locationId: row.locationId,
    provider: row.provider as PaymentProvider,
    displayName: row.displayName,
    mode: row.mode as PaymentDeviceMode,
    configured: row.configured === 1,
    isActive: row.isActive === 1,
    configJson: row.configJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapPaymentJobRow(row: PaymentJobRow): PaymentJobRecord {
  return {
    id: row.id,
    orderSessionId: row.orderSessionId,
    locationId: row.locationId,
    deviceId: row.deviceId,
    provider: row.provider as PaymentProvider,
    status: row.status as PaymentJobStatus,
    idempotencyKey: row.idempotencyKey,
    requestPayloadJson: row.requestPayloadJson,
    responsePayloadJson: row.responsePayloadJson,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage
  };
}

/**
 * Normalizes a modifier value from itemsJson — handles both the legacy `string`
 * format ("2x Salsa BBQ") and the current structured object format.
 */
function normalizeStoredModifier(mod: unknown): OperationalTicketModifier {
  if (typeof mod === 'string') {
    const m = /^(\d+)x\s+(.*)$/i.exec(mod);
    if (m) {
      return { name: m[2], quantity: parseInt(m[1], 10), unitPrice: null, totalPrice: null };
    }
    return { name: mod, quantity: 1, unitPrice: null, totalPrice: null };
  }
  if (typeof mod === 'object' && mod !== null && 'name' in mod) {
    const o = mod as Record<string, unknown>;
    return {
      name: String(o.name ?? ''),
      quantity: typeof o.quantity === 'number' ? o.quantity : 1,
      unitPrice: typeof o.unitPrice === 'number' ? o.unitPrice : null,
      totalPrice: typeof o.totalPrice === 'number' ? o.totalPrice : null,
    };
  }
  return { name: String(mod), quantity: 1, unitPrice: null, totalPrice: null };
}

/**
 * Deserializes itemsJson and normalizes each item to `OperationalTicketItem`,
 * including backward compat for old modifiers stored as `string[]`.
 */
function normalizeStoredItems(json: string): OperationalTicketItem[] {
  const raw = JSON.parse(json) as unknown[];
  return raw.map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    return {
      name: String(item.name ?? ''),
      quantity: typeof item.quantity === 'number' ? item.quantity : 1,
      unitPrice: typeof item.unitPrice === 'number' ? item.unitPrice : null,
      totalPrice: typeof item.totalPrice === 'number' ? item.totalPrice : null,
      modifiers: Array.isArray(item.modifiers)
        ? item.modifiers.map(normalizeStoredModifier)
        : [],
      notes: typeof item.notes === 'string' ? item.notes : null,
      promotionLabel: typeof item.promotionLabel === 'string' ? item.promotionLabel : null,
      hasPromotionAdjustment: Boolean(item.hasPromotionAdjustment),
    };
  });
}

function mapOperationalTicketRow(row: OperationalTicketRow): OperationalTicketRecord {
  return {
    ticketId: row.ticketId,
    displayNumber: row.displayNumber,
    source: row.source as OperationalTicket['source'],
    sourceLabel: row.sourceLabel,
    orderSessionId: row.orderSessionId,
    lastTabId: row.lastTabId,
    lastCode: row.lastCode,
    externalOrderId: row.externalOrderId,
    tableName: row.tableName,
    customerName: row.customerName,
    items: normalizeStoredItems(row.itemsJson),
    notes: row.notes,
    subtotal: row.subtotal ?? null,
    discountTotal: row.discountTotal ?? null,
    total: row.total,
    currency: row.currency,
    estimatedReadyAt: row.estimatedReadyAt ?? null,
    paid: row.paid === 1,
    operationalStatus: row.operationalStatus as OperationalTicket['operationalStatus'],
    printStatus: row.printStatus as OperationalTicket['printStatus'],
    soundPolicy: row.soundPolicy as OperationalTicket['soundPolicy'],
    soundPlayedAt: row.soundPlayedAt,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    rawSourceHash: row.rawSourceHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapOperationalTicketToRow(record: OperationalTicketRecord): OperationalTicketRow {
  return {
    ticketId: record.ticketId,
    displayNumber: record.displayNumber,
    source: record.source,
    sourceLabel: record.sourceLabel,
    orderSessionId: record.orderSessionId ?? null,
    lastTabId: record.lastTabId ?? null,
    lastCode: record.lastCode ?? null,
    externalOrderId: record.externalOrderId ?? null,
    tableName: record.tableName ?? null,
    customerName: record.customerName ?? null,
    itemsJson: JSON.stringify(record.items),
    notes: record.notes ?? null,
    subtotal: record.subtotal ?? null,
    discountTotal: record.discountTotal ?? null,
    total: record.total ?? null,
    currency: record.currency ?? null,
    estimatedReadyAt: record.estimatedReadyAt ?? null,
    paid: boolToInt(record.paid),
    operationalStatus: record.operationalStatus,
    printStatus: record.printStatus,
    soundPolicy: record.soundPolicy,
    soundPlayedAt: record.soundPlayedAt ?? null,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    rawSourceHash: record.rawSourceHash ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapPrintJobRow(row: PrintJobRow): PrintJobRecord {
  return {
    printJobId: row.printJobId,
    ticketId: row.ticketId,
    status: row.status as PrintJob['status'],
    mode: row.mode,
    payloadJson: row.payloadJson,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    printedAt: row.printedAt
  };
}

function generateQrTokenValue() {
  return `qrt_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function generateUniqueQrToken() {
  while (true) {
    const token = generateQrTokenValue();
    const existing = db.prepare('SELECT id FROM table_qr_mappings WHERE qrToken = ?').get(token) as { id: string } | undefined;
    if (!existing) {
      return token;
    }
  }
}

function generateRecoveryQrTokenValue() {
  return `rqt_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function generateUniqueRecoveryQrToken() {
  while (true) {
    const token = generateRecoveryQrTokenValue();
    const existing = db.prepare('SELECT orderSessionId FROM order_sessions WHERE qrToken = ?').get(token) as
      | { orderSessionId: string }
      | undefined;
    if (!existing) {
      return token;
    }
  }
}

function generatePin4Value() {
  return `${Math.floor(Math.random() * 10000)}`.padStart(4, '0');
}

function generateUniquePin4(locationId: string) {
  while (true) {
    const pin4 = generatePin4Value();
    const existing = db.prepare(`
      SELECT orderSessionId
      FROM order_sessions
      WHERE locationId = ?
        AND pin4 = ?
        AND paymentStatus = 'unpaid'
        AND lastSyncStatus = 'not_sent'
        AND operationalStatus != 'cancelled'
        AND (expiresAt IS NULL OR datetime(expiresAt) > datetime('now'))
      LIMIT 1
    `).get(locationId, pin4) as { orderSessionId: string } | undefined;

    if (!existing) {
      return pin4;
    }
  }
}

export function normalizeThemeValue(theme: unknown): KioskTheme {
  if (theme === 'principal' || theme === 'moderno' || theme === 'simple' || theme === 'morado') {
    return theme;
  }

  if (theme === 'mcdonalds') {
    return 'moderno';
  }

  if (theme === 'advanced') {
    return 'morado';
  }

  return 'principal';
}

function getTableColumns(tableName: string) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const hasColumn = getTableColumns(tableName).some((column) => column.name === columnName);
  if (!hasColumn) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

function readLegacyConfig() {
  if (!existsSync(LEGACY_CONFIG_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(LEGACY_CONFIG_PATH, 'utf8')) as Record<string, any>;
  } catch {
    return null;
  }
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      restaurantName TEXT NOT NULL,
      organizationId TEXT NOT NULL,
      locationId TEXT NOT NULL,
      brandId TEXT NOT NULL,
      catalogId TEXT NOT NULL,
      source TEXT NOT NULL,
      pickupType TEXT NOT NULL,
      defaultOrderMode TEXT NOT NULL,
      theme TEXT NOT NULL,
      customerNameEnabled INTEGER NOT NULL,
      customerNameRequired INTEGER NOT NULL,
      customerPhoneEnabled INTEGER NOT NULL,
      customerPhoneRequired INTEGER NOT NULL,
      customerEmailEnabled INTEGER NOT NULL,
      customerEmailRequired INTEGER NOT NULL,
      generalNotesEnabled INTEGER NOT NULL,
      productCommentsEnabled INTEGER NOT NULL,
      featureModifiers INTEGER NOT NULL,
      featureUpselling INTEGER NOT NULL,
      featurePrintTicket INTEGER NOT NULL,
      paymentMode TEXT NOT NULL,
      preferredPaymentMethod TEXT NOT NULL,
      paymentsSimulated INTEGER NOT NULL DEFAULT 0,
      cashdroBaseUrl TEXT NOT NULL DEFAULT '',
      cashdroUsername TEXT NOT NULL DEFAULT '',
      cashdroPassword TEXT NOT NULL DEFAULT '',
      cashdroPosId TEXT NOT NULL DEFAULT 'Kiosk',
      cashdroPosUser TEXT NOT NULL DEFAULT 'Caja',
      cashdroAllowInsecureTls INTEGER NOT NULL DEFAULT 1,
      setupCompleted INTEGER NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS catalog_cache (
      catalogId TEXT PRIMARY KEY,
      rawJson TEXT NOT NULL,
      syncedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      orderCode TEXT,
      lastTabId TEXT,
      customerName TEXT,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      rawPayload TEXT,
      rawResponse TEXT,
      error TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_events (
      id TEXT PRIMARY KEY,
      orderId TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      rawJson TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_sessions (
      orderSessionId TEXT PRIMARY KEY,
      externalId TEXT NOT NULL UNIQUE,
      organizationId TEXT NOT NULL,
      locationId TEXT NOT NULL,
      brandId TEXT NOT NULL,
      catalogId TEXT NOT NULL,
      tableId TEXT,
      lastTableId TEXT,
      tableNameSnapshot TEXT,
      channel TEXT NOT NULL,
      source TEXT,
      restaurantSlug TEXT,
      operationalStatus TEXT NOT NULL,
      paymentStatus TEXT NOT NULL,
      lastSyncStatus TEXT NOT NULL,
      customerJson TEXT,
      notes TEXT,
      itemsJson TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discountTotal INTEGER NOT NULL,
      total INTEGER NOT NULL,
      currency TEXT NOT NULL,
      paymentMode TEXT NOT NULL,
      stripePaymentIntentId TEXT,
      stripeCheckoutSessionId TEXT,
      pin4 TEXT,
      qrToken TEXT UNIQUE,
      expiresAt TEXT,
      preparationTimeMode TEXT,
      suggestedPreparationMinutes INTEGER,
      confirmedPreparationMinutes INTEGER,
      estimatedReadyAt TEXT,
      pickupTimeSyncedToLast TEXT,
      pickupTimeSyncStatus TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_session_events (
      id TEXT PRIMARY KEY,
      orderSessionId TEXT NOT NULL,
      type TEXT NOT NULL,
      actorType TEXT NOT NULL,
      actorId TEXT,
      rawJson TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS last_order_links (
      id TEXT PRIMARY KEY,
      orderSessionId TEXT NOT NULL UNIQUE,
      lastTabId TEXT,
      lastBillId TEXT,
      lastPaymentId TEXT,
      lastCode TEXT,
      lastPayloadHash TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cashdro_payments (
      id TEXT PRIMARY KEY,
      orderSessionId TEXT NOT NULL UNIQUE,
      operationId TEXT NOT NULL,
      aliasId TEXT,
      workflowStatus TEXT NOT NULL,
      state TEXT,
      total INTEGER NOT NULL,
      totalIn INTEGER NOT NULL,
      totalOut INTEGER NOT NULL,
      changeNotAvailable INTEGER NOT NULL,
      payInProgress TEXT,
      payOutProgress TEXT,
      withError INTEGER NOT NULL,
      messagesJson TEXT,
      rawJson TEXT,
      importedAt TEXT,
      completedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_devices (
      id TEXT PRIMARY KEY,
      locationId TEXT NOT NULL,
      provider TEXT NOT NULL,
      displayName TEXT NOT NULL,
      mode TEXT NOT NULL,
      configured INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      configJson TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_jobs (
      id TEXT PRIMARY KEY,
      orderSessionId TEXT NOT NULL,
      locationId TEXT NOT NULL,
      deviceId TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      idempotencyKey TEXT NOT NULL UNIQUE,
      requestPayloadJson TEXT,
      responsePayloadJson TEXT,
      createdAt TEXT NOT NULL,
      startedAt TEXT,
      finishedAt TEXT,
      errorCode TEXT,
      errorMessage TEXT
    );

    CREATE TABLE IF NOT EXISTS operational_tickets (
      ticketId TEXT PRIMARY KEY,
      displayNumber TEXT NOT NULL,
      source TEXT NOT NULL,
      sourceLabel TEXT NOT NULL,
      orderSessionId TEXT,
      lastTabId TEXT,
      lastCode TEXT,
      externalOrderId TEXT,
      tableName TEXT,
      customerName TEXT,
      itemsJson TEXT NOT NULL,
      notes TEXT,
      total INTEGER,
      currency TEXT,
      paid INTEGER NOT NULL,
      operationalStatus TEXT NOT NULL,
      printStatus TEXT NOT NULL,
      soundPolicy TEXT NOT NULL,
      soundPlayedAt TEXT,
      firstSeenAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      rawSourceHash TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS print_jobs (
      printJobId TEXT PRIMARY KEY,
      ticketId TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      payloadJson TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      printedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      locationId TEXT NOT NULL,
      lastTableId TEXT NOT NULL,
      name TEXT NOT NULL,
      qrToken TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS table_qr_mappings (
      id TEXT PRIMARY KEY,
      locationId TEXT NOT NULL,
      lastTableId TEXT NOT NULL,
      qrToken TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      tableNameSnapshot TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS upsell_rules (
      id TEXT PRIMARY KEY,
      triggerProductId TEXT NOT NULL,
      suggestProductId TEXT NOT NULL,
      timeSlot TEXT NOT NULL DEFAULT 'all',
      priority INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crosssell_rules (
      id TEXT PRIMARY KEY,
      ifHasCategoryId TEXT NOT NULL,
      ifMissingCategoryId TEXT NOT NULL,
      suggestProductId TEXT NOT NULL,
      timeSlot TEXT NOT NULL DEFAULT 'all',
      priority INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lastminute_items (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      timeSlot TEXT NOT NULL DEFAULT 'all',
      position INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bundle_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      productIds TEXT NOT NULL DEFAULT '[]',
      bundlePrice REAL,
      triggerProductId TEXT,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestion_events (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      engine TEXT NOT NULL,
      ruleId TEXT NOT NULL,
      suggestedProductId TEXT NOT NULL,
      outcome TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS composition_modal_rules (
      id TEXT PRIMARY KEY,
      triggerCategoryId TEXT NOT NULL,
      triggerCategoryName TEXT NOT NULL,
      sections TEXT NOT NULL DEFAULT '[]',
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_order_sessions_updated_at ON order_sessions(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_order_sessions_payment_sync_mode ON order_sessions(paymentStatus, lastSyncStatus, paymentMode);
    CREATE INDEX IF NOT EXISTS idx_order_sessions_channel ON order_sessions(channel);
    CREATE INDEX IF NOT EXISTS idx_order_sessions_created_at ON order_sessions(createdAt);
    CREATE INDEX IF NOT EXISTS idx_order_session_events_order_session_created_at ON order_session_events(orderSessionId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_last_order_links_last_code ON last_order_links(lastCode);
    CREATE INDEX IF NOT EXISTS idx_table_qr_mappings_last_table_enabled ON table_qr_mappings(lastTableId, enabled);
    CREATE INDEX IF NOT EXISTS idx_payment_devices_location ON payment_devices(locationId);
    CREATE INDEX IF NOT EXISTS idx_payment_devices_location_provider ON payment_devices(locationId, provider);
    CREATE INDEX IF NOT EXISTS idx_payment_devices_location_active ON payment_devices(locationId, isActive);
    CREATE INDEX IF NOT EXISTS idx_payment_jobs_order_session ON payment_jobs(orderSessionId);
    CREATE INDEX IF NOT EXISTS idx_payment_jobs_location_device_status ON payment_jobs(locationId, deviceId, status);
    CREATE INDEX IF NOT EXISTS idx_payment_jobs_status_created_at ON payment_jobs(status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_payment_jobs_device_created_at ON payment_jobs(deviceId, createdAt);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_jobs_running_per_device ON payment_jobs(deviceId) WHERE status = 'running';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_tickets_order_session ON operational_tickets(orderSessionId) WHERE orderSessionId IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_tickets_last_tab ON operational_tickets(lastTabId) WHERE lastTabId IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_operational_tickets_source_created_at ON operational_tickets(source, createdAt);
    CREATE INDEX IF NOT EXISTS idx_operational_tickets_print_status ON operational_tickets(printStatus);
    CREATE INDEX IF NOT EXISTS idx_operational_tickets_sound_policy_played ON operational_tickets(soundPolicy, soundPlayedAt);
    CREATE INDEX IF NOT EXISTS idx_operational_tickets_raw_source_hash ON operational_tickets(rawSourceHash);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_ticket ON print_jobs(ticketId);
    CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created_at ON print_jobs(status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_upsell_rules_trigger ON upsell_rules(triggerProductId, isActive);
    CREATE INDEX IF NOT EXISTS idx_crosssell_rules_category ON crosssell_rules(ifHasCategoryId, isActive);
    CREATE INDEX IF NOT EXISTS idx_lastminute_items_timeslot ON lastminute_items(timeSlot, isActive, position);
    CREATE INDEX IF NOT EXISTS idx_bundle_rules_trigger ON bundle_rules(triggerProductId, isActive);
    CREATE INDEX IF NOT EXISTS idx_suggestion_events_session ON suggestion_events(sessionId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_suggestion_events_engine_outcome ON suggestion_events(engine, outcome, createdAt);
    CREATE INDEX IF NOT EXISTS idx_composition_modal_rules_trigger ON composition_modal_rules(triggerCategoryId, isActive);
  `);

  ensureColumn('settings', 'cashdroBaseUrl', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('settings', 'paymentsSimulated', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('settings', 'cashdroUsername', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('settings', 'cashdroPassword', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('settings', 'cashdroPosId', `TEXT NOT NULL DEFAULT 'Kiosk'`);
  ensureColumn('settings', 'cashdroPosUser', `TEXT NOT NULL DEFAULT 'Caja'`);
  ensureColumn('settings', 'cashdroAllowInsecureTls', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('settings', 'printerMode', `TEXT NOT NULL DEFAULT 'disabled'`);
  ensureColumn('settings', 'escposHost', `TEXT NOT NULL DEFAULT ''`);
  ensureColumn('settings', 'escposPort', 'INTEGER NOT NULL DEFAULT 9100');
  ensureColumn('settings', 'logoUrl', `TEXT NOT NULL DEFAULT ''`);

  ensureColumn('operational_tickets', 'subtotal', 'INTEGER');
  ensureColumn('operational_tickets', 'discountTotal', 'INTEGER');
  ensureColumn('operational_tickets', 'estimatedReadyAt', 'TEXT');
  ensureColumn('composition_modal_rules', 'bannerTitle', `TEXT NOT NULL DEFAULT '¿Lo hacemos un menú?'`);
}

function seedSettings() {
  const defaults = createDefaultSettingsRow();
  db.prepare(`
    INSERT OR IGNORE INTO settings (
      id, restaurantName, organizationId, locationId, brandId, catalogId,
      source, pickupType, defaultOrderMode, theme,
      customerNameEnabled, customerNameRequired,
      customerPhoneEnabled, customerPhoneRequired,
      customerEmailEnabled, customerEmailRequired,
      generalNotesEnabled, productCommentsEnabled,
      featureModifiers, featureUpselling, featurePrintTicket,
      paymentMode, preferredPaymentMethod, paymentsSimulated,
      cashdroBaseUrl, cashdroUsername, cashdroPassword, cashdroPosId, cashdroPosUser, cashdroAllowInsecureTls,
      setupCompleted, updatedAt
    ) VALUES (
      @id, @restaurantName, @organizationId, @locationId, @brandId, @catalogId,
      @source, @pickupType, @defaultOrderMode, @theme,
      @customerNameEnabled, @customerNameRequired,
      @customerPhoneEnabled, @customerPhoneRequired,
      @customerEmailEnabled, @customerEmailRequired,
      @generalNotesEnabled, @productCommentsEnabled,
      @featureModifiers, @featureUpselling, @featurePrintTicket,
      @paymentMode, @preferredPaymentMethod, @paymentsSimulated,
      @cashdroBaseUrl, @cashdroUsername, @cashdroPassword, @cashdroPosId, @cashdroPosUser, @cashdroAllowInsecureTls,
      @setupCompleted, @updatedAt
    )
  `).run(defaults);
}

function removeLegacyDemoTableMapping() {
  db.prepare(`
    DELETE FROM table_qr_mappings
    WHERE qrToken = 'demo-table-token'
       OR id = 'table-demo'
       OR lastTableId = 'last-demo-table'
  `).run();
}

function migrateLegacyTablesToQrMappingsIfNeeded() {
  const hasLegacyTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tables'")
    .get() as { name: string } | undefined;

  if (!hasLegacyTables) {
    return;
  }

  const legacyRows = db.prepare(`
    SELECT id, locationId, lastTableId, name, qrToken, enabled, createdAt, updatedAt
    FROM tables
  `).all() as Array<{
    id: string;
    locationId: string;
    lastTableId: string;
    name: string;
    qrToken: string;
    enabled: number;
    createdAt: string;
    updatedAt: string;
  }>;

  const insert = db.prepare(`
    INSERT INTO table_qr_mappings (
      id, locationId, lastTableId, qrToken, enabled, tableNameSnapshot, createdAt, updatedAt
    ) VALUES (
      @id, @locationId, @lastTableId, @qrToken, @enabled, @tableNameSnapshot, @createdAt, @updatedAt
    )
    ON CONFLICT(qrToken) DO UPDATE SET
      id = excluded.id,
      locationId = excluded.locationId,
      lastTableId = excluded.lastTableId,
      enabled = excluded.enabled,
      tableNameSnapshot = COALESCE(table_qr_mappings.tableNameSnapshot, excluded.tableNameSnapshot),
      createdAt = table_qr_mappings.createdAt,
      updatedAt = excluded.updatedAt
  `);

  const transaction = db.transaction((rows: typeof legacyRows) => {
    for (const row of rows) {
      insert.run({
        id: row.id,
        locationId: row.locationId,
        lastTableId: row.lastTableId,
        qrToken: row.qrToken,
        enabled: row.enabled,
        tableNameSnapshot: row.name,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      });
    }
  });

  transaction(legacyRows);
}

function migrateLegacyConfigIfNeeded() {
  const legacy = readLegacyConfig();

  if (!legacy) {
    return;
  }

  const current = getSettingsRow();
  const defaults = createDefaultSettingsRow();
  const patch: Partial<SettingsRow> = {};

  if (!hasText(current.restaurantName) && hasText(legacy.restaurantName)) {
    patch.restaurantName = legacy.restaurantName.trim();
  }

  if (!hasText(current.organizationId) && hasText(legacy.lastApp?.organizationId)) {
    patch.organizationId = legacy.lastApp.organizationId.trim();
  }

  if (!hasText(current.locationId) && hasText(legacy.lastApp?.locationId)) {
    patch.locationId = legacy.lastApp.locationId.trim();
  }

  if (!hasText(current.brandId) && hasText(legacy.lastApp?.brandId)) {
    patch.brandId = legacy.lastApp.brandId.trim();
  }

  if (!hasText(current.catalogId) && hasText(legacy.lastApp?.catalogId)) {
    patch.catalogId = legacy.lastApp.catalogId.trim();
  }

  if (current.source === defaults.source && hasText(legacy.kiosk?.source)) {
    patch.source = legacy.kiosk.source.trim();
  }

  if (current.pickupType === defaults.pickupType && hasText(legacy.kiosk?.pickupType)) {
    patch.pickupType = legacy.kiosk.pickupType.trim();
  }

  if (current.defaultOrderMode === defaults.defaultOrderMode && hasText(legacy.kiosk?.defaultOrderMode)) {
    patch.defaultOrderMode = legacy.kiosk.defaultOrderMode.trim();
  }

  if (current.theme === defaults.theme && hasText(legacy.kiosk?.theme)) {
    patch.theme = normalizeThemeValue(legacy.kiosk.theme.trim());
  }

  if (typeof legacy.kiosk?.customerFields?.name?.enabled === 'boolean') {
    patch.customerNameEnabled = boolToInt(legacy.kiosk.customerFields.name.enabled);
  }

  if (typeof legacy.kiosk?.customerFields?.name?.required === 'boolean') {
    patch.customerNameRequired = boolToInt(legacy.kiosk.customerFields.name.required);
  }

  if (typeof legacy.kiosk?.customerFields?.phoneNumber?.enabled === 'boolean') {
    patch.customerPhoneEnabled = boolToInt(legacy.kiosk.customerFields.phoneNumber.enabled);
  }

  if (typeof legacy.kiosk?.customerFields?.phoneNumber?.required === 'boolean') {
    patch.customerPhoneRequired = boolToInt(legacy.kiosk.customerFields.phoneNumber.required);
  }

  if (typeof legacy.kiosk?.customerFields?.email?.enabled === 'boolean') {
    patch.customerEmailEnabled = boolToInt(legacy.kiosk.customerFields.email.enabled);
  }

  if (typeof legacy.kiosk?.customerFields?.email?.required === 'boolean') {
    patch.customerEmailRequired = boolToInt(legacy.kiosk.customerFields.email.required);
  }

  if (typeof legacy.kiosk?.notes?.generalEnabled === 'boolean') {
    patch.generalNotesEnabled = boolToInt(legacy.kiosk.notes.generalEnabled);
  } else if (typeof legacy.kiosk?.features?.notes === 'boolean') {
    patch.generalNotesEnabled = boolToInt(legacy.kiosk.features.notes);
  }

  if (typeof legacy.kiosk?.notes?.productCommentsEnabled === 'boolean') {
    patch.productCommentsEnabled = boolToInt(legacy.kiosk.notes.productCommentsEnabled);
  }

  if (typeof legacy.kiosk?.features?.modifiers === 'boolean') {
    patch.featureModifiers = boolToInt(legacy.kiosk.features.modifiers);
  }

  if (typeof legacy.kiosk?.features?.upselling === 'boolean') {
    patch.featureUpselling = boolToInt(legacy.kiosk.features.upselling);
  }

  if (typeof legacy.kiosk?.features?.printTicket === 'boolean') {
    patch.featurePrintTicket = boolToInt(legacy.kiosk.features.printTicket);
  }

  if (hasText(legacy.kiosk?.payment?.mode)) {
    patch.paymentMode = legacy.kiosk.payment.mode.trim();
  }

  if (hasText(legacy.kiosk?.payment?.preferredPaymentMethod)) {
    patch.preferredPaymentMethod = legacy.kiosk.payment.preferredPaymentMethod.trim();
  }

  if (Object.keys(patch).length > 0) {
    updateSettingsRow(patch);
  }
}

export function getSettingsRow(): SettingsRow {
  return db.prepare('SELECT * FROM settings WHERE id = ?').get('main') as SettingsRow;
}

export function updateSettingsRow(patch: Partial<SettingsRow>) {
  const current = getSettingsRow();
  const next: SettingsRow = {
    ...current,
    ...patch,
    setupCompleted:
      patch.setupCompleted ??
      computeSetupCompleted({
        organizationId: patch.organizationId ?? current.organizationId,
        locationId: patch.locationId ?? current.locationId,
        brandId: patch.brandId ?? current.brandId,
        catalogId: patch.catalogId ?? current.catalogId
      }),
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE settings SET
      restaurantName = @restaurantName,
      organizationId = @organizationId,
      locationId = @locationId,
      brandId = @brandId,
      catalogId = @catalogId,
      source = @source,
      pickupType = @pickupType,
      defaultOrderMode = @defaultOrderMode,
      theme = @theme,
      customerNameEnabled = @customerNameEnabled,
      customerNameRequired = @customerNameRequired,
      customerPhoneEnabled = @customerPhoneEnabled,
      customerPhoneRequired = @customerPhoneRequired,
      customerEmailEnabled = @customerEmailEnabled,
      customerEmailRequired = @customerEmailRequired,
      generalNotesEnabled = @generalNotesEnabled,
      productCommentsEnabled = @productCommentsEnabled,
      featureModifiers = @featureModifiers,
      featureUpselling = @featureUpselling,
      featurePrintTicket = @featurePrintTicket,
      paymentMode = @paymentMode,
      preferredPaymentMethod = @preferredPaymentMethod,
      paymentsSimulated = @paymentsSimulated,
      cashdroBaseUrl = @cashdroBaseUrl,
      cashdroUsername = @cashdroUsername,
      cashdroPassword = @cashdroPassword,
      cashdroPosId = @cashdroPosId,
      cashdroPosUser = @cashdroPosUser,
      cashdroAllowInsecureTls = @cashdroAllowInsecureTls,
      printerMode = @printerMode,
      escposHost = @escposHost,
      escposPort = @escposPort,
      setupCompleted = @setupCompleted,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);

  return next;
}

export function saveCatalogCache(catalogId: string, rawJson: string) {
  db.prepare(`
    INSERT INTO catalog_cache (catalogId, rawJson, syncedAt)
    VALUES (@catalogId, @rawJson, @syncedAt)
    ON CONFLICT(catalogId) DO UPDATE SET
      rawJson = excluded.rawJson,
      syncedAt = excluded.syncedAt
  `).run({
    catalogId,
    rawJson,
    syncedAt: nowIso()
  });
}

export function getCatalogCache(catalogId: string) {
  return db.prepare('SELECT * FROM catalog_cache WHERE catalogId = ?').get(catalogId) as
    | { catalogId: string; rawJson: string; syncedAt: string }
    | undefined;
}

export function createOrderRecord(input: {
  orderCode: string;
  customerName: string | null;
  total: number;
  rawPayload: unknown;
}) {
  const record: OrderRow = {
    id: randomUUID(),
    orderCode: input.orderCode,
    lastTabId: null,
    customerName: input.customerName,
    total: input.total,
    status: 'pending',
    rawPayload: JSON.stringify(input.rawPayload),
    rawResponse: null,
    error: null,
    createdAt: nowIso()
  };

  db.prepare(`
    INSERT INTO orders (
      id, orderCode, lastTabId, customerName, total, status,
      rawPayload, rawResponse, error, createdAt
    ) VALUES (
      @id, @orderCode, @lastTabId, @customerName, @total, @status,
      @rawPayload, @rawResponse, @error, @createdAt
    )
  `).run(record);

  return record;
}

export function updateOrderRecord(
  orderId: string,
  patch: Partial<Pick<OrderRow, 'lastTabId' | 'status' | 'rawPayload' | 'rawResponse' | 'error' | 'total'>>
) {
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow;

  if (!current) {
    return null;
  }

  const next: OrderRow = {
    ...current,
    ...patch
  };

  db.prepare(`
    UPDATE orders SET
      lastTabId = @lastTabId,
      total = @total,
      status = @status,
      rawPayload = @rawPayload,
      rawResponse = @rawResponse,
      error = @error
    WHERE id = @id
  `).run(next);

  return next;
}

export function createOrderEvent(input: {
  orderId: string;
  type: string;
  message: string;
  rawJson?: unknown;
}) {
  const event: OrderEventRow = {
    id: randomUUID(),
    orderId: input.orderId,
    type: input.type,
    message: input.message,
    rawJson: input.rawJson === undefined ? null : JSON.stringify(input.rawJson),
    createdAt: nowIso()
  };

  db.prepare(`
    INSERT INTO order_events (id, orderId, type, message, rawJson, createdAt)
    VALUES (@id, @orderId, @type, @message, @rawJson, @createdAt)
  `).run(event);

  return event;
}

function mapOrderRow(row: OrderRow) {
  return {
    ...row,
    rawPayload: parseJson(row.rawPayload),
    rawResponse: parseJson(row.rawResponse)
  };
}

function mapOrderEventRow(row: OrderEventRow) {
  return {
    ...row,
    rawJson: parseJson(row.rawJson)
  };
}

export function listRecentOrders(limit = 50) {
  const rows = db
    .prepare('SELECT * FROM orders ORDER BY datetime(createdAt) DESC, rowid DESC LIMIT ?')
    .all(limit) as OrderRow[];

  return rows.map(mapOrderRow);
}

export function getOrderById(orderId: string) {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow | undefined;
  return row ? mapOrderRow(row) : null;
}

export function listOrderEvents(orderId: string) {
  const rows = db
    .prepare('SELECT * FROM order_events WHERE orderId = ? ORDER BY datetime(createdAt) ASC, rowid ASC')
    .all(orderId) as OrderEventRow[];

  return rows.map(mapOrderEventRow);
}

function serializeNullableJson(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function mapOrderSessionToRow(session: OrderSessionRecord): OrderSessionRow {
  return {
    orderSessionId: session.orderSessionId,
    externalId: session.externalId,
    organizationId: session.organizationId,
    locationId: session.locationId,
    brandId: session.brandId,
    catalogId: session.catalogId,
    tableId: session.tableId ?? null,
    lastTableId: session.lastTableId ?? null,
    tableNameSnapshot: session.tableNameSnapshot ?? null,
    channel: session.channel,
    source: session.source ?? null,
    restaurantSlug: session.restaurantSlug ?? null,
    operationalStatus: session.operationalStatus,
    paymentStatus: session.paymentStatus,
    lastSyncStatus: session.lastSyncStatus,
    customerJson: serializeNullableJson(session.customer),
    notes: session.notes ?? null,
    itemsJson: JSON.stringify(session.items),
    subtotal: session.subtotal,
    discountTotal: session.discountTotal,
    total: session.total,
    currency: session.currency,
    paymentMode: session.paymentMode,
    stripePaymentIntentId: session.stripePaymentIntentId ?? null,
    stripeCheckoutSessionId: session.stripeCheckoutSessionId ?? null,
    pin4: session.pin4 ?? null,
    qrToken: session.qrToken ?? null,
    expiresAt: session.expiresAt ?? null,
    preparationTimeMode: session.preparationTimeMode ?? null,
    suggestedPreparationMinutes: session.suggestedPreparationMinutes ?? null,
    confirmedPreparationMinutes: session.confirmedPreparationMinutes ?? null,
    estimatedReadyAt: session.estimatedReadyAt ?? null,
    pickupTimeSyncedToLast: session.pickupTimeSyncedToLast ?? null,
    pickupTimeSyncStatus: session.pickupTimeSyncStatus ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

export function createOrderSession(input: OrderSessionRecord) {
  const row = mapOrderSessionToRow(input);

  db.prepare(`
    INSERT INTO order_sessions (
      orderSessionId, externalId, organizationId, locationId, brandId, catalogId,
      tableId, lastTableId, tableNameSnapshot,
      channel, source, restaurantSlug,
      operationalStatus, paymentStatus, lastSyncStatus,
      customerJson, notes, itemsJson,
      subtotal, discountTotal, total, currency,
      paymentMode, stripePaymentIntentId, stripeCheckoutSessionId,
      pin4, qrToken, expiresAt,
      preparationTimeMode, suggestedPreparationMinutes, confirmedPreparationMinutes,
      estimatedReadyAt, pickupTimeSyncedToLast, pickupTimeSyncStatus,
      createdAt, updatedAt
    ) VALUES (
      @orderSessionId, @externalId, @organizationId, @locationId, @brandId, @catalogId,
      @tableId, @lastTableId, @tableNameSnapshot,
      @channel, @source, @restaurantSlug,
      @operationalStatus, @paymentStatus, @lastSyncStatus,
      @customerJson, @notes, @itemsJson,
      @subtotal, @discountTotal, @total, @currency,
      @paymentMode, @stripePaymentIntentId, @stripeCheckoutSessionId,
      @pin4, @qrToken, @expiresAt,
      @preparationTimeMode, @suggestedPreparationMinutes, @confirmedPreparationMinutes,
      @estimatedReadyAt, @pickupTimeSyncedToLast, @pickupTimeSyncStatus,
      @createdAt, @updatedAt
    )
  `).run(row);

  return input;
}

export function getOrderSessionById(orderSessionId: string) {
  const row = db.prepare('SELECT * FROM order_sessions WHERE orderSessionId = ?').get(orderSessionId) as
    | OrderSessionRow
    | undefined;
  return row ? mapOrderSessionRow(row) : null;
}

export function getOrderSessionByExternalId(externalId: string) {
  const row = db.prepare('SELECT * FROM order_sessions WHERE externalId = ?').get(externalId) as
    | OrderSessionRow
    | undefined;
  return row ? mapOrderSessionRow(row) : null;
}

export function updateOrderSession(
  orderSessionId: string,
  patch: Partial<OrderSessionRecord>
) {
  const current = db.prepare('SELECT * FROM order_sessions WHERE orderSessionId = ?').get(orderSessionId) as
    | OrderSessionRow
    | undefined;

  if (!current) {
    return null;
  }

  const next: OrderSessionRecord = {
    ...mapOrderSessionRow(current),
    ...patch,
    updatedAt: patch.updatedAt ?? nowIso()
  };

  const row = mapOrderSessionToRow(next);

  db.prepare(`
    UPDATE order_sessions SET
      externalId = @externalId,
      organizationId = @organizationId,
      locationId = @locationId,
      brandId = @brandId,
      catalogId = @catalogId,
      tableId = @tableId,
      lastTableId = @lastTableId,
      tableNameSnapshot = @tableNameSnapshot,
      channel = @channel,
      source = @source,
      restaurantSlug = @restaurantSlug,
      operationalStatus = @operationalStatus,
      paymentStatus = @paymentStatus,
      lastSyncStatus = @lastSyncStatus,
      customerJson = @customerJson,
      notes = @notes,
      itemsJson = @itemsJson,
      subtotal = @subtotal,
      discountTotal = @discountTotal,
      total = @total,
      currency = @currency,
      paymentMode = @paymentMode,
      stripePaymentIntentId = @stripePaymentIntentId,
      stripeCheckoutSessionId = @stripeCheckoutSessionId,
      pin4 = @pin4,
      qrToken = @qrToken,
      expiresAt = @expiresAt,
      preparationTimeMode = @preparationTimeMode,
      suggestedPreparationMinutes = @suggestedPreparationMinutes,
      confirmedPreparationMinutes = @confirmedPreparationMinutes,
      estimatedReadyAt = @estimatedReadyAt,
      pickupTimeSyncedToLast = @pickupTimeSyncedToLast,
      pickupTimeSyncStatus = @pickupTimeSyncStatus,
      updatedAt = @updatedAt
    WHERE orderSessionId = @orderSessionId
  `).run(row);

  return next;
}

export function listOrderSessions(filters?: {
  active?: boolean;
  since?: string;
  limit?: number;
  paymentStatus?: string;
  lastSyncStatus?: string;
  channel?: string;
  paymentMode?: string;
}) {
  const rows = db
    .prepare('SELECT * FROM order_sessions ORDER BY datetime(updatedAt) DESC, rowid DESC')
    .all() as OrderSessionRow[];

  let items = rows.map(mapOrderSessionRow);

  if (filters?.paymentStatus) {
    items = items.filter((item) => item.paymentStatus === filters.paymentStatus);
  }

  if (filters?.lastSyncStatus) {
    items = items.filter((item) => item.lastSyncStatus === filters.lastSyncStatus);
  }

  if (filters?.channel) {
    items = items.filter((item) => item.channel === filters.channel);
  }

  if (filters?.paymentMode) {
    items = items.filter((item) => item.paymentMode === filters.paymentMode);
  }

  if (filters?.since) {
    const sinceDate = new Date(filters.since);
    if (!Number.isNaN(sinceDate.getTime())) {
      items = items.filter((item) => new Date(item.updatedAt).getTime() > sinceDate.getTime());
    }
  }

  if (filters?.active) {
    items = items.filter((item) => {
      if (['pending', 'accepted', 'preparing', 'ready'].includes(item.operationalStatus)) {
        return true;
      }

      if (
        item.paymentStatus === 'unpaid' &&
        item.paymentMode === 'cashier'
      ) {
        return true;
      }

      return item.paymentStatus === 'paid' && item.lastSyncStatus === 'sync_failed';
    });
  }

  const total = items.length;
  const limit = Math.max(1, Math.min(filters?.limit ?? 100, 100));
  return {
    items: items.slice(0, limit),
    total,
    polledAt: nowIso()
  };
}

export function appendOrderSessionEvent(input: {
  orderSessionId: string;
  type: string;
  actorType: OrderSessionEvent['actorType'];
  actorId?: string | null;
  rawJson?: unknown;
}) {
  const event: OrderSessionEventRow = {
    id: randomUUID(),
    orderSessionId: input.orderSessionId,
    type: input.type,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    rawJson: input.rawJson === undefined ? null : JSON.stringify(input.rawJson),
    createdAt: nowIso()
  };

  db.prepare(`
    INSERT INTO order_session_events (id, orderSessionId, type, actorType, actorId, rawJson, createdAt)
    VALUES (@id, @orderSessionId, @type, @actorType, @actorId, @rawJson, @createdAt)
  `).run(event);

  return mapOrderSessionEventRow(event);
}

export function listOrderSessionEvents(orderSessionId: string) {
  const rows = db
    .prepare('SELECT * FROM order_session_events WHERE orderSessionId = ? ORDER BY datetime(createdAt) ASC, rowid ASC')
    .all(orderSessionId) as OrderSessionEventRow[];

  return rows.map(mapOrderSessionEventRow);
}

export function upsertLastOrderLink(input: {
  orderSessionId: string;
  lastTabId?: string | null;
  lastBillId?: string | null;
  lastPaymentId?: string | null;
  lastCode?: string | null;
  lastPayloadHash?: string | null;
}) {
  const existing = db.prepare('SELECT * FROM last_order_links WHERE orderSessionId = ?').get(input.orderSessionId) as
    | LastOrderLinkRow
    | undefined;

  const timestamp = nowIso();
  const record: LastOrderLinkRow = existing
    ? {
        ...existing,
        lastTabId: input.lastTabId ?? existing.lastTabId,
        lastBillId: input.lastBillId ?? existing.lastBillId,
        lastPaymentId: input.lastPaymentId ?? existing.lastPaymentId,
        lastCode: input.lastCode ?? existing.lastCode,
        lastPayloadHash: input.lastPayloadHash ?? existing.lastPayloadHash,
        updatedAt: timestamp
      }
    : {
        id: randomUUID(),
        orderSessionId: input.orderSessionId,
        lastTabId: input.lastTabId ?? null,
        lastBillId: input.lastBillId ?? null,
        lastPaymentId: input.lastPaymentId ?? null,
        lastCode: input.lastCode ?? null,
        lastPayloadHash: input.lastPayloadHash ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

  db.prepare(`
    INSERT INTO last_order_links (
      id, orderSessionId, lastTabId, lastBillId, lastPaymentId, lastCode, lastPayloadHash, createdAt, updatedAt
    ) VALUES (
      @id, @orderSessionId, @lastTabId, @lastBillId, @lastPaymentId, @lastCode, @lastPayloadHash, @createdAt, @updatedAt
    )
    ON CONFLICT(orderSessionId) DO UPDATE SET
      lastTabId = excluded.lastTabId,
      lastBillId = excluded.lastBillId,
      lastPaymentId = excluded.lastPaymentId,
      lastCode = excluded.lastCode,
      lastPayloadHash = excluded.lastPayloadHash,
      updatedAt = excluded.updatedAt
  `).run(record);

  return mapLastOrderLinkRow(record);
}

export function getLastOrderLinkByOrderSessionId(orderSessionId: string) {
  const row = db.prepare('SELECT * FROM last_order_links WHERE orderSessionId = ?').get(orderSessionId) as
    | LastOrderLinkRow
    | undefined;
  return row ? mapLastOrderLinkRow(row) : null;
}

export function getCashdroPaymentByOrderSessionId(orderSessionId: string) {
  const row = db.prepare('SELECT * FROM cashdro_payments WHERE orderSessionId = ?').get(orderSessionId) as
    | CashdroPaymentRow
    | undefined;
  return row ? mapCashdroPaymentRow(row) : null;
}

export function upsertCashdroPayment(input: {
  orderSessionId: string;
  operationId: string;
  aliasId?: string | null;
  workflowStatus: string;
  state?: string | null;
  total: number;
  totalIn?: number;
  totalOut?: number;
  changeNotAvailable?: number;
  payInProgress?: string | null;
  payOutProgress?: string | null;
  withError?: boolean;
  messages?: number[];
  rawJson?: Record<string, unknown> | null;
  importedAt?: string | null;
  completedAt?: string | null;
}) {
  const existing = db.prepare('SELECT * FROM cashdro_payments WHERE orderSessionId = ?').get(input.orderSessionId) as
    | CashdroPaymentRow
    | undefined;
  const timestamp = nowIso();
  const record: CashdroPaymentRow = existing
    ? {
        ...existing,
        operationId: input.operationId,
        aliasId: input.aliasId ?? existing.aliasId,
        workflowStatus: input.workflowStatus,
        state: input.state ?? existing.state,
        total: input.total,
        totalIn: input.totalIn ?? existing.totalIn,
        totalOut: input.totalOut ?? existing.totalOut,
        changeNotAvailable: input.changeNotAvailable ?? existing.changeNotAvailable,
        payInProgress: input.payInProgress ?? existing.payInProgress,
        payOutProgress: input.payOutProgress ?? existing.payOutProgress,
        withError: boolToInt(input.withError ?? existing.withError === 1),
        messagesJson: JSON.stringify(input.messages ?? (parseJson<number[]>(existing.messagesJson) ?? [])),
        rawJson: input.rawJson === undefined ? existing.rawJson : serializeNullableJson(input.rawJson),
        importedAt: input.importedAt === undefined ? existing.importedAt : input.importedAt,
        completedAt: input.completedAt === undefined ? existing.completedAt : input.completedAt,
        updatedAt: timestamp
      }
    : {
        id: randomUUID(),
        orderSessionId: input.orderSessionId,
        operationId: input.operationId,
        aliasId: input.aliasId ?? null,
        workflowStatus: input.workflowStatus,
        state: input.state ?? null,
        total: input.total,
        totalIn: input.totalIn ?? 0,
        totalOut: input.totalOut ?? 0,
        changeNotAvailable: input.changeNotAvailable ?? 0,
        payInProgress: input.payInProgress ?? null,
        payOutProgress: input.payOutProgress ?? null,
        withError: boolToInt(input.withError ?? false),
        messagesJson: JSON.stringify(input.messages ?? []),
        rawJson: serializeNullableJson(input.rawJson),
        importedAt: input.importedAt ?? null,
        completedAt: input.completedAt ?? null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

  db.prepare(`
    INSERT INTO cashdro_payments (
      id, orderSessionId, operationId, aliasId, workflowStatus, state,
      total, totalIn, totalOut, changeNotAvailable,
      payInProgress, payOutProgress, withError, messagesJson, rawJson,
      importedAt, completedAt, createdAt, updatedAt
    ) VALUES (
      @id, @orderSessionId, @operationId, @aliasId, @workflowStatus, @state,
      @total, @totalIn, @totalOut, @changeNotAvailable,
      @payInProgress, @payOutProgress, @withError, @messagesJson, @rawJson,
      @importedAt, @completedAt, @createdAt, @updatedAt
    )
    ON CONFLICT(orderSessionId) DO UPDATE SET
      operationId = excluded.operationId,
      aliasId = excluded.aliasId,
      workflowStatus = excluded.workflowStatus,
      state = excluded.state,
      total = excluded.total,
      totalIn = excluded.totalIn,
      totalOut = excluded.totalOut,
      changeNotAvailable = excluded.changeNotAvailable,
      payInProgress = excluded.payInProgress,
      payOutProgress = excluded.payOutProgress,
      withError = excluded.withError,
      messagesJson = excluded.messagesJson,
      rawJson = excluded.rawJson,
      importedAt = excluded.importedAt,
      completedAt = excluded.completedAt,
      updatedAt = excluded.updatedAt
  `).run(record);

  return mapCashdroPaymentRow(record);
}

export function createPaymentDevice(input: {
  locationId: string;
  provider: PaymentProvider;
  displayName: string;
  mode: PaymentDeviceMode;
  configured: boolean;
  isActive: boolean;
  configJson?: string | null;
}) {
  const timestamp = nowIso();
  const row: PaymentDeviceRow = {
    id: randomUUID(),
    locationId: input.locationId,
    provider: input.provider,
    displayName: input.displayName,
    mode: input.mode,
    configured: boolToInt(input.configured),
    isActive: boolToInt(input.isActive),
    configJson: input.configJson ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.prepare(`
    INSERT INTO payment_devices (
      id, locationId, provider, displayName, mode, configured, isActive, configJson, createdAt, updatedAt
    ) VALUES (
      @id, @locationId, @provider, @displayName, @mode, @configured, @isActive, @configJson, @createdAt, @updatedAt
    )
  `).run(row);

  return mapPaymentDeviceRow(row);
}

export function getPaymentDeviceById(id: string) {
  const row = db.prepare('SELECT * FROM payment_devices WHERE id = ?').get(id) as PaymentDeviceRow | undefined;
  return row ? mapPaymentDeviceRow(row) : null;
}

export function listPaymentDevices(filters?: {
  locationId?: string;
  provider?: PaymentProvider;
  activeOnly?: boolean;
}) {
  const rows = db
    .prepare('SELECT * FROM payment_devices ORDER BY locationId ASC, provider ASC, datetime(updatedAt) DESC, rowid DESC')
    .all() as PaymentDeviceRow[];

  let items = rows.map(mapPaymentDeviceRow);
  if (filters?.locationId) {
    items = items.filter((item) => item.locationId === filters.locationId);
  }
  if (filters?.provider) {
    items = items.filter((item) => item.provider === filters.provider);
  }
  if (filters?.activeOnly) {
    items = items.filter((item) => item.isActive);
  }
  return items;
}

export function updatePaymentDevice(id: string, patch: Partial<PaymentDeviceRecord>) {
  const current = db.prepare('SELECT * FROM payment_devices WHERE id = ?').get(id) as PaymentDeviceRow | undefined;
  if (!current) {
    return null;
  }

  const next: PaymentDeviceRow = {
    ...current,
    locationId: patch.locationId ?? current.locationId,
    provider: patch.provider ?? current.provider,
    displayName: patch.displayName ?? current.displayName,
    mode: patch.mode ?? current.mode,
    configured: patch.configured === undefined ? current.configured : boolToInt(patch.configured),
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
    configJson: patch.configJson === undefined ? current.configJson : patch.configJson,
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE payment_devices SET
      locationId = @locationId,
      provider = @provider,
      displayName = @displayName,
      mode = @mode,
      configured = @configured,
      isActive = @isActive,
      configJson = @configJson,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);

  return mapPaymentDeviceRow(next);
}

export function createPaymentJobRecord(input: {
  orderSessionId: string;
  locationId: string;
  deviceId: string;
  provider: PaymentProvider;
  status: PaymentJobStatus;
  idempotencyKey: string;
  requestPayloadJson?: string | null;
  responsePayloadJson?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const timestamp = nowIso();
  const row: PaymentJobRow = {
    id: randomUUID(),
    orderSessionId: input.orderSessionId,
    locationId: input.locationId,
    deviceId: input.deviceId,
    provider: input.provider,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    requestPayloadJson: input.requestPayloadJson ?? null,
    responsePayloadJson: input.responsePayloadJson ?? null,
    createdAt: timestamp,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null
  };

  db.prepare(`
    INSERT INTO payment_jobs (
      id, orderSessionId, locationId, deviceId, provider, status, idempotencyKey,
      requestPayloadJson, responsePayloadJson, createdAt, startedAt, finishedAt, errorCode, errorMessage
    ) VALUES (
      @id, @orderSessionId, @locationId, @deviceId, @provider, @status, @idempotencyKey,
      @requestPayloadJson, @responsePayloadJson, @createdAt, @startedAt, @finishedAt, @errorCode, @errorMessage
    )
  `).run(row);

  return mapPaymentJobRow(row);
}

export function getPaymentJobById(id: string) {
  const row = db.prepare('SELECT * FROM payment_jobs WHERE id = ?').get(id) as PaymentJobRow | undefined;
  return row ? mapPaymentJobRow(row) : null;
}

export function getPaymentJobByIdempotencyKey(idempotencyKey: string) {
  const row = db.prepare('SELECT * FROM payment_jobs WHERE idempotencyKey = ?').get(idempotencyKey) as PaymentJobRow | undefined;
  return row ? mapPaymentJobRow(row) : null;
}

export function getRunningPaymentJobByDeviceId(deviceId: string) {
  const row = db.prepare(`
    SELECT * FROM payment_jobs
    WHERE deviceId = ?
      AND status = 'running'
    ORDER BY datetime(createdAt) ASC, rowid ASC
    LIMIT 1
  `).get(deviceId) as PaymentJobRow | undefined;
  return row ? mapPaymentJobRow(row) : null;
}

export function getQueuedPaymentJobByDeviceId(deviceId: string) {
  const row = db.prepare(`
    SELECT * FROM payment_jobs
    WHERE deviceId = ?
      AND status = 'queued'
    ORDER BY datetime(createdAt) ASC, rowid ASC
    LIMIT 1
  `).get(deviceId) as PaymentJobRow | undefined;
  return row ? mapPaymentJobRow(row) : null;
}

export function listPaymentJobs(filters?: {
  locationId?: string;
  deviceId?: string;
  orderSessionId?: string;
  status?: PaymentJobStatus;
}) {
  const rows = db
    .prepare('SELECT * FROM payment_jobs ORDER BY datetime(createdAt) DESC, rowid DESC')
    .all() as PaymentJobRow[];

  let items = rows.map(mapPaymentJobRow);
  if (filters?.locationId) {
    items = items.filter((item) => item.locationId === filters.locationId);
  }
  if (filters?.deviceId) {
    items = items.filter((item) => item.deviceId === filters.deviceId);
  }
  if (filters?.orderSessionId) {
    items = items.filter((item) => item.orderSessionId === filters.orderSessionId);
  }
  if (filters?.status) {
    items = items.filter((item) => item.status === filters.status);
  }
  return items;
}

export function updatePaymentJob(id: string, patch: Partial<PaymentJobRecord>) {
  const current = db.prepare('SELECT * FROM payment_jobs WHERE id = ?').get(id) as PaymentJobRow | undefined;
  if (!current) {
    return null;
  }

  const next: PaymentJobRow = {
    ...current,
    orderSessionId: patch.orderSessionId ?? current.orderSessionId,
    locationId: patch.locationId ?? current.locationId,
    deviceId: patch.deviceId ?? current.deviceId,
    provider: patch.provider ?? current.provider,
    status: patch.status ?? current.status,
    idempotencyKey: patch.idempotencyKey ?? current.idempotencyKey,
    requestPayloadJson: patch.requestPayloadJson === undefined ? current.requestPayloadJson : patch.requestPayloadJson,
    responsePayloadJson: patch.responsePayloadJson === undefined ? current.responsePayloadJson : patch.responsePayloadJson,
    createdAt: patch.createdAt ?? current.createdAt,
    startedAt: patch.startedAt === undefined ? current.startedAt : patch.startedAt,
    finishedAt: patch.finishedAt === undefined ? current.finishedAt : patch.finishedAt,
    errorCode: patch.errorCode === undefined ? current.errorCode : patch.errorCode,
    errorMessage: patch.errorMessage === undefined ? current.errorMessage : patch.errorMessage
  };

  db.prepare(`
    UPDATE payment_jobs SET
      orderSessionId = @orderSessionId,
      locationId = @locationId,
      deviceId = @deviceId,
      provider = @provider,
      status = @status,
      idempotencyKey = @idempotencyKey,
      requestPayloadJson = @requestPayloadJson,
      responsePayloadJson = @responsePayloadJson,
      createdAt = @createdAt,
      startedAt = @startedAt,
      finishedAt = @finishedAt,
      errorCode = @errorCode,
      errorMessage = @errorMessage
    WHERE id = @id
  `).run(next);

  return mapPaymentJobRow(next);
}

export function countOperationalTicketsBySourceAndDay(source: OperationalTicketRecord['source'], dayStartIso: string, nextDayIso: string) {
  const row = db.prepare(`
    SELECT COUNT(*) as total
    FROM operational_tickets
    WHERE source = ?
      AND createdAt >= ?
      AND createdAt < ?
  `).get(source, dayStartIso, nextDayIso) as { total: number };

  return row.total;
}

export function createOperationalTicket(input: OperationalTicketRecord) {
  const row = mapOperationalTicketToRow(input);
  db.prepare(`
    INSERT INTO operational_tickets (
      ticketId, displayNumber, source, sourceLabel, orderSessionId, lastTabId, lastCode, externalOrderId,
      tableName, customerName, itemsJson, notes, subtotal, discountTotal, total, currency, estimatedReadyAt,
      paid, operationalStatus, printStatus,
      soundPolicy, soundPlayedAt, firstSeenAt, lastSeenAt, rawSourceHash, createdAt, updatedAt
    ) VALUES (
      @ticketId, @displayNumber, @source, @sourceLabel, @orderSessionId, @lastTabId, @lastCode, @externalOrderId,
      @tableName, @customerName, @itemsJson, @notes, @subtotal, @discountTotal, @total, @currency, @estimatedReadyAt,
      @paid, @operationalStatus, @printStatus,
      @soundPolicy, @soundPlayedAt, @firstSeenAt, @lastSeenAt, @rawSourceHash, @createdAt, @updatedAt
    )
  `).run(row);

  return mapOperationalTicketRow(row);
}

export function getOperationalTicketById(ticketId: string) {
  const row = db.prepare('SELECT * FROM operational_tickets WHERE ticketId = ?').get(ticketId) as OperationalTicketRow | undefined;
  return row ? mapOperationalTicketRow(row) : null;
}

export function getOperationalTicketByOrderSessionId(orderSessionId: string) {
  const row = db.prepare('SELECT * FROM operational_tickets WHERE orderSessionId = ?').get(orderSessionId) as OperationalTicketRow | undefined;
  return row ? mapOperationalTicketRow(row) : null;
}

export function getOperationalTicketByLastTabId(lastTabId: string) {
  const row = db.prepare('SELECT * FROM operational_tickets WHERE lastTabId = ?').get(lastTabId) as OperationalTicketRow | undefined;
  return row ? mapOperationalTicketRow(row) : null;
}

export function getOperationalTicketByRawSourceHash(rawSourceHash: string) {
  const row = db.prepare('SELECT * FROM operational_tickets WHERE rawSourceHash = ?').get(rawSourceHash) as OperationalTicketRow | undefined;
  return row ? mapOperationalTicketRow(row) : null;
}

export function listOperationalTickets(filters?: {
  source?: OperationalTicketRecord['source'];
  printStatus?: OperationalTicketRecord['printStatus'];
  since?: string;
  activeOnly?: boolean;
}) {
  const rows = db
    .prepare('SELECT * FROM operational_tickets ORDER BY datetime(createdAt) DESC, rowid DESC')
    .all() as OperationalTicketRow[];

  let items = rows.map(mapOperationalTicketRow);
  if (filters?.source) {
    items = items.filter((item) => item.source === filters.source);
  }
  if (filters?.printStatus) {
    items = items.filter((item) => item.printStatus === filters.printStatus);
  }
  if (filters?.since) {
    const sinceMs = new Date(filters.since).getTime();
    if (!Number.isNaN(sinceMs)) {
      items = items.filter((item) => new Date(item.createdAt).getTime() >= sinceMs);
    }
  }
  if (filters?.activeOnly) {
    items = items.filter((item) => item.operationalStatus !== 'delivered' && item.operationalStatus !== 'cancelled');
  }
  return items;
}

export function updateOperationalTicket(ticketId: string, patch: Partial<OperationalTicketRecord>) {
  const current = db.prepare('SELECT * FROM operational_tickets WHERE ticketId = ?').get(ticketId) as OperationalTicketRow | undefined;
  if (!current) {
    return null;
  }

  const next = mapOperationalTicketToRow({
    ...mapOperationalTicketRow(current),
    ...patch,
    items: patch.items ?? mapOperationalTicketRow(current).items,
    updatedAt: patch.updatedAt ?? nowIso(),
  });

  db.prepare(`
    UPDATE operational_tickets SET
      displayNumber = @displayNumber,
      source = @source,
      sourceLabel = @sourceLabel,
      orderSessionId = @orderSessionId,
      lastTabId = @lastTabId,
      lastCode = @lastCode,
      externalOrderId = @externalOrderId,
      tableName = @tableName,
      customerName = @customerName,
      itemsJson = @itemsJson,
      notes = @notes,
      subtotal = @subtotal,
      discountTotal = @discountTotal,
      total = @total,
      currency = @currency,
      estimatedReadyAt = @estimatedReadyAt,
      paid = @paid,
      operationalStatus = @operationalStatus,
      printStatus = @printStatus,
      soundPolicy = @soundPolicy,
      soundPlayedAt = @soundPlayedAt,
      firstSeenAt = @firstSeenAt,
      lastSeenAt = @lastSeenAt,
      rawSourceHash = @rawSourceHash,
      createdAt = @createdAt,
      updatedAt = @updatedAt
    WHERE ticketId = @ticketId
  `).run(next);

  return mapOperationalTicketRow(next);
}

export function createPrintJobRecord(input: PrintJobRecord) {
  const row: PrintJobRow = {
    printJobId: input.printJobId,
    ticketId: input.ticketId,
    status: input.status,
    mode: input.mode,
    payloadJson: input.payloadJson,
    attempts: input.attempts,
    lastError: input.lastError ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    printedAt: input.printedAt ?? null,
  };

  db.prepare(`
    INSERT INTO print_jobs (
      printJobId, ticketId, status, mode, payloadJson, attempts, lastError, createdAt, updatedAt, printedAt
    ) VALUES (
      @printJobId, @ticketId, @status, @mode, @payloadJson, @attempts, @lastError, @createdAt, @updatedAt, @printedAt
    )
  `).run(row);

  return mapPrintJobRow(row);
}

export function getPrintJobById(printJobId: string) {
  const row = db.prepare('SELECT * FROM print_jobs WHERE printJobId = ?').get(printJobId) as PrintJobRow | undefined;
  return row ? mapPrintJobRow(row) : null;
}

export function getLatestPrintJobByTicketId(ticketId: string) {
  const row = db.prepare(`
    SELECT * FROM print_jobs
    WHERE ticketId = ?
    ORDER BY datetime(createdAt) DESC, rowid DESC
    LIMIT 1
  `).get(ticketId) as PrintJobRow | undefined;
  return row ? mapPrintJobRow(row) : null;
}

export function updatePrintJob(printJobId: string, patch: Partial<PrintJobRecord>) {
  const current = db.prepare('SELECT * FROM print_jobs WHERE printJobId = ?').get(printJobId) as PrintJobRow | undefined;
  if (!current) {
    return null;
  }

  const next: PrintJobRow = {
    ...current,
    ticketId: patch.ticketId ?? current.ticketId,
    status: patch.status ?? current.status,
    mode: patch.mode ?? current.mode,
    payloadJson: patch.payloadJson ?? current.payloadJson,
    attempts: patch.attempts ?? current.attempts,
    lastError: patch.lastError === undefined ? current.lastError : patch.lastError,
    createdAt: patch.createdAt ?? current.createdAt,
    updatedAt: patch.updatedAt ?? nowIso(),
    printedAt: patch.printedAt === undefined ? current.printedAt : patch.printedAt,
  };

  db.prepare(`
    UPDATE print_jobs SET
      ticketId = @ticketId,
      status = @status,
      mode = @mode,
      payloadJson = @payloadJson,
      attempts = @attempts,
      lastError = @lastError,
      createdAt = @createdAt,
      updatedAt = @updatedAt,
      printedAt = @printedAt
    WHERE printJobId = @printJobId
  `).run(next);

  return mapPrintJobRow(next);
}

export function findRecoverableOrderSessionByTokenOrCode(tokenOrCode: string) {
  const row = db.prepare(`
    SELECT *
    FROM order_sessions
    WHERE paymentMode = 'cashier'
      AND (
        pin4 = @tokenOrCode
        OR qrToken = @tokenOrCode
      )
    ORDER BY datetime(updatedAt) DESC, rowid DESC
    LIMIT 1
  `).get({ tokenOrCode }) as OrderSessionRow | undefined;

  return row ? mapOrderSessionRow(row) : null;
}

export function findAnyCashierOrderSessionByTokenOrCode(tokenOrCode: string) {
  const row = db.prepare(`
    SELECT *
    FROM order_sessions
    WHERE paymentMode = 'cashier'
      AND (
        pin4 = @tokenOrCode
        OR qrToken = @tokenOrCode
      )
    ORDER BY datetime(updatedAt) DESC, rowid DESC
    LIMIT 1
  `).get({ tokenOrCode }) as OrderSessionRow | undefined;

  return row ? mapOrderSessionRow(row) : null;
}

export function generateRecoveryDataForOrderSession(locationId: string) {
  return {
    pin4: generateUniquePin4(locationId),
    qrToken: generateUniqueRecoveryQrToken()
  };
}

export function getTableQrMappingByQrToken(qrToken: string) {
  const row = db.prepare('SELECT * FROM table_qr_mappings WHERE qrToken = ?').get(qrToken) as
    | TableRow
    | undefined;
  return row ? mapTableQrMappingRow(row) : null;
}

export function getTableQrMappingById(id: string) {
  const row = db.prepare('SELECT * FROM table_qr_mappings WHERE id = ?').get(id) as TableRow | undefined;
  return row ? mapTableQrMappingRow(row) : null;
}

export function listTableQrMappings() {
  const rows = db
    .prepare('SELECT * FROM table_qr_mappings ORDER BY enabled DESC, datetime(updatedAt) DESC, rowid DESC')
    .all() as TableRow[];

  return rows.map(mapTableQrMappingRow);
}

export function getActiveTableQrMappingByLastTableId(lastTableId: string) {
  const row = db
    .prepare('SELECT * FROM table_qr_mappings WHERE lastTableId = ? AND enabled = 1 ORDER BY datetime(updatedAt) DESC, rowid DESC LIMIT 1')
    .get(lastTableId) as TableRow | undefined;

  return row ? mapTableQrMappingRow(row) : null;
}

export function createTableQrMapping(input: {
  locationId: string;
  lastTableId: string;
  tableNameSnapshot: string;
}) {
  const timestamp = nowIso();
  const record: TableRow = {
    id: randomUUID(),
    locationId: input.locationId,
    lastTableId: input.lastTableId,
    qrToken: generateUniqueQrToken(),
    enabled: 1,
    tableNameSnapshot: input.tableNameSnapshot,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  db.prepare(`
    INSERT INTO table_qr_mappings (
      id, locationId, lastTableId, qrToken, enabled, tableNameSnapshot, createdAt, updatedAt
    ) VALUES (
      @id, @locationId, @lastTableId, @qrToken, @enabled, @tableNameSnapshot, @createdAt, @updatedAt
    )
  `).run(record);

  return mapTableQrMappingRow(record);
}

export function updateTableQrMapping(
  id: string,
  patch: {
    lastTableId?: string;
    tableNameSnapshot?: string | null;
  }
) {
  const current = db.prepare('SELECT * FROM table_qr_mappings WHERE id = ?').get(id) as TableRow | undefined;
  if (!current) {
    return null;
  }

  const next: TableRow = {
    ...current,
    lastTableId: patch.lastTableId ?? current.lastTableId,
    tableNameSnapshot:
      patch.tableNameSnapshot === undefined ? current.tableNameSnapshot : patch.tableNameSnapshot,
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE table_qr_mappings SET
      lastTableId = @lastTableId,
      tableNameSnapshot = @tableNameSnapshot,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);

  return mapTableQrMappingRow(next);
}

export function regenerateTableQrToken(id: string) {
  const current = db.prepare('SELECT * FROM table_qr_mappings WHERE id = ?').get(id) as TableRow | undefined;
  if (!current) {
    return null;
  }

  const next: TableRow = {
    ...current,
    qrToken: generateUniqueQrToken(),
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE table_qr_mappings SET
      qrToken = @qrToken,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);

  return mapTableQrMappingRow(next);
}

export function setTableQrMappingEnabled(id: string, enabled: boolean) {
  const current = db.prepare('SELECT * FROM table_qr_mappings WHERE id = ?').get(id) as TableRow | undefined;
  if (!current) {
    return null;
  }

  const next: TableRow = {
    ...current,
    enabled: enabled ? 1 : 0,
    updatedAt: nowIso()
  };

  db.prepare(`
    UPDATE table_qr_mappings SET
      enabled = @enabled,
      updatedAt = @updatedAt
    WHERE id = @id
  `).run(next);

  return mapTableQrMappingRow(next);
}

// ─── Suggestions CRUD ────────────────────────────────────────────────────────

function mapUpsellRuleRow(row: UpsellRuleRow): UpsellRule {
  return { ...row, isActive: row.isActive === 1 };
}

function mapCrosssellRuleRow(row: CrosssellRuleRow): CrosssellRule {
  return { ...row, isActive: row.isActive === 1 };
}

function mapLastminuteItemRow(row: LastminuteItemRow): LastminuteItem {
  return { ...row, isActive: row.isActive === 1 };
}

function mapBundleRuleRow(row: BundleRuleRow): BundleRule {
  return {
    ...row,
    productIds: (parseJson<string[]>(row.productIds) ?? []) as string[],
    isActive: row.isActive === 1,
  };
}

function mapSuggestionEventRow(row: SuggestionEventRow): SuggestionEvent {
  return { ...row };
}

// Upsell rules

export function createUpsellRule(input: Omit<UpsellRule, 'id' | 'createdAt'>): UpsellRule {
  const row: UpsellRuleRow = {
    id: randomUUID(),
    triggerProductId: input.triggerProductId,
    suggestProductId: input.suggestProductId,
    timeSlot: input.timeSlot,
    priority: input.priority,
    isActive: boolToInt(input.isActive),
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO upsell_rules (id, triggerProductId, suggestProductId, timeSlot, priority, isActive, createdAt)
    VALUES (@id, @triggerProductId, @suggestProductId, @timeSlot, @priority, @isActive, @createdAt)
  `).run(row);
  return mapUpsellRuleRow(row);
}

export function listUpsellRules(activeOnly = false): UpsellRule[] {
  const rows = db.prepare(
    activeOnly
      ? 'SELECT * FROM upsell_rules WHERE isActive = 1 ORDER BY priority DESC, createdAt ASC'
      : 'SELECT * FROM upsell_rules ORDER BY priority DESC, createdAt ASC'
  ).all() as UpsellRuleRow[];
  return rows.map(mapUpsellRuleRow);
}

export function getUpsellRuleById(id: string): UpsellRule | null {
  const row = db.prepare('SELECT * FROM upsell_rules WHERE id = ?').get(id) as UpsellRuleRow | undefined;
  return row ? mapUpsellRuleRow(row) : null;
}

export function updateUpsellRule(id: string, patch: Partial<Omit<UpsellRule, 'id' | 'createdAt'>>): UpsellRule | null {
  const current = db.prepare('SELECT * FROM upsell_rules WHERE id = ?').get(id) as UpsellRuleRow | undefined;
  if (!current) return null;
  const next: UpsellRuleRow = {
    ...current,
    triggerProductId: patch.triggerProductId ?? current.triggerProductId,
    suggestProductId: patch.suggestProductId ?? current.suggestProductId,
    timeSlot: patch.timeSlot ?? current.timeSlot,
    priority: patch.priority ?? current.priority,
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
  };
  db.prepare(`
    UPDATE upsell_rules SET triggerProductId=@triggerProductId, suggestProductId=@suggestProductId,
      timeSlot=@timeSlot, priority=@priority, isActive=@isActive WHERE id=@id
  `).run(next);
  return mapUpsellRuleRow(next);
}

export function deleteUpsellRule(id: string): boolean {
  const result = db.prepare('DELETE FROM upsell_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

// Cross-sell rules

export function createCrosssellRule(input: Omit<CrosssellRule, 'id' | 'createdAt'>): CrosssellRule {
  const row: CrosssellRuleRow = {
    id: randomUUID(),
    ifHasCategoryId: input.ifHasCategoryId,
    ifMissingCategoryId: input.ifMissingCategoryId,
    suggestProductId: input.suggestProductId,
    timeSlot: input.timeSlot,
    priority: input.priority,
    isActive: boolToInt(input.isActive),
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO crosssell_rules (id, ifHasCategoryId, ifMissingCategoryId, suggestProductId, timeSlot, priority, isActive, createdAt)
    VALUES (@id, @ifHasCategoryId, @ifMissingCategoryId, @suggestProductId, @timeSlot, @priority, @isActive, @createdAt)
  `).run(row);
  return mapCrosssellRuleRow(row);
}

export function listCrosssellRules(activeOnly = false): CrosssellRule[] {
  const rows = db.prepare(
    activeOnly
      ? 'SELECT * FROM crosssell_rules WHERE isActive = 1 ORDER BY priority DESC, createdAt ASC'
      : 'SELECT * FROM crosssell_rules ORDER BY priority DESC, createdAt ASC'
  ).all() as CrosssellRuleRow[];
  return rows.map(mapCrosssellRuleRow);
}

export function getCrosssellRuleById(id: string): CrosssellRule | null {
  const row = db.prepare('SELECT * FROM crosssell_rules WHERE id = ?').get(id) as CrosssellRuleRow | undefined;
  return row ? mapCrosssellRuleRow(row) : null;
}

export function updateCrosssellRule(id: string, patch: Partial<Omit<CrosssellRule, 'id' | 'createdAt'>>): CrosssellRule | null {
  const current = db.prepare('SELECT * FROM crosssell_rules WHERE id = ?').get(id) as CrosssellRuleRow | undefined;
  if (!current) return null;
  const next: CrosssellRuleRow = {
    ...current,
    ifHasCategoryId: patch.ifHasCategoryId ?? current.ifHasCategoryId,
    ifMissingCategoryId: patch.ifMissingCategoryId ?? current.ifMissingCategoryId,
    suggestProductId: patch.suggestProductId ?? current.suggestProductId,
    timeSlot: patch.timeSlot ?? current.timeSlot,
    priority: patch.priority ?? current.priority,
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
  };
  db.prepare(`
    UPDATE crosssell_rules SET ifHasCategoryId=@ifHasCategoryId, ifMissingCategoryId=@ifMissingCategoryId,
      suggestProductId=@suggestProductId, timeSlot=@timeSlot, priority=@priority, isActive=@isActive WHERE id=@id
  `).run(next);
  return mapCrosssellRuleRow(next);
}

export function deleteCrosssellRule(id: string): boolean {
  const result = db.prepare('DELETE FROM crosssell_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

// Last-minute items

export function createLastminuteItem(input: Omit<LastminuteItem, 'id' | 'createdAt'>): LastminuteItem {
  const row: LastminuteItemRow = {
    id: randomUUID(),
    productId: input.productId,
    timeSlot: input.timeSlot,
    position: input.position,
    isActive: boolToInt(input.isActive),
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO lastminute_items (id, productId, timeSlot, position, isActive, createdAt)
    VALUES (@id, @productId, @timeSlot, @position, @isActive, @createdAt)
  `).run(row);
  return mapLastminuteItemRow(row);
}

export function listLastminuteItems(activeOnly = false): LastminuteItem[] {
  const rows = db.prepare(
    activeOnly
      ? 'SELECT * FROM lastminute_items WHERE isActive = 1 ORDER BY position ASC, createdAt ASC'
      : 'SELECT * FROM lastminute_items ORDER BY position ASC, createdAt ASC'
  ).all() as LastminuteItemRow[];
  return rows.map(mapLastminuteItemRow);
}

export function getLastminuteItemById(id: string): LastminuteItem | null {
  const row = db.prepare('SELECT * FROM lastminute_items WHERE id = ?').get(id) as LastminuteItemRow | undefined;
  return row ? mapLastminuteItemRow(row) : null;
}

export function updateLastminuteItem(id: string, patch: Partial<Omit<LastminuteItem, 'id' | 'createdAt'>>): LastminuteItem | null {
  const current = db.prepare('SELECT * FROM lastminute_items WHERE id = ?').get(id) as LastminuteItemRow | undefined;
  if (!current) return null;
  const next: LastminuteItemRow = {
    ...current,
    productId: patch.productId ?? current.productId,
    timeSlot: patch.timeSlot ?? current.timeSlot,
    position: patch.position ?? current.position,
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
  };
  db.prepare(`
    UPDATE lastminute_items SET productId=@productId, timeSlot=@timeSlot, position=@position, isActive=@isActive WHERE id=@id
  `).run(next);
  return mapLastminuteItemRow(next);
}

export function deleteLastminuteItem(id: string): boolean {
  const result = db.prepare('DELETE FROM lastminute_items WHERE id = ?').run(id);
  return result.changes > 0;
}

// Bundle rules

export function createBundleRule(input: Omit<BundleRule, 'id' | 'createdAt'>): BundleRule {
  const row: BundleRuleRow = {
    id: randomUUID(),
    name: input.name,
    productIds: JSON.stringify(input.productIds),
    bundlePrice: input.bundlePrice ?? null,
    triggerProductId: input.triggerProductId ?? null,
    isActive: boolToInt(input.isActive),
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO bundle_rules (id, name, productIds, bundlePrice, triggerProductId, isActive, createdAt)
    VALUES (@id, @name, @productIds, @bundlePrice, @triggerProductId, @isActive, @createdAt)
  `).run(row);
  return mapBundleRuleRow(row);
}

export function listBundleRules(activeOnly = false): BundleRule[] {
  const rows = db.prepare(
    activeOnly
      ? 'SELECT * FROM bundle_rules WHERE isActive = 1 ORDER BY createdAt ASC'
      : 'SELECT * FROM bundle_rules ORDER BY createdAt ASC'
  ).all() as BundleRuleRow[];
  return rows.map(mapBundleRuleRow);
}

export function getBundleRuleById(id: string): BundleRule | null {
  const row = db.prepare('SELECT * FROM bundle_rules WHERE id = ?').get(id) as BundleRuleRow | undefined;
  return row ? mapBundleRuleRow(row) : null;
}

export function updateBundleRule(id: string, patch: Partial<Omit<BundleRule, 'id' | 'createdAt'>>): BundleRule | null {
  const current = db.prepare('SELECT * FROM bundle_rules WHERE id = ?').get(id) as BundleRuleRow | undefined;
  if (!current) return null;
  const next: BundleRuleRow = {
    ...current,
    name: patch.name ?? current.name,
    productIds: patch.productIds !== undefined ? JSON.stringify(patch.productIds) : current.productIds,
    bundlePrice: patch.bundlePrice === undefined ? current.bundlePrice : (patch.bundlePrice ?? null),
    triggerProductId: patch.triggerProductId === undefined ? current.triggerProductId : (patch.triggerProductId ?? null),
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
  };
  db.prepare(`
    UPDATE bundle_rules SET name=@name, productIds=@productIds, bundlePrice=@bundlePrice,
      triggerProductId=@triggerProductId, isActive=@isActive WHERE id=@id
  `).run(next);
  return mapBundleRuleRow(next);
}

export function deleteBundleRule(id: string): boolean {
  const result = db.prepare('DELETE FROM bundle_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

// Suggestion events

export function createSuggestionEvent(input: Omit<SuggestionEvent, 'id' | 'createdAt'>): SuggestionEvent {
  const row: SuggestionEventRow = {
    id: randomUUID(),
    sessionId: input.sessionId,
    engine: input.engine,
    ruleId: input.ruleId,
    suggestedProductId: input.suggestedProductId,
    outcome: input.outcome,
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO suggestion_events (id, sessionId, engine, ruleId, suggestedProductId, outcome, createdAt)
    VALUES (@id, @sessionId, @engine, @ruleId, @suggestedProductId, @outcome, @createdAt)
  `).run(row);
  return mapSuggestionEventRow(row);
}

export function getSuggestionStats() {
  const engines: SuggestionEngine[] = ['upsell', 'crosssell', 'lastminute', 'bundle', 'composition'];
  const byEngine = {} as Record<SuggestionEngine, { shown: number; accepted: number; rate: number }>;

  for (const engine of engines) {
    const shown = (db.prepare(
      "SELECT COUNT(*) as n FROM suggestion_events WHERE engine = ? AND outcome IN ('shown','accepted','ignored','rejected')"
    ).get(engine) as { n: number }).n;
    const accepted = (db.prepare(
      "SELECT COUNT(*) as n FROM suggestion_events WHERE engine = ? AND outcome = 'accepted'"
    ).get(engine) as { n: number }).n;
    byEngine[engine] = { shown, accepted, rate: shown > 0 ? Math.round((accepted / shown) * 1000) / 10 : 0 };
  }

  const topAcceptedRows = db.prepare(`
    SELECT suggestedProductId, COUNT(*) as count
    FROM suggestion_events WHERE outcome = 'accepted'
    GROUP BY suggestedProductId ORDER BY count DESC LIMIT 10
  `).all() as Array<{ suggestedProductId: string; count: number }>;

  const topIgnoredRows = db.prepare(`
    SELECT suggestedProductId, COUNT(*) as count
    FROM suggestion_events WHERE outcome IN ('ignored','rejected')
    GROUP BY suggestedProductId ORDER BY count DESC LIMIT 10
  `).all() as Array<{ suggestedProductId: string; count: number }>;

  return {
    byEngine,
    topAccepted: topAcceptedRows.map((r) => ({ productId: r.suggestedProductId, count: r.count })),
    topIgnored: topIgnoredRows.map((r) => ({ productId: r.suggestedProductId, count: r.count })),
  };
}

// ─── Composition modal rules CRUD ─────────────────────────────────────────────

function mapCompositionModalRuleRow(row: CompositionModalRuleRow): CompositionModalRule {
  return {
    id: row.id,
    triggerCategoryId: row.triggerCategoryId,
    triggerCategoryName: row.triggerCategoryName,
    bannerTitle: row.bannerTitle ?? '¿Lo hacemos un menú?',
    sections: (parseJson<CompositionSection[]>(row.sections) ?? []) as CompositionSection[],
    isActive: row.isActive === 1,
    createdAt: row.createdAt,
  };
}

export function getAllCompositionRules(): CompositionModalRule[] {
  const rows = db.prepare(
    'SELECT * FROM composition_modal_rules ORDER BY createdAt ASC'
  ).all() as CompositionModalRuleRow[];
  return rows.map(mapCompositionModalRuleRow);
}

export function getCompositionRuleById(id: string): CompositionModalRule | null {
  const row = db.prepare('SELECT * FROM composition_modal_rules WHERE id = ?').get(id) as CompositionModalRuleRow | undefined;
  return row ? mapCompositionModalRuleRow(row) : null;
}

export function createCompositionRule(input: Omit<CompositionModalRule, 'id' | 'createdAt'>): CompositionModalRule {
  const row: CompositionModalRuleRow = {
    id: randomUUID(),
    triggerCategoryId: input.triggerCategoryId,
    triggerCategoryName: input.triggerCategoryName,
    bannerTitle: input.bannerTitle ?? '¿Lo hacemos un menú?',
    sections: JSON.stringify(input.sections),
    isActive: boolToInt(input.isActive),
    createdAt: nowIso(),
  };
  db.prepare(`
    INSERT INTO composition_modal_rules (id, triggerCategoryId, triggerCategoryName, bannerTitle, sections, isActive, createdAt)
    VALUES (@id, @triggerCategoryId, @triggerCategoryName, @bannerTitle, @sections, @isActive, @createdAt)
  `).run(row);
  return mapCompositionModalRuleRow(row);
}

export function updateCompositionRule(
  id: string,
  patch: Partial<Omit<CompositionModalRule, 'id' | 'createdAt'>>
): CompositionModalRule | null {
  const current = db.prepare('SELECT * FROM composition_modal_rules WHERE id = ?').get(id) as CompositionModalRuleRow | undefined;
  if (!current) return null;
  const next: CompositionModalRuleRow = {
    ...current,
    triggerCategoryId: patch.triggerCategoryId ?? current.triggerCategoryId,
    triggerCategoryName: patch.triggerCategoryName ?? current.triggerCategoryName,
    bannerTitle: patch.bannerTitle ?? current.bannerTitle ?? '¿Lo hacemos un menú?',
    sections: patch.sections !== undefined ? JSON.stringify(patch.sections) : current.sections,
    isActive: patch.isActive === undefined ? current.isActive : boolToInt(patch.isActive),
  };
  db.prepare(`
    UPDATE composition_modal_rules
    SET triggerCategoryId=@triggerCategoryId, triggerCategoryName=@triggerCategoryName,
        bannerTitle=@bannerTitle, sections=@sections, isActive=@isActive
    WHERE id=@id
  `).run(next);
  return mapCompositionModalRuleRow(next);
}

export function deleteCompositionRule(id: string): boolean {
  const result = db.prepare('DELETE FROM composition_modal_rules WHERE id = ?').run(id);
  return result.changes > 0;
}

createTables();
seedSettings();
migrateLegacyConfigIfNeeded();
migrateLegacyTablesToQrMappingsIfNeeded();
const currentSettings = getSettingsRow();
const normalizedTheme = normalizeThemeValue(currentSettings.theme);
if (currentSettings.theme !== normalizedTheme) {
  updateSettingsRow({ theme: normalizedTheme });
}
removeLegacyDemoTableMapping();
