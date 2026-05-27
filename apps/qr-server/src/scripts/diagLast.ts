/**
 * Script de diagnóstico Last.app:
 *   1. GET /organizations  → imprime id/name
 *   2. Por cada organización → GET /locations?organizationId=<id> → imprime id/name
 *
 * Uso: npm run diag:last --workspace apps/qr-server
 */
import 'dotenv/config';
import { loadEnv } from '../config/env.js';

interface OrgShape {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface LocationShape {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

interface DeliveryArea {
  id?: string;
  name?: string;
  enabled?: boolean;
  deliveryFee?: number;
  minimumBasket?: number;
  estimatedDeliveryMinutes?: number;
  type?: string;
  [key: string]: unknown;
}

interface BrandShape {
  id?: string;
  name?: string;
  catalogs?: unknown[];
  fullCatalogs?: unknown[];
  [key: string]: unknown;
}

interface LocationDetail {
  id?: string;
  name?: string;
  preparationMinutes?: number;
  brands?: BrandShape[];
  deliveryAreas?: DeliveryArea[];
  shopAreas?: unknown[];
  workingTimes?: Record<string, unknown>;
  paymentMethods?: unknown[];
  offlinePaymentMethods?: unknown[];
  [key: string]: unknown;
}

async function lastGet<T>(
  baseUrl: string,
  token: string,
  path: string,
  extra: { organizationId?: string; locationId?: string } = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (extra.organizationId) {
    headers['OrganizationID'] = extra.organizationId;
  }
  if (extra.locationId) {
    headers['LocationID'] = extra.locationId;
  }
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Last.app ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function run() {
  const env = loadEnv();
  const { token, baseUrl } = env.lastApp;

  if (!token) {
    console.error('BLOQUEANTE: LAST_TOKEN no está definido en .env');
    process.exit(1);
  }

  console.log(`Base URL : ${baseUrl}`);
  console.log(`Token    : ${token.slice(0, 8)}…`);
  console.log('');

  // 1. Organizations
  console.log('--- GET /organizations ---');
  const orgsRaw = await lastGet<unknown>(baseUrl, token, '/organizations');
  const orgs: OrgShape[] = Array.isArray(orgsRaw)
    ? (orgsRaw as OrgShape[])
    : ((orgsRaw as { items?: OrgShape[] }).items ?? []);

  if (orgs.length === 0) {
    console.log('(sin organizaciones)');
    process.exit(0);
  }

  for (const org of orgs) {
    console.log(`  id: ${org.id ?? '?'}  name: ${org.name ?? '?'}`);
  }

  // 2. Locations por organización
  console.log('');
  for (const org of orgs) {
    if (!org.id) continue;
    console.log(`--- GET /locations?organizationId=${org.id} ---`);
    const locsRaw = await lastGet<unknown>(
      baseUrl,
      token,
      `/locations?organizationId=${encodeURIComponent(org.id)}`,
      { organizationId: org.id },
    );
    const locs: LocationShape[] = Array.isArray(locsRaw)
      ? (locsRaw as LocationShape[])
      : ((locsRaw as { items?: LocationShape[] }).items ?? []);

    if (locs.length === 0) {
      console.log('  (sin locations)');
    } else {
      for (const loc of locs) {
        console.log(`  id: ${loc.id ?? '?'}  name: ${loc.name ?? '?'}`);
      }
    }
  }

  // 3. Location detail (GET /locations/{locationId})
  const TARGET_LOCATION_ID = 'f9415b14-2ae1-439f-9693-812d5ac9b0ef';
  const TARGET_ORG_ID = orgs[0]?.id ?? '';

  console.log('');
  console.log(`--- GET /locations/${TARGET_LOCATION_ID} ---`);
  const locDetail = await lastGet<LocationDetail>(
    baseUrl,
    token,
    `/locations/${TARGET_LOCATION_ID}`,
    { organizationId: TARGET_ORG_ID, locationId: TARGET_LOCATION_ID },
  );

  console.log(`  id                : ${locDetail.id ?? '?'}`);
  console.log(`  name              : ${locDetail.name ?? '?'}`);
  console.log(`  preparationMinutes: ${locDetail.preparationMinutes ?? '?'}`);

  // brands — raw catalogs/fullCatalogs
  const brands = locDetail.brands ?? [];
  console.log(`\n--- brands (${brands.length}) ---`);
  for (const brand of brands) {
    console.log(`  id  : ${brand.id ?? '?'}`);
    console.log(`  name: ${brand.name ?? '?'}`);
    console.log(`  catalogs     : ${JSON.stringify(brand.catalogs ?? null, null, 2)}`);
    console.log(`  fullCatalogs : ${JSON.stringify(brand.fullCatalogs ?? null, null, 2)}`);
  }

  // workingTimes — raw
  console.log('\n--- workingTimes ---');
  console.log(JSON.stringify(locDetail.workingTimes ?? null, null, 2));

  // catalogId probe
  const TARGET_CATALOG_ID = 'd765b256-cf21-4d1b-b905-e4973fa83dae';
  const rawStr = JSON.stringify(locDetail.brands ?? null);
  const found = rawStr.includes(TARGET_CATALOG_ID);
  console.log(`\ncatalogId ${TARGET_CATALOG_ID} found in brands: ${found}`);

  console.log('\nDiagnóstico completado.');
  process.exit(0);
}

run().catch((err: unknown) => {
  console.error('Error:', err);
  process.exit(1);
});
