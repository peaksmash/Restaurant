import type { FirestoreTenantRepository } from './tenantRepository.js';
import { buildTenantConfigResponse } from './tenantRepository.js';

interface ErrorWithStatusCode extends Error {
  statusCode?: number;
}

function fail(statusCode: number, message: string): never {
  const error = new Error(message) as ErrorWithStatusCode;
  error.statusCode = statusCode;
  throw error;
}

export function normalizeHostname(rawHost: string) {
  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/:\d+$/, '');
}

export interface ResolveTenantConfigInput {
  hostname: string;
  tenantSlug?: string;
}

export async function resolveTenantConfig(
  repository: FirestoreTenantRepository,
  input: ResolveTenantConfigInput,
) {
  const hostname = normalizeHostname(input.hostname);
  const tenantSlug = input.tenantSlug?.trim().toLowerCase() ?? '';

  const tenant =
    (hostname ? await repository.findTenantByHostname(hostname) : null) ??
    (tenantSlug ? await repository.findTenantBySlug(tenantSlug) : null);

  if (!tenant) {
    fail(404, 'Tenant not found.');
  }

  const resolvedTenant = tenant;

  if (!resolvedTenant.online.enabled) {
    fail(403, 'Tenant is disabled for online usage.');
  }

  const locations = await repository.listEnabledLocations(resolvedTenant.tenantId);

  return buildTenantConfigResponse(resolvedTenant, locations);
}
