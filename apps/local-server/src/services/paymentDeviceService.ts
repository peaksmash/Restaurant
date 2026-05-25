import type { PaymentDeviceMode, PaymentProvider } from '@kiosk/types';
import {
  createPaymentDevice as createPaymentDeviceRecord,
  getPaymentDeviceById,
  listPaymentDevices as listPaymentDeviceRecords,
  listPaymentJobs,
  updatePaymentDevice as updatePaymentDeviceRecord,
  type PaymentDeviceRecord
} from '../db.js';
import { HttpError } from '../last-app.js';

interface PaymentDeviceConfigInput {
  baseUrl?: string;
  username?: string;
  posId?: string;
  posUser?: string;
  allowInsecureTls?: boolean;
  host?: string;
  port?: number;
  owner?: string;
}

export interface PaymentDeviceView extends Omit<PaymentDeviceRecord, 'configJson'> {
  configJson: string | null;
  queueState: {
    running: boolean;
    queued: number;
  };
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeConfigObject(input: unknown) {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('password') ||
      lower.includes('apikey') ||
      lower.includes('api_key') ||
      lower.includes('token') ||
      lower.includes('authorization') ||
      lower.includes('secret')
    ) {
      continue;
    }

    sanitized[key] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function normalizeConfigJson(config: PaymentDeviceConfigInput | string | null | undefined) {
  if (config == null) {
    return null;
  }

  if (typeof config === 'string') {
    try {
      return JSON.stringify(sanitizeConfigObject(JSON.parse(config)));
    } catch {
      return null;
    }
  }

  return JSON.stringify(sanitizeConfigObject(config));
}

function buildQueueState(deviceId: string) {
  const jobs = listPaymentJobs({ deviceId });
  return {
    running: jobs.some((job) => job.status === 'running'),
    queued: jobs.filter((job) => job.status === 'queued').length
  };
}

function toView(device: PaymentDeviceRecord): PaymentDeviceView {
  return {
    ...device,
    configJson: normalizeConfigJson(device.configJson),
    queueState: buildQueueState(device.id)
  };
}

function validateProvider(provider: string): PaymentProvider {
  if (provider === 'cashdro' || provider === 'artemis') {
    return provider;
  }

  throw new HttpError(400, 'Invalid payment provider', { code: 'payment_provider_invalid' });
}

function validateMode(mode: string): PaymentDeviceMode {
  if (mode === 'demo' || mode === 'real_pending' || mode === 'real') {
    return mode;
  }

  throw new HttpError(400, 'Invalid payment device mode', { code: 'payment_device_mode_invalid' });
}

export function listPaymentDevices(filters?: {
  locationId?: string;
  provider?: string;
  activeOnly?: boolean;
}) {
  const provider = filters?.provider ? validateProvider(filters.provider) : undefined;
  return listPaymentDeviceRecords({
    locationId: filters?.locationId,
    provider,
    activeOnly: filters?.activeOnly
  }).map(toView);
}

export function getPaymentDevice(id: string) {
  const device = getPaymentDeviceById(id);
  return device ? toView(device) : null;
}

export function createPaymentDevice(input: {
  locationId: string;
  provider: string;
  displayName: string;
  mode: string;
  configured?: boolean;
  isActive?: boolean;
  configJson?: PaymentDeviceConfigInput | string | null;
}) {
  if (!hasText(input.locationId)) {
    throw new HttpError(400, 'Missing locationId', { code: 'location_id_required' });
  }

  if (!hasText(input.displayName)) {
    throw new HttpError(400, 'Missing displayName', { code: 'display_name_required' });
  }

  const created = createPaymentDeviceRecord({
    locationId: input.locationId.trim(),
    provider: validateProvider(input.provider),
    displayName: input.displayName.trim(),
    mode: validateMode(input.mode),
    configured: input.configured ?? false,
    isActive: input.isActive ?? true,
    configJson: normalizeConfigJson(input.configJson)
  });

  return toView(created);
}

export function updatePaymentDevice(id: string, input: {
  displayName?: string;
  mode?: string;
  configured?: boolean;
  isActive?: boolean;
  configJson?: PaymentDeviceConfigInput | string | null;
}) {
  const current = getPaymentDeviceById(id);
  if (!current) {
    throw new HttpError(404, 'Payment device not found', { code: 'payment_device_not_found' });
  }

  const updated = updatePaymentDeviceRecord(id, {
    displayName: hasText(input.displayName) ? input.displayName.trim() : undefined,
    mode: input.mode ? validateMode(input.mode) : undefined,
    configured: input.configured,
    isActive: input.isActive,
    configJson: input.configJson === undefined ? undefined : normalizeConfigJson(input.configJson)
  });

  if (!updated) {
    throw new HttpError(404, 'Payment device not found', { code: 'payment_device_not_found' });
  }

  return toView(updated);
}

export function setPaymentDeviceActive(id: string, isActive: boolean) {
  return updatePaymentDevice(id, { isActive });
}

export function sanitizePaymentDevice(device: PaymentDeviceRecord | PaymentDeviceView) {
  return toView(device as PaymentDeviceRecord);
}
