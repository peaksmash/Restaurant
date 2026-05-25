/**
 * ArtemisPay adapter — mock/test integration.
 *
 * Responsible for:
 *   createArtemisSale        → POST {baseUrl}/tx_sale
 *   confirmArtemisTransaction → POST {baseUrl}/tx_confirmation
 *   revertArtemisTransaction  → POST {baseUrl}/tx_revert
 *   queryArtemisTransaction   → POST {baseUrl}/tx_query
 *
 * Security rules enforced here:
 *   - API key is NEVER stored in SQLite — read from ENV at call time.
 *   - Authorization header is NEVER logged.
 *   - hash_pan is NEVER stored — treat as sensitive.
 *   - Full PAN is NEVER expected (device sends masked_pan only).
 *   - sanitizeArtemisResponse() strips all sensitive fields before returning.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';

// ─── Config ────────────────────────────────────────────────────────────────────

export interface ArtemisConfig {
  baseUrl: string;
  owner: string;
  apiKey: string;       // only in memory, never persisted
  timeoutMs: number;
  allowInsecureTls?: boolean;
}

// ─── Request / response types ─────────────────────────────────────────────────

export interface ArtemisSaleInput {
  config: ArtemisConfig;
  amount: number;       // integer cents
  reference: string;    // ≤ 20 chars, stable per payment job
}

export interface ArtemisActionInput {
  config: ArtemisConfig;
  reference: string;
}

interface ArtemisRawResponse {
  code?: string | number;
  message?: string;
  operation?: string | number;
  merchant?: string;
  terminal?: string;
  reference?: string;
  authorization?: string;
  masked_pan?: string;
  hash_pan?: string;           // sensitive — must not be stored
  status?: number | string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ArtemisSafeResponse {
  code: string;
  message: string;
  operation?: string;
  merchant?: string;
  terminal?: string;
  reference?: string;
  authorization?: string;
  masked_pan?: string;
  // hash_pan intentionally absent
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a stable reference ≤ 20 chars for a payment job.
 * Format: "AP" + first 18 hex chars of UUID (dashes removed) = exactly 20 chars.
 * Examples:
 *   "550e8400-e29b-41d4-a716-446655440000" → "AP550e8400e29b41d4a7"
 */
export function buildArtemisReference(paymentJobId: string): string {
  return `AP${paymentJobId.replace(/-/g, '').slice(0, 18)}`;
}

/**
 * Strip sensitive fields from an Artemis response before storing in DB.
 * Kept: code, message, operation, merchant, terminal, reference, authorization, masked_pan.
 * Always omitted: hash_pan (sensitive), data (may contain raw PAN blocks).
 * masked_pan is extracted from nested data if not top-level.
 */
export function sanitizeArtemisResponse(raw: ArtemisRawResponse): ArtemisSafeResponse {
  const safe: ArtemisSafeResponse = {
    code: String(raw.code ?? ''),
    message: String(raw.message ?? ''),
  };

  if (raw.operation != null) safe.operation = String(raw.operation);
  if (typeof raw.merchant === 'string' && raw.merchant) safe.merchant = raw.merchant;
  if (typeof raw.terminal === 'string' && raw.terminal) safe.terminal = raw.terminal;
  if (typeof raw.reference === 'string' && raw.reference) safe.reference = raw.reference;
  if (typeof raw.authorization === 'string' && raw.authorization) safe.authorization = raw.authorization;

  // masked_pan: safe to store. Extract from top-level or nested data block.
  const maskedPan =
    (typeof raw.masked_pan === 'string' && raw.masked_pan) ||
    (raw.data && typeof raw.data.masked_pan === 'string' && raw.data.masked_pan) ||
    undefined;
  if (maskedPan) safe.masked_pan = maskedPan;

  return safe;
}

/**
 * Resolve the API key from ENV. Never from DB.
 * Priority: process.env[apiKeyEnv] → ARTEMIS_TEST_API_KEY.
 */
export function resolveArtemisApiKey(apiKeyEnv?: string): string | null {
  if (apiKeyEnv?.trim()) {
    return process.env[apiKeyEnv.trim()]?.trim() ?? null;
  }
  return process.env.ARTEMIS_TEST_API_KEY?.trim() ?? null;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

/**
 * POST JSON to an Artemis endpoint with Bearer auth.
 * Authorization header is built in-memory and never logged.
 */
function postJson(
  url: string,
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs: number,
  allowInsecureTls = false,
): Promise<ArtemisRawResponse> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error(`URL del datáfono no válida: ${url}`));
      return;
    }

    const bodyStr = JSON.stringify(body);
    const isHttps = parsed.protocol === 'https:';
    const requestFn = isHttps ? httpsRequest : httpRequest;

    const opts: RequestOptions = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        // Never log this line or any derived string
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: timeoutMs,
      ...(isHttps && allowInsecureTls ? { rejectUnauthorized: false } : {}),
    };

    const req = (requestFn as typeof httpRequest)(opts, (res: IncomingMessage) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as ArtemisRawResponse);
        } catch {
          reject(new Error(
            `ArtemisPay devolvió una respuesta no válida (HTTP ${res.statusCode ?? '?'})`
          ));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado conectando con el datáfono.'));
    });

    req.on('error', (err: Error) => reject(err));

    req.write(bodyStr);
    req.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Initiate a card sale. Returns approved (code="000") or declined. */
export async function createArtemisSale(input: ArtemisSaleInput): Promise<ArtemisSafeResponse> {
  const raw = await postJson(
    `${input.config.baseUrl}/tx_sale`,
    { amount: input.amount, reference: input.reference, owner: input.config.owner },
    input.config.apiKey,
    input.config.timeoutMs,
    input.config.allowInsecureTls,
  );
  return sanitizeArtemisResponse(raw);
}

/**
 * Confirm an approved (pending) sale.
 * Must be called after internal payment is recorded successfully.
 * Failure here means the device is stuck — log prominently, escalate manually.
 */
export async function confirmArtemisTransaction(input: ArtemisActionInput): Promise<ArtemisSafeResponse> {
  const raw = await postJson(
    `${input.config.baseUrl}/tx_confirmation`,
    { reference: input.reference },
    input.config.apiKey,
    input.config.timeoutMs,
    input.config.allowInsecureTls,
  );
  return sanitizeArtemisResponse(raw);
}

/**
 * Revert (cancel) an approved (pending) sale.
 * Must be called if internal payment recording fails after an approved tx_sale.
 * Failure here means money may be taken but not recorded — log as critical.
 */
export async function revertArtemisTransaction(input: ArtemisActionInput): Promise<ArtemisSafeResponse> {
  const raw = await postJson(
    `${input.config.baseUrl}/tx_revert`,
    { reference: input.reference },
    input.config.apiKey,
    input.config.timeoutMs,
    input.config.allowInsecureTls,
  );
  return sanitizeArtemisResponse(raw);
}

/** Query the current or last transaction state (for diagnostics). */
export async function queryArtemisTransaction(input: ArtemisActionInput): Promise<ArtemisSafeResponse> {
  const raw = await postJson(
    `${input.config.baseUrl}/tx_query`,
    { reference: input.reference },
    input.config.apiKey,
    input.config.timeoutMs,
    input.config.allowInsecureTls,
  );
  return sanitizeArtemisResponse(raw);
}
