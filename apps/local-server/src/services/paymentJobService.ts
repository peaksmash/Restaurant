import type { PaymentJobStatus, PaymentProvider } from '@kiosk/types';
import {
  createPaymentJobRecord,
  db,
  getLastOrderLinkByOrderSessionId,
  getOrderSessionById,
  getPaymentDeviceById,
  getPaymentJobById,
  getPaymentJobByIdempotencyKey,
  getQueuedPaymentJobByDeviceId,
  getRunningPaymentJobByDeviceId,
  listPaymentJobs as listPaymentJobRecords,
  updatePaymentJob,
  type PaymentJobRecord
} from '../db.js';
import { readRuntimeConfig } from '../config.js';
import { HttpError } from '../last-app.js';
import { completeCashierOrderSessionPayment } from './recoveryService.js';
import {
  buildArtemisReference,
  confirmArtemisTransaction,
  createArtemisSale,
  resolveArtemisApiKey,
  revertArtemisTransaction,
  type ArtemisConfig,
} from './artemisPayService.js';

const processingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEMO_PROCESSING_DELAY_MS = 1500;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sanitizeJsonPayload(value: unknown) {
  if (value == null) {
    return null;
  }

  const seen = new WeakSet<object>();

  const walk = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(walk);
    }

    if (!input || typeof input !== 'object') {
      return input;
    }

    if (seen.has(input as object)) {
      return null;
    }
    seen.add(input as object);

    const output: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(input as Record<string, unknown>)) {
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
      output[key] = walk(rawValue);
    }
    return output;
  };

  return JSON.stringify(walk(value));
}

function scheduleProcessing(jobId: string, delay = DEMO_PROCESSING_DELAY_MS) {
  const existing = processingTimers.get(jobId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    processingTimers.delete(jobId);
    void processPaymentJob(jobId);
  }, delay);

  processingTimers.set(jobId, timer);
}

function toProviderPaymentName(provider: PaymentProvider) {
  if (provider === 'cashdro') {
    return 'cashdro' as const;
  }

  return 'artemis' as const;
}

function validateProvider(provider: string): PaymentProvider {
  if (provider === 'cashdro' || provider === 'artemis') {
    return provider;
  }

  throw new HttpError(400, 'Invalid payment provider', { code: 'payment_provider_invalid' });
}

function sanitizePaymentJob(job: PaymentJobRecord) {
  let requestPayloadJson: string | null = null;
  let responsePayloadJson: string | null = null;

  try {
    requestPayloadJson = sanitizeJsonPayload(job.requestPayloadJson ? JSON.parse(job.requestPayloadJson) : null);
  } catch {
    requestPayloadJson = null;
  }

  try {
    responsePayloadJson = sanitizeJsonPayload(job.responsePayloadJson ? JSON.parse(job.responsePayloadJson) : null);
  } catch {
    responsePayloadJson = null;
  }

  return {
    ...job,
    requestPayloadJson,
    responsePayloadJson
  };
}

export function getPaymentJob(id: string) {
  const job = getPaymentJobById(id);
  return job ? sanitizePaymentJob(job) : null;
}

export function listPaymentJobs(filters?: {
  locationId?: string;
  deviceId?: string;
  orderSessionId?: string;
  status?: PaymentJobStatus;
}) {
  return listPaymentJobRecords(filters).map(sanitizePaymentJob);
}

export function createPaymentJob(input: {
  orderSessionId: string;
  locationId: string;
  deviceId: string;
  provider: string;
  idempotencyKey: string;
  requestPayloadJson?: Record<string, unknown> | null;
}) {
  const provider = validateProvider(input.provider);
  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey) {
    throw new HttpError(400, 'Missing idempotencyKey', { code: 'idempotency_key_required' });
  }

  const existing = getPaymentJobByIdempotencyKey(idempotencyKey);
  if (existing) {
    return sanitizePaymentJob(existing);
  }

  const session = getOrderSessionById(input.orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', { code: 'session_not_found' });
  }

  if (session.locationId !== input.locationId) {
    throw new HttpError(409, 'Order session location mismatch', { code: 'location_mismatch' });
  }

  if (session.paymentMode !== 'cashier') {
    throw new HttpError(409, 'Order session is not payable by device', { code: 'payment_mode_invalid' });
  }

  if (session.paymentStatus === 'paid') {
    throw new HttpError(409, 'Order session already paid', { code: 'session_already_paid' });
  }

  if (session.lastSyncStatus !== 'not_sent' || session.paymentStatus !== 'unpaid') {
    throw new HttpError(409, 'Order session is not payable', { code: 'payment_job_not_allowed' });
  }

  const device = getPaymentDeviceById(input.deviceId);
  if (!device) {
    throw new HttpError(404, 'Payment device not found', { code: 'payment_device_not_found' });
  }

  if (device.locationId !== input.locationId) {
    throw new HttpError(409, 'Payment device location mismatch', { code: 'location_mismatch' });
  }

  if (device.provider !== provider) {
    throw new HttpError(409, 'Payment device provider mismatch', { code: 'provider_mismatch' });
  }

  if (!device.isActive) {
    throw new HttpError(409, 'Payment device inactive', { code: 'payment_device_inactive' });
  }

  if (!device.configured && device.mode !== 'demo' && device.mode !== 'real_pending') {
    throw new HttpError(409, 'Payment device not configured', { code: 'payment_device_not_configured' });
  }

  const createInTransaction = db.transaction(() => {
    const running = getRunningPaymentJobByDeviceId(input.deviceId);
    return createPaymentJobRecord({
      orderSessionId: input.orderSessionId,
      locationId: input.locationId,
      deviceId: input.deviceId,
      provider,
      status: running ? 'queued' : 'running',
      idempotencyKey,
      requestPayloadJson: sanitizeJsonPayload(input.requestPayloadJson ?? null),
      startedAt: running ? null : new Date().toISOString()
    });
  });

  const job = createInTransaction();
  if (job.status === 'running') {
    scheduleProcessing(job.id);
  }

  return sanitizePaymentJob(job);
}

export function completePaymentJob(id: string, result: {
  responsePayloadJson?: Record<string, unknown> | null;
}) {
  const updated = updatePaymentJob(id, {
    status: 'completed',
    finishedAt: new Date().toISOString(),
    responsePayloadJson: sanitizeJsonPayload(result.responsePayloadJson ?? null),
    errorCode: null,
    errorMessage: null
  });

  if (!updated) {
    throw new HttpError(404, 'Payment job not found', { code: 'payment_job_not_found' });
  }

  void startNextPaymentJob(updated.locationId, updated.deviceId);
  return sanitizePaymentJob(updated);
}

export function failPaymentJob(id: string, error: {
  code: string;
  message: string;
  responsePayloadJson?: Record<string, unknown> | null;
}) {
  const updated = updatePaymentJob(id, {
    status: 'failed',
    finishedAt: new Date().toISOString(),
    errorCode: error.code,
    errorMessage: error.message,
    responsePayloadJson: sanitizeJsonPayload(error.responsePayloadJson ?? null)
  });

  if (!updated) {
    throw new HttpError(404, 'Payment job not found', { code: 'payment_job_not_found' });
  }

  void startNextPaymentJob(updated.locationId, updated.deviceId);
  return sanitizePaymentJob(updated);
}

export async function cancelPaymentJob(id: string) {
  const current = getPaymentJobById(id);
  if (!current) {
    throw new HttpError(404, 'Payment job not found', { code: 'payment_job_not_found' });
  }

  if (current.status !== 'queued' && current.status !== 'running') {
    throw new HttpError(409, 'Payment job cannot be cancelled', { code: 'payment_job_cancel_not_allowed' });
  }

  const timer = processingTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    processingTimers.delete(id);
  }

  const updated = updatePaymentJob(id, {
    status: 'cancelled',
    finishedAt: new Date().toISOString(),
    errorCode: null,
    errorMessage: null
  });

  if (!updated) {
    throw new HttpError(404, 'Payment job not found', { code: 'payment_job_not_found' });
  }

  if (current.status === 'running') {
    void startNextPaymentJob(updated.locationId, updated.deviceId);

    // If the job was an Artemis real payment, notify the device so it doesn't block waiting.
    if (current.provider === 'artemis') {
      const device = getPaymentDeviceById(current.deviceId);
      if (device?.mode === 'real' && device.configJson) {
        let parsedConfig: Record<string, unknown> = {};
        try {
          parsedConfig = JSON.parse(device.configJson) as Record<string, unknown>;
        } catch {
          // malformed configJson — skip revert
        }

        const baseUrl =
          (typeof parsedConfig.baseUrl === 'string' && parsedConfig.baseUrl.trim()
            ? parsedConfig.baseUrl.trim()
            : null) ??
          process.env.ARTEMIS_TEST_BASE_URL?.trim() ??
          null;

        const owner =
          (typeof parsedConfig.owner === 'string' && parsedConfig.owner.trim()
            ? parsedConfig.owner.trim()
            : null) ??
          process.env.ARTEMIS_OWNER?.trim() ??
          'kiosk';

        const keyEnvName =
          (typeof parsedConfig.keyEnvName === 'string' ? parsedConfig.keyEnvName : undefined) ??
          (typeof parsedConfig.apiKeyEnv === 'string' ? parsedConfig.apiKeyEnv : undefined);
        const apiKey = resolveArtemisApiKey(keyEnvName);

        const timeoutMs =
          typeof parsedConfig.timeoutMs === 'number' && parsedConfig.timeoutMs > 0
            ? parsedConfig.timeoutMs
            : 120_000;

        if (baseUrl && apiKey) {
          const artemisConfig: ArtemisConfig = {
            baseUrl,
            owner,
            apiKey,
            timeoutMs,
            allowInsecureTls: parsedConfig.allowInsecureTls === true,
          };
          const reference = buildArtemisReference(id);
          try {
            await revertArtemisTransaction({ config: artemisConfig, reference });
          } catch (revertError) {
            console.error(
              '[artemis] WARN: tx_revert failed during cancelPaymentJob.',
              'Device may still be waiting. Manual intervention may be required.',
              'reference:', reference,
              'jobId:', id,
              'error:', revertError instanceof Error ? revertError.message : revertError
            );
          }
        }
      }
    }
  }

  return sanitizePaymentJob(updated);
}

export async function startNextPaymentJob(locationId: string, deviceId: string) {
  const running = getRunningPaymentJobByDeviceId(deviceId);
  if (running) {
    return sanitizePaymentJob(running);
  }

  const queued = getQueuedPaymentJobByDeviceId(deviceId);
  if (!queued || queued.locationId !== locationId) {
    return null;
  }

  const updated = updatePaymentJob(queued.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    errorCode: null,
    errorMessage: null
  });

  if (!updated) {
    return null;
  }

  scheduleProcessing(updated.id);
  return sanitizePaymentJob(updated);
}

export async function processPaymentJob(id: string) {
  const job = getPaymentJobById(id);
  if (!job) {
    return null;
  }

  if (job.status !== 'running') {
    return sanitizePaymentJob(job);
  }

  const device = getPaymentDeviceById(job.deviceId);
  if (!device) {
    return failPaymentJob(id, {
      code: 'payment_device_not_found',
      message: 'Dispositivo de pago no encontrado.'
    });
  }

  const session = getOrderSessionById(job.orderSessionId);
  if (!session) {
    return failPaymentJob(id, {
      code: 'session_not_found',
      message: 'Pedido no encontrado.'
    });
  }

  const runtime = readRuntimeConfig();
  const useDemo = runtime.paymentsSimulated || device.mode === 'demo';

  if (useDemo) {
    try {
      const confirmation = await completeCashierOrderSessionPayment(job.orderSessionId, {
        paymentProvider: toProviderPaymentName(job.provider),
        amountReceived: session.total,
        idempotencyKey: job.idempotencyKey,
        eventType: 'payment_demo_succeeded'
      });

      const demoLastLink = getLastOrderLinkByOrderSessionId(job.orderSessionId);
      return completePaymentJob(id, {
        responsePayloadJson: {
          approved: true,
          demo: true,
          orderSessionId: confirmation.orderSession.orderSessionId,
          paymentStatus: confirmation.orderSession.paymentStatus,
          lastSyncStatus: confirmation.orderSession.lastSyncStatus,
          lastCode: demoLastLink?.lastCode ?? null,
        }
      });
    } catch (error) {
      return failPaymentJob(id, {
        code: 'payment_demo_failed',
        message: error instanceof Error ? error.message : 'No se pudo completar el cobro en modo demo.'
      });
    }
  }

  if (device.mode === 'real_pending') {
    return failPaymentJob(id, {
      code: 'provider_not_enabled',
      message: 'Dispositivo configurado pero cobro real no activado.'
    });
  }

  // ── Artemis real/test flow ─────────────────────────────────────────────────

  if (job.provider === 'artemis' && device.mode === 'real') {
    return processArtemisPaymentJob(id, job, session.total, session.orderSessionId);
  }

  return failPaymentJob(id, {
    code: 'provider_adapter_not_implemented',
    message: 'El adaptador real del dispositivo todavía no está implementado.'
  });
}

async function processArtemisPaymentJob(
  jobId: string,
  job: PaymentJobRecord,
  amountCents: number,
  orderSessionId: string,
) {
  // 1. Resolve config from device configJson + ENV (never store apiKey in DB)
  const device = getPaymentDeviceById(job.deviceId);
  if (!device) {
    return failPaymentJob(jobId, {
      code: 'payment_device_not_found',
      message: 'Dispositivo de pago no encontrado.'
    });
  }

  let parsedConfig: Record<string, unknown> = {};
  try {
    if (device.configJson) {
      parsedConfig = JSON.parse(device.configJson) as Record<string, unknown>;
    }
  } catch {
    // configJson is malformed — fall through to ENV defaults
  }

  const baseUrl =
    (typeof parsedConfig.baseUrl === 'string' && parsedConfig.baseUrl.trim()
      ? parsedConfig.baseUrl.trim()
      : null) ??
    process.env.ARTEMIS_TEST_BASE_URL?.trim() ??
    null;

  const owner =
    (typeof parsedConfig.owner === 'string' && parsedConfig.owner.trim()
      ? parsedConfig.owner.trim()
      : null) ??
    process.env.ARTEMIS_OWNER?.trim() ??
    'kiosk';

  // keyEnvName: the name of the ENV var holding the API key. NOT the key itself.
  // Note: field was renamed from apiKeyEnv (stripped by sanitizer) to keyEnvName.
  const keyEnvName =
    (typeof parsedConfig.keyEnvName === 'string' ? parsedConfig.keyEnvName : undefined) ??
    (typeof parsedConfig.apiKeyEnv === 'string' ? parsedConfig.apiKeyEnv : undefined);
  const apiKey = resolveArtemisApiKey(keyEnvName);

  const timeoutMs =
    typeof parsedConfig.timeoutMs === 'number' && parsedConfig.timeoutMs > 0
      ? parsedConfig.timeoutMs
      : 120_000;

  if (!baseUrl) {
    return failPaymentJob(jobId, {
      code: 'artemis_not_configured',
      message: 'Falta la URL del datáfono (configJson.baseUrl o ARTEMIS_TEST_BASE_URL).'
    });
  }

  if (!apiKey) {
    return failPaymentJob(jobId, {
      code: 'artemis_api_key_missing',
      message: 'Falta la API key del datáfono. Configura ARTEMIS_TEST_API_KEY.'
    });
  }

  const artemisConfig: ArtemisConfig = {
    baseUrl,
    owner,
    apiKey,
    timeoutMs,
    allowInsecureTls: parsedConfig.allowInsecureTls === true,
  };
  const reference = buildArtemisReference(jobId);

  // 2. Store sanitized request payload (no apiKey, no secrets)
  updatePaymentJob(jobId, {
    requestPayloadJson: JSON.stringify({ amount: amountCents, reference, owner, baseUrl })
  });

  // 3. POST /tx_sale
  let saleResponse: Awaited<ReturnType<typeof createArtemisSale>>;
  try {
    saleResponse = await createArtemisSale({
      config: artemisConfig,
      amount: amountCents,
      reference,
    });
  } catch (networkError) {
    return failPaymentJob(jobId, {
      code: 'artemis_network_error',
      message: networkError instanceof Error
        ? networkError.message
        : 'Error de red al conectar con el datáfono.'
    });
  }

  // 4. Check sale result — anything other than "000" is a decline/error
  if (saleResponse.code !== '000') {
    return failPaymentJob(jobId, {
      code: 'artemis_sale_declined',
      message: saleResponse.message || 'Pago denegado por el datáfono.',
      responsePayloadJson: saleResponse as unknown as Record<string, unknown>
    });
  }

  // 5. Sale approved — register internal payment
  try {
    const confirmation = await completeCashierOrderSessionPayment(orderSessionId, {
      paymentProvider: 'artemis',
      amountReceived: amountCents,
      idempotencyKey: job.idempotencyKey,
      eventType: 'payment_succeeded',
    });

    // 6. Internal confirmation succeeded — confirm with datáfono
    try {
      await confirmArtemisTransaction({ config: artemisConfig, reference });
    } catch (confirmError) {
      // Payment is already recorded internally. Device may be stuck — requires manual resolution.
      console.error(
        '[artemis] WARN: tx_confirmation failed after internal payment registration.',
        'reference:', reference,
        'jobId:', jobId,
        'error:', confirmError instanceof Error ? confirmError.message : confirmError
      );
    }

    const lastOrderLink = getLastOrderLinkByOrderSessionId(orderSessionId);
    return completePaymentJob(jobId, {
      responsePayloadJson: {
        ...saleResponse,
        orderSessionId: confirmation.orderSession.orderSessionId,
        paymentStatus: confirmation.orderSession.paymentStatus,
        lastSyncStatus: confirmation.orderSession.lastSyncStatus,
        lastCode: lastOrderLink?.lastCode ?? null,
      } as unknown as Record<string, unknown>
    });

  } catch (paymentError) {
    // 7. Internal confirmation failed — revert the datáfono transaction
    console.error(
      '[artemis] CRITICAL: completeCashierOrderSessionPayment failed after approved sale.',
      'Attempting tx_revert.',
      'reference:', reference,
      'jobId:', jobId,
      'error:', paymentError instanceof Error ? paymentError.message : paymentError
    );

    try {
      await revertArtemisTransaction({ config: artemisConfig, reference });
    } catch (revertError) {
      console.error(
        '[artemis] CRITICAL: tx_revert also failed.',
        'Device may be stuck. Manual intervention required.',
        'reference:', reference,
        'jobId:', jobId,
        'error:', revertError instanceof Error ? revertError.message : revertError
      );
    }

    return failPaymentJob(jobId, {
      code: 'artemis_internal_confirmation_failed',
      message: paymentError instanceof Error
        ? paymentError.message
        : 'Error interno al registrar el pago. Operación revertida en el datáfono.',
      responsePayloadJson: saleResponse as unknown as Record<string, unknown>
    });
  }
}
