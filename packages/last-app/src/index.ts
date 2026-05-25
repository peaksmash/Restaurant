const DEFAULT_LAST_BASE_URL = 'https://api.last.app/v2';

export interface LastClientConfig {
  token: string;
  baseUrl?: string;
  locationId?: string;
  organizationId?: string;
}

export interface LastRequestHeadersOptions {
  locationId?: string;
  organizationId?: string;
  includeContentType?: boolean;
}

export class LastApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string, message = `Last API error (${status})`) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl || DEFAULT_LAST_BASE_URL).replace(/\/+$/, '');
}

export function buildLastHeaders(
  config: LastClientConfig,
  options: LastRequestHeadersOptions = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`
  };

  if (options.includeContentType !== false) {
    headers['Content-Type'] = 'application/json';
  }

  const locationId = options.locationId ?? config.locationId;
  if (locationId) {
    headers.LocationID = locationId;
  }

  const organizationId = options.organizationId ?? config.organizationId;
  if (organizationId) {
    headers.OrganizationID = organizationId;
  }

  return headers;
}

export async function readResponseBody(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return text || null;
  }
}

export async function requestLastJson<T>(
  config: LastClientConfig,
  path: string,
  init: {
    method: string;
    body?: unknown;
    headers?: LastRequestHeadersOptions;
  }
): Promise<T | null> {
  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}${path}`, {
    method: init.method,
    headers: buildLastHeaders(config, init.headers),
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new LastApiError(response.status, text, `Last API error (${response.status})`);
  }

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from Last for ${init.method} ${path}`);
  }
}
