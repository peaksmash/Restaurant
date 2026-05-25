import http from 'node:http';
import { URL } from 'node:url';

const DEFAULT_PORT = 2091;
const MERCHANT = '354854432';
const TERMINAL = '00810001';
const OWNER_FALLBACK = 'com.local.kiosk';
const VALID_RESULTS = new Set(['manual', 'approved', 'declined', 'timeout', 'error']);
const MAX_LOG_ENTRIES = 100;

function envNumber(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeResult(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return VALID_RESULTS.has(normalized) ? normalized : 'manual';
}

const state = {
  config: {
    result: normalizeResult(process.env.ARTEMIS_MOCK_RESULT ?? 'manual'),
    delayMs: envNumber('ARTEMIS_MOCK_DELAY_MS', 1000),
    cardLabel: process.env.ARTEMIS_MOCK_CARD_LABEL?.trim() || 'VISA DEBITO',
  },
  sequence: 661,
  awaitingDecision: null,
  pendingOperation: null,
  lastOperation: null,
  logs: [],
};

function safeDecision(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'approved' || normalized === 'declined' || normalized === 'timeout' || normalized === 'error'
    ? normalized
    : null;
}

function nextOperationNumber() {
  state.sequence += 1;
  return String(state.sequence).padStart(7, '0');
}

function safeReference(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'NO-REFERENCE';
}

function safeOwner(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : OWNER_FALLBACK;
}

function safeAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function sanitizeHeaders(headers) {
  const next = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('authorization') ||
      lower.includes('token') ||
      lower.includes('apikey') ||
      lower.includes('api-key')
    ) {
      next[key] = '[redacted]';
      continue;
    }
    next[key] = value;
  }
  return next;
}

function jsonResponse(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(body));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildApprovedPayload(input) {
  const amountText = `${(input.amount / 100).toFixed(2).replace('.', ',')} EUR`;
  return {
    code: '000',
    message: 'APROBADO',
    authorization: '123456',
    operation: input.operation,
    merchant: MERCHANT,
    terminal: TERMINAL,
    reference: input.reference,
    data: {
      commerce_name: 'COMERCIO DE PRUEBAS S.L.',
      amount: amountText,
      operation_number: input.operation,
      authorization: '123456',
      card_label: state.config.cardLabel,
      operation_type: 'VENTA',
      masked_pan: '***********4453',
      response_code: '000',
    },
  };
}

function buildDeclinedPayload(reference, operation) {
  return {
    code: '005',
    message: 'DENEGADA',
    merchant: MERCHANT,
    terminal: TERMINAL,
    reference,
    operation,
    status: -1,
  };
}

function buildTimeoutPayload(reference, operation) {
  return {
    code: '003',
    message: 'Tiempo de espera superado, intente nuevamente',
    merchant: MERCHANT,
    terminal: TERMINAL,
    reference,
    operation,
    status: -1,
  };
}

function buildErrorPayload(reference, operation) {
  return {
    code: '004',
    message: 'Error inesperado, intente nuevamente',
    merchant: MERCHANT,
    terminal: TERMINAL,
    reference,
    operation,
    status: -1,
  };
}

function buildPendingConflictPayload(reference) {
  return {
    code: '007',
    message: 'Operacion pendiente de confirmacion',
    status: -1,
    reference,
  };
}

function buildNotFoundLastPayload() {
  return {
    code: '013',
    message: 'Transaccion no encontrada',
    status: -1,
  };
}

function buildPendingQueryPayload(operation) {
  return {
    code: '000',
    message: 'OPERACION PENDIENTE DE CONFIRMACION',
    status: 1,
    operation: operation.operation,
    reference: operation.reference,
    merchant: MERCHANT,
    terminal: TERMINAL,
    data: {
      operation_number: operation.operation,
      response_code: '000',
      card_label: state.config.cardLabel,
      amount: `${(operation.amount / 100).toFixed(2).replace('.', ',')} EUR`,
    },
  };
}

function buildLastPayload(operation) {
  if (!operation) {
    return buildNotFoundLastPayload();
  }

  const base = operation.response;
  return {
    ...base,
    status: operation.status === 'approved' ? 0 : -1,
    lifecycleStatus: operation.lifecycleStatus,
    owner: operation.owner,
  };
}

function sanitizeOperation(operation) {
  if (!operation) return null;
  return {
    operation: operation.operation,
    reference: operation.reference,
    owner: operation.owner,
    amount: operation.amount,
    lifecycleStatus: operation.lifecycleStatus,
    status: operation.status,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    response: operation.response
      ? {
          code: operation.response.code,
          message: operation.response.message,
          authorization: operation.response.authorization ?? null,
          merchant: operation.response.merchant ?? null,
          terminal: operation.response.terminal ?? null,
          reference: operation.response.reference ?? operation.reference,
          operation: operation.response.operation ?? operation.operation,
          status: operation.response.status ?? (operation.status === 'approved' ? 0 : -1),
          data: operation.response.data
            ? {
                commerce_name: operation.response.data.commerce_name ?? null,
                amount: operation.response.data.amount ?? null,
                operation_number: operation.response.data.operation_number ?? null,
                authorization: operation.response.data.authorization ?? null,
                card_label: operation.response.data.card_label ?? null,
                operation_type: operation.response.data.operation_type ?? null,
                masked_pan: operation.response.data.masked_pan ?? null,
                response_code: operation.response.data.response_code ?? null,
              }
            : null,
        }
      : null,
  };
}

function summarizeAwaitingDecision() {
  if (!state.awaitingDecision) return null;
  return {
    operation: sanitizeOperation(state.awaitingDecision.operation),
    waitingSince: state.awaitingDecision.waitingSince,
  };
}

function setLastOperation(operation) {
  state.lastOperation = {
    ...operation,
    updatedAt: new Date().toISOString(),
  };
}

function pushLog(entry) {
  state.logs.unshift(entry);
  if (state.logs.length > MAX_LOG_ENTRIES) {
    state.logs.length = MAX_LOG_ENTRIES;
  }
}

function buildMockStatePayload() {
  return {
    ok: true,
    config: { ...state.config },
    awaitingDecision: summarizeAwaitingDecision(),
    pendingOperation: sanitizeOperation(state.pendingOperation),
    lastOperation: sanitizeOperation(state.lastOperation),
    logs: state.logs,
  };
}

function createOperationFromSale(body) {
  return {
    operation: nextOperationNumber(),
    reference: safeReference(body.reference),
    owner: safeOwner(body.owner),
    amount: safeAmount(body.amount),
    lifecycleStatus: 'pending_confirmation',
    status: 'approved',
    response: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('invalid_json');
  }
}

function logRequest(req, context = {}) {
  const headers = sanitizeHeaders(req.headers);
  const payload = {
    ts: new Date().toISOString(),
    method: req.method,
    path: req.url,
    ...context,
  };

  pushLog({
    ts: payload.ts,
    method: payload.method,
    path: payload.path,
    code: context.code ?? null,
    reference: context.reference ?? null,
    operation: context.operation ?? null,
    pending: Boolean(state.pendingOperation),
  });

  if (process.env.ARTEMIS_MOCK_VERBOSE?.trim().toLowerCase() === 'true') {
    payload.headers = headers;
  }

  console.log(JSON.stringify(payload));
}

async function handleSale(req, res, body) {
  const reference = safeReference(body.reference);

  if (state.pendingOperation || state.awaitingDecision) {
    const payload = buildPendingConflictPayload(reference);
    logRequest(req, {
      code: payload.code,
      reference,
      operation: state.pendingOperation?.operation ?? state.awaitingDecision?.operation.operation,
    });
    return jsonResponse(res, 409, payload);
  }

  const operation = createOperationFromSale(body);

  if (state.config.result === 'manual') {
    state.awaitingDecision = {
      operation,
      req,
      res,
      waitingSince: new Date().toISOString(),
    };
    logRequest(req, {
      code: 'WAIT',
      reference: operation.reference,
      operation: operation.operation,
    });
    return;
  }

  await sleep(state.config.delayMs);

  if (state.config.result === 'approved') {
    const payload = buildApprovedPayload(operation);
    operation.response = payload;
    state.pendingOperation = operation;
    setLastOperation(operation);
    logRequest(req, {
      code: payload.code,
      reference: operation.reference,
      operation: operation.operation,
    });
    return jsonResponse(res, 200, payload);
  }

  if (state.config.result === 'declined') {
    const payload = buildDeclinedPayload(operation.reference, operation.operation);
    operation.status = 'declined';
    operation.lifecycleStatus = 'declined';
    operation.response = payload;
    setLastOperation(operation);
    logRequest(req, {
      code: payload.code,
      reference: operation.reference,
      operation: operation.operation,
    });
    return jsonResponse(res, 200, payload);
  }

  if (state.config.result === 'timeout') {
    const payload = buildTimeoutPayload(operation.reference, operation.operation);
    operation.status = 'timeout';
    operation.lifecycleStatus = 'timeout';
    operation.response = payload;
    setLastOperation(operation);
    logRequest(req, {
      code: payload.code,
      reference: operation.reference,
      operation: operation.operation,
    });
    return jsonResponse(res, 200, payload);
  }

  const payload = buildErrorPayload(operation.reference, operation.operation);
  operation.status = 'error';
  operation.lifecycleStatus = 'error';
  operation.response = payload;
  setLastOperation(operation);
  logRequest(req, {
    code: payload.code,
    reference: operation.reference,
    operation: operation.operation,
  });
  return jsonResponse(res, 200, payload);
}

async function settleAwaitingDecision(req, res, body) {
  if (!state.awaitingDecision) {
    const payload = {
      code: '012',
      message: 'No hay ninguna tarjeta esperando decision',
      status: -1,
    };
    logRequest(req, { code: payload.code });
    return jsonResponse(res, 409, payload);
  }

  const decision = safeDecision(body?.decision);
  if (!decision) {
    const payload = {
      code: '400',
      message: 'Decision invalida',
      status: -1,
    };
    logRequest(req, { code: payload.code });
    return jsonResponse(res, 400, payload);
  }

  const pending = state.awaitingDecision;
  state.awaitingDecision = null;
  const operation = pending.operation;
  await sleep(state.config.delayMs);

  let payload;
  let statusCode = 200;

  if (decision === 'approved') {
    payload = buildApprovedPayload(operation);
    operation.response = payload;
    operation.status = 'approved';
    operation.lifecycleStatus = 'pending_confirmation';
    state.pendingOperation = operation;
    setLastOperation(operation);
  } else if (decision === 'declined') {
    payload = buildDeclinedPayload(operation.reference, operation.operation);
    operation.status = 'declined';
    operation.lifecycleStatus = 'declined';
    operation.response = payload;
    setLastOperation(operation);
  } else if (decision === 'timeout') {
    payload = buildTimeoutPayload(operation.reference, operation.operation);
    operation.status = 'timeout';
    operation.lifecycleStatus = 'timeout';
    operation.response = payload;
    setLastOperation(operation);
  } else {
    payload = buildErrorPayload(operation.reference, operation.operation);
    operation.status = 'error';
    operation.lifecycleStatus = 'error';
    operation.response = payload;
    setLastOperation(operation);
  }

  logRequest(req, {
    code: payload.code,
    reference: operation.reference,
    operation: operation.operation,
  });

  jsonResponse(pending.res, statusCode, payload);
  return jsonResponse(res, 200, {
    ok: true,
    decision,
    operation: operation.operation,
    reference: operation.reference,
    mockState: buildMockStatePayload(),
  });
}

async function handleConfirmation(req, res) {
  await sleep(state.config.delayMs);
  if (!state.pendingOperation) {
    const payload = {
      code: '010',
      message: 'Error al confirmar',
      status: -1,
    };
    logRequest(req, { code: payload.code });
    return jsonResponse(res, 409, payload);
  }

  state.pendingOperation.lifecycleStatus = 'confirmed';
  setLastOperation(state.pendingOperation);
  const operation = state.pendingOperation;
  state.pendingOperation = null;
  const payload = {
    code: '000',
    message: 'APROBADO',
    status: 0,
    operation: operation.operation,
    reference: operation.reference,
  };
  logRequest(req, {
    code: payload.code,
    reference: operation.reference,
    operation: operation.operation,
  });
  return jsonResponse(res, 200, payload);
}

async function handleRevert(req, res) {
  await sleep(state.config.delayMs);
  if (!state.pendingOperation) {
    const payload = {
      code: '011',
      message: 'Error al rechazar',
      status: -1,
    };
    logRequest(req, { code: payload.code });
    return jsonResponse(res, 409, payload);
  }

  state.pendingOperation.lifecycleStatus = 'reverted';
  state.pendingOperation.status = 'reverted';
  setLastOperation(state.pendingOperation);
  const operation = state.pendingOperation;
  state.pendingOperation = null;
  const payload = {
    code: '000',
    message: 'APROBADO',
    status: 0,
    operation: operation.operation,
    reference: operation.reference,
  };
  logRequest(req, {
    code: payload.code,
    reference: operation.reference,
    operation: operation.operation,
  });
  return jsonResponse(res, 200, payload);
}

async function handleQuery(req, res) {
  await sleep(state.config.delayMs);
  const payload = state.pendingOperation
    ? buildPendingQueryPayload(state.pendingOperation)
    : buildLastPayload(state.lastOperation);
  logRequest(req, {
    code: payload.code,
    reference: 'reference' in payload ? payload.reference : undefined,
    operation: 'operation' in payload ? payload.operation : undefined,
  });
  return jsonResponse(res, 200, payload);
}

async function handleLast(req, res) {
  await sleep(state.config.delayMs);
  const payload = buildLastPayload(state.lastOperation);
  logRequest(req, {
    code: payload.code,
    reference: 'reference' in payload ? payload.reference : undefined,
    operation: 'operation' in payload ? payload.operation : undefined,
  });
  return jsonResponse(res, payload.code === '013' ? 404 : 200, payload);
}

async function handleConfig(req, res, body) {
  if (body.result != null) {
    state.config.result = normalizeResult(body.result);
  }
  if (body.delayMs != null) {
    const parsed = Number.parseInt(String(body.delayMs), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      state.config.delayMs = parsed;
    }
  }
  if (body.cardLabel != null && String(body.cardLabel).trim()) {
    state.config.cardLabel = String(body.cardLabel).trim();
  }
  logRequest(req, {
    code: '000',
    operation: state.pendingOperation?.operation ?? state.lastOperation?.operation,
    reference: state.pendingOperation?.reference ?? state.lastOperation?.reference,
  });
  return jsonResponse(res, 200, buildMockStatePayload());
}

async function handleMockState(req, res) {
  logRequest(req, {
    code: '000',
    operation: state.pendingOperation?.operation ?? state.lastOperation?.operation,
    reference: state.pendingOperation?.reference ?? state.lastOperation?.reference,
  });
  return jsonResponse(res, 200, buildMockStatePayload());
}

async function handleMockReset(req, res) {
  if (state.awaitingDecision) {
    jsonResponse(state.awaitingDecision.res, 200, {
      code: '004',
      message: 'Operacion cancelada desde el panel del mock',
      status: -1,
    });
  }
  state.awaitingDecision = null;
  state.pendingOperation = null;
  state.lastOperation = null;
  state.logs = [];
  logRequest(req, { code: '000' });
  return jsonResponse(res, 200, buildMockStatePayload());
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return jsonResponse(res, 200, {
      status: 'ok',
      result: state.config.result,
      delayMs: state.config.delayMs,
      pendingOperation: state.pendingOperation
        ? {
            operation: state.pendingOperation.operation,
            reference: state.pendingOperation.reference,
          }
        : null,
    });
  }

  if (req.method === 'GET' && url.pathname === '/__mock/state') {
    return handleMockState(req, res);
  }

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await readJsonBody(req);
    } catch {
      logRequest(req, { code: '400' });
      return jsonResponse(res, 400, {
        code: '400',
        message: 'JSON invalido',
        status: -1,
      });
    }
  }

  if (req.method === 'POST' && url.pathname === '/tx_sale') {
    return handleSale(req, res, body);
  }

  if (req.method === 'POST' && url.pathname === '/tx_confirmation') {
    return handleConfirmation(req, res);
  }

  if (req.method === 'POST' && url.pathname === '/tx_revert') {
    return handleRevert(req, res);
  }

  if (req.method === 'POST' && url.pathname === '/tx_query') {
    return handleQuery(req, res);
  }

  if (req.method === 'POST' && url.pathname === '/tx_last') {
    return handleLast(req, res);
  }

  if (req.method === 'POST' && url.pathname === '/__mock/config') {
    return handleConfig(req, res, body);
  }

  if (req.method === 'POST' && url.pathname === '/__mock/decision') {
    return settleAwaitingDecision(req, res, body);
  }

  if (req.method === 'POST' && url.pathname === '/__mock/reset') {
    return handleMockReset(req, res);
  }

  logRequest(req, { code: '404' });
  return jsonResponse(res, 404, {
    code: '404',
    message: 'Endpoint no encontrado',
    status: -1,
  });
});

const port = envNumber('ARTEMIS_MOCK_PORT', DEFAULT_PORT);

server.listen(port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      message: 'Artemis mock server listening',
      port,
      result: state.config.result,
      delayMs: state.config.delayMs,
    }),
  );
});

function shutdown(signal) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      message: 'Artemis mock server stopping',
      signal,
    }),
  );
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
