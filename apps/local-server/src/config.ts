import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSettingsRow, normalizeThemeValue, type KioskTheme, type SettingsRow, updateSettingsRow } from './db.js';

export interface CustomerFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface LocalConfig {
  restaurantName: string;
  logoUrl: string;
  paymentsSimulated: boolean;
  paymentsDemoForced: boolean;
  lastApp: {
    tokenConfigured: boolean;
    tokenMasked: string | null;
    token: string;
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

export interface RuntimeConfig {
  restaurantName: string;
  logoUrl: string;
  paymentsSimulated: boolean;
  lastApp: {
    token: string;
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
        password: string;
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

function isEnvForcedPaymentsDemo() {
  return process.env.PAYMENTS_DEMO_MODE?.trim().toLowerCase() === 'true';
}

export class ConfigStoreError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

const LEGACY_CONFIG_PATH = join(process.cwd(), 'config.local.json');

interface LegacyConfigShape {
  restaurantName?: string;
  lastApp?: {
    token?: string;
    organizationId?: string;
    locationId?: string;
    brandId?: string;
    catalogId?: string;
  };
  kiosk?: {
    source?: string;
    pickupType?: string;
    defaultOrderMode?: 'takeAway' | 'eatIn' | 'delivery';
    theme?: string;
    customerFields?: {
      name?: Partial<CustomerFieldConfig>;
      phoneNumber?: Partial<CustomerFieldConfig>;
      email?: Partial<CustomerFieldConfig>;
    };
    notes?: {
      generalEnabled?: boolean;
      productCommentsEnabled?: boolean;
    };
    features?: {
      modifiers?: boolean;
      notes?: boolean;
      upselling?: boolean;
      printTicket?: boolean;
    };
    payment?: {
      mode?: string;
      preferredPaymentMethod?: string;
      cashdro?: {
        baseUrl?: string;
        username?: string;
        password?: string;
        posId?: string;
        posUser?: string;
        allowInsecureTls?: boolean;
      };
    };
  };
}

function intToBool(value: number) {
  return value === 1;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function readLegacyConfig(): LegacyConfigShape | null {
  if (!existsSync(LEGACY_CONFIG_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(LEGACY_CONFIG_PATH, 'utf8')) as LegacyConfigShape;
  } catch {
    return null;
  }
}

export function getLastToken() {
  const envToken = process.env.LAST_TOKEN?.trim();

  if (envToken) {
    return envToken;
  }

  const legacyToken = readLegacyConfig()?.lastApp?.token?.trim();
  return legacyToken || '';
}

function maskToken(token: string) {
  if (!token) {
    return null;
  }

  return `••••${token.slice(-4)}`;
}

function normalizeDefaultOrderMode(mode: unknown, fallback: string): 'takeAway' | 'eatIn' | 'delivery' {
  if (mode === 'eatIn' || mode === 'delivery' || mode === 'takeAway') {
    return mode;
  }

  if (fallback === 'onsite') {
    return 'eatIn';
  }

  if (fallback === 'delivery') {
    return 'delivery';
  }

  return 'takeAway';
}

function rowToRuntimeConfig(row: SettingsRow): RuntimeConfig {
  return {
    restaurantName: row.restaurantName,
    logoUrl: row.logoUrl ?? '',
    paymentsSimulated: isEnvForcedPaymentsDemo() ? true : intToBool(row.paymentsSimulated),
    lastApp: {
      token: getLastToken(),
      organizationId: row.organizationId,
      locationId: row.locationId,
      brandId: row.brandId,
      catalogId: row.catalogId
    },
    kiosk: {
      source: row.source,
      pickupType: row.pickupType,
      defaultOrderMode: normalizeDefaultOrderMode(row.defaultOrderMode, row.pickupType),
      theme: normalizeThemeValue(row.theme),
      customerFields: {
        name: {
          enabled: intToBool(row.customerNameEnabled),
          required: intToBool(row.customerNameRequired)
        },
        phoneNumber: {
          enabled: intToBool(row.customerPhoneEnabled),
          required: intToBool(row.customerPhoneRequired)
        },
        email: {
          enabled: intToBool(row.customerEmailEnabled),
          required: intToBool(row.customerEmailRequired)
        }
      },
      notes: {
        generalEnabled: intToBool(row.generalNotesEnabled),
        productCommentsEnabled: intToBool(row.productCommentsEnabled)
      },
      features: {
        modifiers: intToBool(row.featureModifiers),
        upselling: intToBool(row.featureUpselling),
        printTicket: intToBool(row.featurePrintTicket)
      },
      payment: {
        mode: row.paymentMode,
        preferredPaymentMethod: row.preferredPaymentMethod,
        cashdro: {
          configured: hasText(row.cashdroBaseUrl) && hasText(row.cashdroUsername) && hasText(row.cashdroPassword),
          baseUrl: row.cashdroBaseUrl,
          username: row.cashdroUsername,
          password: row.cashdroPassword,
          posId: row.cashdroPosId,
          posUser: row.cashdroPosUser,
          allowInsecureTls: intToBool(row.cashdroAllowInsecureTls)
        }
      }
    },
    printer: {
      mode: (row.printerMode === 'browser' || row.printerMode === 'escpos' ? row.printerMode : 'disabled') as 'disabled' | 'browser' | 'escpos',
      escpos: {
        host: row.escposHost,
        port: row.escposPort,
        configured: hasText(row.escposHost) && row.escposPort > 0
      }
    },
    setupCompleted: intToBool(row.setupCompleted)
  };
}

function runtimeToApiConfig(runtime: RuntimeConfig): LocalConfig {
  const tokenMasked = maskToken(runtime.lastApp.token);
  const paymentsDemoForced = isEnvForcedPaymentsDemo();

  return {
    restaurantName: runtime.restaurantName,
    logoUrl: runtime.logoUrl,
    paymentsSimulated: runtime.paymentsSimulated,
    paymentsDemoForced,
    lastApp: {
      tokenConfigured: Boolean(runtime.lastApp.token),
      tokenMasked,
      token: tokenMasked ?? '',
      organizationId: runtime.lastApp.organizationId,
      locationId: runtime.lastApp.locationId,
      brandId: runtime.lastApp.brandId,
      catalogId: runtime.lastApp.catalogId
    },
    kiosk: {
      source: runtime.kiosk.source,
      pickupType: runtime.kiosk.pickupType,
      defaultOrderMode: runtime.kiosk.defaultOrderMode,
      theme: runtime.kiosk.theme,
      customerFields: runtime.kiosk.customerFields,
      notes: runtime.kiosk.notes,
      features: {
        modifiers: runtime.kiosk.features.modifiers,
        notes: runtime.kiosk.notes.generalEnabled,
        upselling: runtime.kiosk.features.upselling,
        printTicket: runtime.kiosk.features.printTicket
      },
      payment: {
        mode: runtime.kiosk.payment.mode,
        preferredPaymentMethod: runtime.kiosk.payment.preferredPaymentMethod,
        cashdro: {
          configured: runtime.kiosk.payment.cashdro.configured,
          baseUrl: runtime.kiosk.payment.cashdro.baseUrl,
          username: runtime.kiosk.payment.cashdro.username,
          passwordMasked: maskToken(runtime.kiosk.payment.cashdro.password),
          posId: runtime.kiosk.payment.cashdro.posId,
          posUser: runtime.kiosk.payment.cashdro.posUser,
          allowInsecureTls: runtime.kiosk.payment.cashdro.allowInsecureTls
        }
      }
    },
    printer: runtime.printer,
    setupCompleted: runtime.setupCompleted
  };
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function buildSettingsPatch(body: unknown, current: SettingsRow): Partial<SettingsRow> {
  if (!body || typeof body !== 'object') {
    throw new ConfigStoreError('Invalid config body', 400);
  }

  const input = body as Record<string, unknown>;
  const lastApp = (input.lastApp ?? {}) as Record<string, unknown>;
  const kiosk = (input.kiosk ?? {}) as Record<string, unknown>;
  const printerInput = (input.printer ?? {}) as Record<string, unknown>;
  const escposInput = (printerInput.escpos ?? {}) as Record<string, unknown>;
  const customerFields = (kiosk.customerFields ?? {}) as Record<string, unknown>;
  const notes = (kiosk.notes ?? {}) as Record<string, unknown>;
  const features = (kiosk.features ?? {}) as Record<string, unknown>;
  const payment = (kiosk.payment ?? {}) as Record<string, unknown>;
  const cashdro = (payment.cashdro ?? {}) as Record<string, unknown>;
  const nameField = (customerFields.name ?? {}) as Record<string, unknown>;
  const phoneField = (customerFields.phoneNumber ?? {}) as Record<string, unknown>;
  const emailField = (customerFields.email ?? {}) as Record<string, unknown>;

  const patch: Partial<SettingsRow> = {};

  if (typeof input.restaurantName === 'string') {
    patch.restaurantName = input.restaurantName;
  }

  if (typeof input.logoUrl === 'string') {
    patch.logoUrl = input.logoUrl.trim();
  }

  if (hasText(lastApp.organizationId)) {
    patch.organizationId = lastApp.organizationId.trim();
  }

  if (hasText(lastApp.locationId)) {
    patch.locationId = lastApp.locationId.trim();
  }

  if (hasText(lastApp.brandId)) {
    patch.brandId = lastApp.brandId.trim();
  }

  if (hasText(lastApp.catalogId)) {
    patch.catalogId = lastApp.catalogId.trim();
  }

  if (hasText(kiosk.source)) {
    patch.source = kiosk.source.trim();
  }

  if (hasText(kiosk.pickupType)) {
    patch.pickupType = kiosk.pickupType.trim();
  }

  if (hasText(kiosk.defaultOrderMode)) {
    patch.defaultOrderMode = normalizeDefaultOrderMode(kiosk.defaultOrderMode, current.pickupType);
  }

  if (hasText(kiosk.theme)) {
    const nextTheme = kiosk.theme.trim();

    if (!['principal', 'moderno', 'simple', 'morado'].includes(nextTheme)) {
      throw new ConfigStoreError('Invalid kiosk theme', 400, {
        allowedThemes: ['principal', 'moderno', 'simple', 'morado']
      });
    }

    patch.theme = normalizeThemeValue(nextTheme);
  }

  if (typeof nameField.enabled === 'boolean') {
    patch.customerNameEnabled = nameField.enabled ? 1 : 0;
  }

  if (typeof nameField.required === 'boolean') {
    patch.customerNameRequired = nameField.required ? 1 : 0;
  }

  if (typeof phoneField.enabled === 'boolean') {
    patch.customerPhoneEnabled = phoneField.enabled ? 1 : 0;
  }

  if (typeof phoneField.required === 'boolean') {
    patch.customerPhoneRequired = phoneField.required ? 1 : 0;
  }

  if (typeof emailField.enabled === 'boolean') {
    patch.customerEmailEnabled = emailField.enabled ? 1 : 0;
  }

  if (typeof emailField.required === 'boolean') {
    patch.customerEmailRequired = emailField.required ? 1 : 0;
  }

  if (typeof notes.generalEnabled === 'boolean') {
    patch.generalNotesEnabled = notes.generalEnabled ? 1 : 0;
  } else if (typeof features.notes === 'boolean') {
    patch.generalNotesEnabled = features.notes ? 1 : 0;
  }

  if (typeof notes.productCommentsEnabled === 'boolean') {
    patch.productCommentsEnabled = notes.productCommentsEnabled ? 1 : 0;
  }

  if (typeof features.modifiers === 'boolean') {
    patch.featureModifiers = features.modifiers ? 1 : 0;
  }

  if (typeof features.upselling === 'boolean') {
    patch.featureUpselling = features.upselling ? 1 : 0;
  }

  if (typeof features.printTicket === 'boolean') {
    patch.featurePrintTicket = features.printTicket ? 1 : 0;
  }

  if (hasText(payment.mode)) {
    patch.paymentMode = payment.mode.trim();
  }

  if (hasText(payment.preferredPaymentMethod)) {
    patch.preferredPaymentMethod = payment.preferredPaymentMethod.trim();
  }

  if (typeof input.paymentsSimulated === 'boolean' && !isEnvForcedPaymentsDemo()) {
    patch.paymentsSimulated = input.paymentsSimulated ? 1 : 0;
  }

  if (hasText(cashdro.baseUrl)) {
    patch.cashdroBaseUrl = cashdro.baseUrl.trim();
  }

  if (hasText(cashdro.username)) {
    patch.cashdroUsername = cashdro.username.trim();
  }

  if (typeof cashdro.password === 'string') {
    const normalizedPassword = cashdro.password.trim();
    if (normalizedPassword.length > 0 && !normalizedPassword.startsWith('â€¢')) {
      patch.cashdroPassword = normalizedPassword;
    }
  }

  if (hasText(cashdro.posId)) {
    patch.cashdroPosId = cashdro.posId.trim();
  }

  if (hasText(cashdro.posUser)) {
    patch.cashdroPosUser = cashdro.posUser.trim();
  }

  if (typeof cashdro.allowInsecureTls === 'boolean') {
    patch.cashdroAllowInsecureTls = cashdro.allowInsecureTls ? 1 : 0;
  }

  if (printerInput.mode === 'disabled' || printerInput.mode === 'browser' || printerInput.mode === 'escpos') {
    patch.printerMode = printerInput.mode;
  }

  if (hasText(escposInput.host)) {
    patch.escposHost = (escposInput.host as string).trim();
  }

  if (typeof escposInput.port === 'number' && Number.isInteger(escposInput.port) && escposInput.port > 0) {
    patch.escposPort = escposInput.port;
  }

  return patch;
}

export function readRuntimeConfig(): RuntimeConfig {
  return rowToRuntimeConfig(getSettingsRow());
}

export async function readConfig(): Promise<LocalConfig> {
  return runtimeToApiConfig(readRuntimeConfig());
}

export async function saveConfig(body: unknown): Promise<LocalConfig> {
  const current = getSettingsRow();
  const patch = buildSettingsPatch(body, current);
  const updated = updateSettingsRow(patch);
  return runtimeToApiConfig(rowToRuntimeConfig(updated));
}

export async function saveSetupSelection(selection: {
  organizationId?: string;
  locationId?: string;
  brandId?: string;
  catalogId?: string;
}): Promise<LocalConfig> {
  const patch: Partial<SettingsRow> = {};

  if (hasText(selection.organizationId)) {
    patch.organizationId = selection.organizationId.trim();
  }

  if (hasText(selection.locationId)) {
    patch.locationId = selection.locationId.trim();
  }

  if (hasText(selection.brandId)) {
    patch.brandId = selection.brandId.trim();
  }

  if (hasText(selection.catalogId)) {
    patch.catalogId = selection.catalogId.trim();
  }

  const updated = updateSettingsRow(patch);
  return runtimeToApiConfig(rowToRuntimeConfig(updated));
}

export async function saveSetupAutoConfig(patch: Partial<SettingsRow>): Promise<LocalConfig> {
  const updated = updateSettingsRow(patch);
  return runtimeToApiConfig(rowToRuntimeConfig(updated));
}

export function getPublicConfigFromRow(row: SettingsRow) {
  return runtimeToApiConfig(rowToRuntimeConfig(row));
}

export function getLegacyFallbackConfig() {
  return readLegacyConfig();
}
