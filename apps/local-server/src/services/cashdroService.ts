import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { appendOrderSessionEvent, getCashdroPaymentByOrderSessionId, getOrderSessionById, upsertCashdroPayment } from '../db.js';
import { readRuntimeConfig } from '../config.js';
import { HttpError } from '../last-app.js';
import { completeCashierOrderSessionPayment, confirmCashierOrderSessionPayment } from './recoveryService.js';

interface CashdroStartResponse {
  code: number;
  response?: {
    errorMessage?: string;
    operation?: {
      operationId?: string;
    };
  };
}

interface CashdroAskResponse {
  code: number;
  response?: {
    errorMessage?: string;
    operation?: {
      operation?: {
        operationid?: string;
        state?: string;
        payInProgress?: string;
        payOutProgress?: string;
        total?: string;
        totalin?: string;
        totalout?: string;
        amountchangenotavailable?: string;
      };
      messages?: Array<{ value?: string | number } | number>;
      withError?: string | boolean;
    };
  };
}

interface CashdroSimpleResponse {
  code: number;
  response?: {
    errorMessage?: string;
  };
}

export interface CashdroPaymentSnapshot {
  provider: 'cashdro';
  configured: boolean;
  operationId: string | null;
  aliasId: string | null;
  workflowStatus: 'pending' | 'waiting_cash' | 'dispensing_change' | 'completed' | 'cancelled' | 'failed';
  state: string | null;
  total: number;
  totalIn: number;
  totalOut: number;
  changeNotAvailable: number;
  amountRemaining: number;
  changeDue: number;
  payInProgress: number | null;
  payOutProgress: number | null;
  withError: boolean;
  messages: number[];
  imported: boolean;
  completed: boolean;
  cancelled: boolean;
  customerMessage: string;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseAmount(value: string | number | null | undefined) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim().length === 0) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMessages(value: CashdroAskResponse['response']) {
  const raw = value?.operation?.messages ?? [];
  const normalized: number[] = [];
  for (const item of raw) {
    if (typeof item === 'number') {
      normalized.push(item);
      continue;
    }
    const parsed = parseAmount(item?.value ?? null);
    if (Number.isFinite(parsed)) {
      normalized.push(parsed);
    }
  }
  return normalized;
}

function buildServiceUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!/index3\.php$/i.test(url.pathname)) {
    const normalizedPath = url.pathname.replace(/\/$/, '');
    url.pathname = `${normalizedPath}/Cashdro3WS/index3.php`.replace(/\/+/g, '/');
  }
  return url;
}

function getCashdroConfig() {
  const runtime = readRuntimeConfig();
  if (runtime.paymentsSimulated) {
    return {
      ...runtime.kiosk.payment.cashdro,
      configured: true
    };
  }
  const config = runtime.kiosk.payment.cashdro;
  if (!config.configured || !hasText(config.baseUrl) || !hasText(config.username) || !hasText(config.password)) {
    throw new HttpError(503, 'CashDro no esta configurado.', {
      code: 'cashdro_not_configured'
    });
  }
  return config;
}

async function requestCashdroJson<T>(query: Record<string, string>, label: string): Promise<T> {
  const config = getCashdroConfig();
  const url = buildServiceUrl(config.baseUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const transport = url.protocol === 'http:' ? httpRequest : httpsRequest;

  const rawBody = await new Promise<string>((resolve, reject) => {
    const req = transport(
      url,
      {
        method: 'GET',
        rejectUnauthorized: url.protocol === 'https:' ? !config.allowInsecureTls : undefined,
        timeout: 10_000
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      }
    );

    req.on('timeout', () => req.destroy(new Error(`${label} timeout`)));
    req.on('error', reject);
    req.end();
  });

  let parsed: T;
  try {
    parsed = JSON.parse(rawBody) as T;
  } catch {
    throw new HttpError(502, `CashDro devolvio una respuesta invalida en ${label}.`, {
      code: 'cashdro_invalid_response'
    });
  }

  return parsed;
}

function buildAliasId(externalId: string) {
  const compact = externalId.replace(/[^A-Za-z0-9]/g, '').slice(-10);
  return compact.length > 0 ? `P${compact}` : `P${Date.now().toString().slice(-10)}`;
}

function buildCustomerMessage(snapshot: Omit<CashdroPaymentSnapshot, 'customerMessage'>) {
  if (snapshot.cancelled) return 'Cobro cancelado.';
  if (snapshot.completed) return 'Pago efectuado.';
  if (snapshot.workflowStatus === 'dispensing_change') return 'Toma el cambio.';
  if (snapshot.workflowStatus === 'waiting_cash') return 'Introduce dinero.';
  if (snapshot.workflowStatus === 'failed') return 'Incidencia en CashDro.';
  return 'Preparando cobro...';
}

function buildSnapshot(input: {
  configured: boolean;
  operationId: string | null;
  aliasId: string | null;
  workflowStatus: CashdroPaymentSnapshot['workflowStatus'];
  state: string | null;
  total: number;
  totalIn: number;
  totalOut: number;
  changeNotAvailable: number;
  payInProgress: string | null;
  payOutProgress: string | null;
  withError: boolean;
  messages: number[];
  imported: boolean;
}) {
  const totalOutAbs = Math.abs(input.totalOut);
  const base = {
    provider: 'cashdro' as const,
    configured: input.configured,
    operationId: input.operationId,
    aliasId: input.aliasId,
    workflowStatus: input.workflowStatus,
    state: input.state,
    total: input.total,
    totalIn: input.totalIn,
    totalOut: input.totalOut,
    changeNotAvailable: input.changeNotAvailable,
    amountRemaining: Math.max(0, input.total - input.totalIn),
    changeDue: Math.max(0, totalOutAbs - input.changeNotAvailable),
    payInProgress: input.payInProgress == null ? null : parseAmount(input.payInProgress),
    payOutProgress: input.payOutProgress == null ? null : parseAmount(input.payOutProgress),
    withError: input.withError,
    messages: input.messages,
    imported: input.imported,
    completed: input.workflowStatus === 'completed',
    cancelled: input.workflowStatus === 'cancelled'
  };

  return {
    ...base,
    customerMessage: buildCustomerMessage(base)
  };
}

function mapWorkflowStatus(state: string | null, total: number, totalIn: number, payInProgress: string | null, payOutProgress: string | null) {
  if (state === 'F' && payInProgress === '1' && (payOutProgress === '1' || totalIn <= total)) {
    return 'completed' as const;
  }
  if (state === 'F' && payOutProgress === '1') {
    return 'completed' as const;
  }
  if (totalIn >= total && payOutProgress === '0') {
    return 'dispensing_change' as const;
  }
  if (state === 'I' || state === 'Q') {
    return 'pending' as const;
  }
  if (state === 'E' || state === 'F') {
    return 'waiting_cash' as const;
  }
  return 'failed' as const;
}

async function importCashdroOperation(operationId: string) {
  const config = getCashdroConfig();
  const response = await requestCashdroJson<CashdroSimpleResponse>(
    {
      operation: 'setOperationImported',
      name: config.username,
      password: config.password,
      operationId
    },
    'setOperationImported'
  );

  if (response.code !== 1) {
    throw new HttpError(502, response.response?.errorMessage ?? 'CashDro no pudo importar la operacion.', {
      code: 'cashdro_import_failed',
      providerCode: response.code
    });
  }
}

export async function startCashdroPayment(orderSessionId: string) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', { code: 'session_not_found' });
  }

  if (session.paymentMode !== 'cashier') {
    throw new HttpError(400, 'CashDro only supports cashier sessions', {
      code: 'cashdro_not_allowed'
    });
  }

  if (session.paymentStatus === 'paid') {
    const existingPaid = getCashdroPaymentByOrderSessionId(orderSessionId);
    return {
      orderSession: session,
      payment: buildSnapshot({
        configured: true,
        operationId: existingPaid?.operationId ?? null,
        aliasId: existingPaid?.aliasId ?? null,
        workflowStatus: 'completed',
        state: existingPaid?.state ?? 'F',
        total: session.total,
        totalIn: existingPaid?.totalIn ?? session.total,
        totalOut: existingPaid?.totalOut ?? 0,
        changeNotAvailable: existingPaid?.changeNotAvailable ?? 0,
        payInProgress: existingPaid?.payInProgress ?? '1',
        payOutProgress: existingPaid?.payOutProgress ?? '1',
        withError: false,
        messages: existingPaid?.messages ?? [],
        imported: Boolean(existingPaid?.importedAt)
      })
    };
  }

  if (session.lastSyncStatus !== 'not_sent' || session.paymentStatus !== 'unpaid') {
    throw new HttpError(409, 'Order session is not payable', {
      code: 'cashdro_not_allowed'
    });
  }

  if (readRuntimeConfig().paymentsSimulated) {
    const operationId = `cashdro-demo-${orderSessionId}`;
    const aliasId = buildAliasId(session.externalId);
    const confirmation = await completeCashierOrderSessionPayment(orderSessionId, {
      paymentProvider: 'cashdro',
      amountReceived: session.total,
      idempotencyKey: operationId,
      eventType: 'payment_demo_succeeded'
    });

    const completedAt = new Date().toISOString();
    const updatedPayment = upsertCashdroPayment({
      orderSessionId,
      operationId,
      aliasId,
      workflowStatus: 'completed',
      state: 'F',
      total: session.total,
      totalIn: session.total,
      totalOut: 0,
      changeNotAvailable: 0,
      payInProgress: '1',
      payOutProgress: '1',
      withError: false,
      messages: [],
      importedAt: completedAt,
      completedAt,
      rawJson: {
        demo: true
      }
    });

    appendOrderSessionEvent({
      orderSessionId,
      type: 'cashdro_payment_completed',
      actorType: 'system',
      rawJson: {
        operationId,
        demo: true,
        totalIn: session.total,
        totalOut: 0
      }
    });

    return {
      orderSession: confirmation.orderSession,
      payment: buildSnapshot({
        configured: true,
        operationId: updatedPayment.operationId,
        aliasId: updatedPayment.aliasId,
        workflowStatus: 'completed',
        state: updatedPayment.state,
        total: updatedPayment.total,
        totalIn: updatedPayment.totalIn,
        totalOut: updatedPayment.totalOut,
        changeNotAvailable: updatedPayment.changeNotAvailable,
        payInProgress: updatedPayment.payInProgress,
        payOutProgress: updatedPayment.payOutProgress,
        withError: updatedPayment.withError,
        messages: updatedPayment.messages,
        imported: true
      })
    };
  }

  const existing = getCashdroPaymentByOrderSessionId(orderSessionId);
  if (existing && !['completed', 'cancelled', 'failed'].includes(existing.workflowStatus)) {
    return getCashdroPaymentStatus(orderSessionId);
  }

  const config = getCashdroConfig();
  const aliasId = buildAliasId(session.externalId);
  const startResponse = await requestCashdroJson<CashdroStartResponse>(
    {
      operation: 'startOperation',
      name: config.username,
      password: config.password,
      type: '3',
      posid: config.posId,
      posuser: config.posUser,
      aliasid: aliasId,
      parameters: JSON.stringify({ amount: String(session.total) })
    },
    'startOperation'
  );

  if (startResponse.code !== 1 || !hasText(startResponse.response?.operation?.operationId)) {
    throw new HttpError(502, startResponse.response?.errorMessage ?? 'CashDro no pudo iniciar el cobro.', {
      code: 'cashdro_start_failed',
      providerCode: startResponse.code
    });
  }

  const operationId = startResponse.response.operation.operationId.trim();
  const ackResponse = await requestCashdroJson<CashdroSimpleResponse>(
    {
      operation: 'acknowledgeOperationId',
      name: config.username,
      password: config.password,
      operationId
    },
    'acknowledgeOperationId'
  );

  if (ackResponse.code !== 1) {
    throw new HttpError(502, ackResponse.response?.errorMessage ?? 'CashDro no pudo arrancar el cobro.', {
      code: 'cashdro_ack_failed',
      providerCode: ackResponse.code
    });
  }

  upsertCashdroPayment({
    orderSessionId,
    operationId,
    aliasId,
    workflowStatus: 'pending',
    state: 'I',
    total: session.total,
    messages: []
  });

  appendOrderSessionEvent({
    orderSessionId,
    type: 'cashdro_payment_started',
    actorType: 'system',
    rawJson: {
      operationId,
      aliasId
    }
  });

  return getCashdroPaymentStatus(orderSessionId);
}

export async function getCashdroPaymentStatus(orderSessionId: string) {
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', { code: 'session_not_found' });
  }

  const payment = getCashdroPaymentByOrderSessionId(orderSessionId);
  if (!payment) {
    throw new HttpError(404, 'CashDro payment not found', { code: 'cashdro_payment_not_found' });
  }

  if (session.paymentStatus === 'paid' && payment.workflowStatus === 'completed') {
    return {
      orderSession: session,
      payment: buildSnapshot({
        configured: true,
        operationId: payment.operationId,
        aliasId: payment.aliasId,
        workflowStatus: 'completed',
        state: payment.state,
        total: payment.total,
        totalIn: payment.totalIn,
        totalOut: payment.totalOut,
        changeNotAvailable: payment.changeNotAvailable,
        payInProgress: payment.payInProgress,
        payOutProgress: payment.payOutProgress,
        withError: payment.withError,
        messages: payment.messages,
        imported: Boolean(payment.importedAt)
      })
    };
  }

  const config = getCashdroConfig();
  const response = await requestCashdroJson<CashdroAskResponse>(
    {
      operation: 'askOperation',
      operationId: payment.operationId,
      name: config.username,
      password: config.password
    },
    'askOperation'
  );

  if (response.code !== 1) {
    throw new HttpError(502, response.response?.errorMessage ?? 'CashDro no devolvio el estado del cobro.', {
      code: 'cashdro_status_failed',
      providerCode: response.code
    });
  }

  const operation = response.response?.operation?.operation ?? {};
  const total = parseAmount(operation.total) || session.total;
  const totalIn = parseAmount(operation.totalin);
  const totalOut = parseAmount(operation.totalout);
  const changeNotAvailable = parseAmount(operation.amountchangenotavailable);
  const state = operation.state ?? null;
  const payInProgress = operation.payInProgress ?? null;
  const payOutProgress = operation.payOutProgress ?? null;
  const withError = response.response?.operation?.withError === true || response.response?.operation?.withError === 'true';
  const messages = normalizeMessages(response.response);
  const workflowStatus = mapWorkflowStatus(state, total, totalIn, payInProgress, payOutProgress);

  let updatedPayment = upsertCashdroPayment({
    orderSessionId,
    operationId: payment.operationId,
    aliasId: payment.aliasId,
    workflowStatus,
    state,
    total,
    totalIn,
    totalOut,
    changeNotAvailable,
    payInProgress,
    payOutProgress,
    withError,
    messages,
    rawJson: response as unknown as Record<string, unknown>
  });

  let finalOrderSession = session;

  if (workflowStatus === 'completed' && !updatedPayment.importedAt) {
    await importCashdroOperation(payment.operationId);
    const confirmation = await confirmCashierOrderSessionPayment(orderSessionId, {
      paymentMode: 'cashier',
      paymentProvider: 'cashdro',
      amountReceived: totalIn,
      idempotencyKey: `cashdro-${payment.operationId}`
    });

    finalOrderSession = confirmation.orderSession;
    updatedPayment = upsertCashdroPayment({
      orderSessionId,
      operationId: payment.operationId,
      aliasId: payment.aliasId,
      workflowStatus: 'completed',
      state,
      total,
      totalIn,
      totalOut,
      changeNotAvailable,
      payInProgress,
      payOutProgress,
      withError,
      messages,
      rawJson: response as unknown as Record<string, unknown>,
      importedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });

    appendOrderSessionEvent({
      orderSessionId,
      type: 'cashdro_payment_completed',
      actorType: 'system',
      rawJson: {
        operationId: payment.operationId,
        totalIn,
        totalOut
      }
    });
  }

  return {
    orderSession: finalOrderSession,
    payment: buildSnapshot({
      configured: true,
      operationId: updatedPayment.operationId,
      aliasId: updatedPayment.aliasId,
      workflowStatus: updatedPayment.workflowStatus as CashdroPaymentSnapshot['workflowStatus'],
      state: updatedPayment.state,
      total: updatedPayment.total,
      totalIn: updatedPayment.totalIn,
      totalOut: updatedPayment.totalOut,
      changeNotAvailable: updatedPayment.changeNotAvailable,
      payInProgress: updatedPayment.payInProgress,
      payOutProgress: updatedPayment.payOutProgress,
      withError: updatedPayment.withError,
      messages: updatedPayment.messages,
      imported: Boolean(updatedPayment.importedAt)
    })
  };
}

export async function cancelCashdroPayment(orderSessionId: string) {
  const payment = getCashdroPaymentByOrderSessionId(orderSessionId);
  const session = getOrderSessionById(orderSessionId);
  if (!session) {
    throw new HttpError(404, 'Order session not found', { code: 'session_not_found' });
  }
  if (!payment) {
    throw new HttpError(404, 'CashDro payment not found', { code: 'cashdro_payment_not_found' });
  }

  const config = getCashdroConfig();
  const response = await requestCashdroJson<CashdroSimpleResponse>(
    {
      operation: 'finishOperation',
      name: config.username,
      password: config.password,
      operationId: payment.operationId,
      type: '2'
    },
    'finishOperation'
  );

  if (response.code !== 1 && response.code !== -2) {
    throw new HttpError(502, response.response?.errorMessage ?? 'CashDro no pudo cancelar el cobro.', {
      code: 'cashdro_cancel_failed',
      providerCode: response.code
    });
  }

  const updatedPayment = upsertCashdroPayment({
    orderSessionId,
    operationId: payment.operationId,
    aliasId: payment.aliasId,
    workflowStatus: 'cancelled',
    state: payment.state ?? 'F',
    total: payment.total,
    totalIn: payment.totalIn,
    totalOut: payment.totalOut,
    changeNotAvailable: payment.changeNotAvailable,
    payInProgress: payment.payInProgress,
    payOutProgress: payment.payOutProgress,
    withError: payment.withError,
    messages: payment.messages,
    importedAt: payment.importedAt ?? new Date().toISOString(),
    completedAt: new Date().toISOString()
  });

  appendOrderSessionEvent({
    orderSessionId,
    type: 'cashdro_payment_cancelled',
    actorType: 'system',
    rawJson: {
      operationId: payment.operationId
    }
  });

  return {
    orderSession: session,
    payment: buildSnapshot({
      configured: true,
      operationId: updatedPayment.operationId,
      aliasId: updatedPayment.aliasId,
      workflowStatus: 'cancelled',
      state: updatedPayment.state,
      total: updatedPayment.total,
      totalIn: updatedPayment.totalIn,
      totalOut: updatedPayment.totalOut,
      changeNotAvailable: updatedPayment.changeNotAvailable,
      payInProgress: updatedPayment.payInProgress,
      payOutProgress: updatedPayment.payOutProgress,
      withError: updatedPayment.withError,
      messages: updatedPayment.messages,
      imported: Boolean(updatedPayment.importedAt)
    })
  };
}
