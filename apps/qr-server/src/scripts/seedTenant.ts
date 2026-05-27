/**
 * Seed script: reads real data from Last.app and writes Firestore tenant + location.
 * Usage: npm run seed:tenant --workspace apps/qr-server
 *
 * Flow:
 *   1. GET /organizations           → real org id / name
 *   2. GET /locations?organizationId → real location id / name (first)
 *   3. GET /locations/{id}          → brands, catalogs
 *   4. Derive slugs and write Firestore
 *   5. Update apps/qr-pedidos/.env
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../config/env.js';
import { getFirestoreDb } from '../config/firebaseAdmin.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asRecord(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ── Last.app HTTP ─────────────────────────────────────────────────────────────

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
  if (extra.organizationId) headers['OrganizationID'] = extra.organizationId;
  if (extra.locationId)     headers['LocationID']     = extra.locationId;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new Error(`Last.app ${res.status} ${path}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Catalog ID extraction ─────────────────────────────────────────────────────

interface CatalogIds {
  qr_delivery: string | null;
  qr_pickup: string | null;
  qr_table: string | null;
}

function extractCatalogIds(brand: Record<string, unknown>): CatalogIds {
  const fullCatalogs = asRecord(brand.fullCatalogs);
  const catalogsDefault = asStr(asRecord(brand.catalogs)['default']) || null;

  // fullCatalogs.default has specific per-channel IDs
  const fullDefault = asRecord(fullCatalogs['default']);
  const deliveryCatalogId = asStr(fullDefault.deliveryCatalogId) || null;
  const takeawayCatalogId = asStr(fullDefault.takeawayCatalogId) || null;
  const onsiteCatalogId   = asStr(fullDefault.onsiteCatalogId)   || null;

  return {
    qr_delivery: deliveryCatalogId ?? catalogsDefault,
    qr_pickup:   takeawayCatalogId ?? catalogsDefault,
    qr_table:    onsiteCatalogId   ?? catalogsDefault,
  };
}

// ── .env update ───────────────────────────────────────────────────────────────

function updateQrPedidosEnv(tenantSlug: string, locationKey: string): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // from apps/qr-server/src/scripts/ → apps/ → apps/qr-pedidos/.env
  const envPath = path.resolve(__dirname, '../../../qr-pedidos/.env');

  if (!fs.existsSync(envPath)) {
    console.warn(`  ⚠ .env not found at ${envPath} — skipping update`);
    return;
  }

  let content = fs.readFileSync(envPath, 'utf8');

  const set = (key: string, value: string) => {
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) {
      content = content.replace(re, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  };

  set('VITE_QR_SERVER_TENANT', tenantSlug);
  set('VITE_QR_SERVER_LOCATION_KEY', locationKey);

  fs.writeFileSync(envPath, content, 'utf8');
  console.log(`  ✓ apps/qr-pedidos/.env updated`);
  console.log(`      VITE_QR_SERVER_TENANT=${tenantSlug}`);
  console.log(`      VITE_QR_SERVER_LOCATION_KEY=${locationKey}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const env = loadEnv();
  const { token, baseUrl } = env.lastApp;

  if (!token) {
    console.error('LAST_TOKEN is not set in .env');
    process.exit(1);
  }

  console.log(`Last.app base URL : ${baseUrl}`);
  console.log(`Last.app token    : ${token.slice(0, 8)}…`);
  console.log('');

  // ── 1. Organizations ─────────────────────────────────────────────────────
  console.log('Step 1: GET /organizations');
  const orgsRaw = await lastGet<unknown>(baseUrl, token, '/organizations');
  const orgs = Array.isArray(orgsRaw)
    ? (orgsRaw as Record<string, unknown>[])
    : asArray((orgsRaw as Record<string, unknown>).items) as Record<string, unknown>[];

  if (orgs.length === 0) throw new Error('No organizations returned from Last.app');

  const org = orgs[0];
  const orgId   = asStr(org.id);
  const orgName = asStr(org.name);
  if (!orgId) throw new Error('Organization has no id');

  console.log(`  → organization: ${orgName} (${orgId})`);

  // ── 2. Locations ─────────────────────────────────────────────────────────
  console.log(`\nStep 2: GET /locations?organizationId=${orgId}`);
  const locsRaw = await lastGet<unknown>(
    baseUrl, token,
    `/locations?organizationId=${encodeURIComponent(orgId)}`,
    { organizationId: orgId },
  );
  const locs = Array.isArray(locsRaw)
    ? (locsRaw as Record<string, unknown>[])
    : asArray((locsRaw as Record<string, unknown>).items) as Record<string, unknown>[];

  if (locs.length === 0) throw new Error('No locations returned from Last.app');

  const loc = locs[0];
  const locId   = asStr(loc.id);
  const locName = asStr(loc.name);
  if (!locId) throw new Error('Location has no id');

  console.log(`  → location: ${locName} (${locId})`);
  if (locs.length > 1) {
    console.log(`  (${locs.length - 1} other location(s) ignored)`);
  }

  // ── 3. Location detail ────────────────────────────────────────────────────
  console.log(`\nStep 3: GET /locations/${locId}`);
  const detail = await lastGet<Record<string, unknown>>(
    baseUrl, token,
    `/locations/${locId}`,
    { organizationId: orgId, locationId: locId },
  );

  const brands = asArray(detail.brands) as Record<string, unknown>[];
  if (brands.length === 0) throw new Error('No brands found in location detail');

  const brand = brands[0];
  const brandId   = asStr(brand.id);
  const brandName = asStr(brand.name);
  if (!brandId) throw new Error('Brand has no id');

  console.log(`  → brand: ${brandName} (${brandId})`);

  const catalogIds = extractCatalogIds(brand);
  console.log(`  → catalogIds:`);
  console.log(`      qr_delivery : ${catalogIds.qr_delivery ?? '(none)'}`);
  console.log(`      qr_pickup   : ${catalogIds.qr_pickup   ?? '(none)'}`);
  console.log(`      qr_table    : ${catalogIds.qr_table    ?? '(none)'}`);

  // ── 4. Derive slugs ───────────────────────────────────────────────────────
  const tenantSlug  = slugify(orgName);
  const locationKey = slugify(locName);

  if (!tenantSlug)  throw new Error(`Could not slugify org name: "${orgName}"`);
  if (!locationKey) throw new Error(`Could not slugify loc name: "${locName}"`);

  console.log(`\nDerived:`);
  console.log(`  tenantSlug  : ${tenantSlug}`);
  console.log(`  locationKey : ${locationKey}`);
  console.log(`  hostname    : ${tenantSlug}.pideahora.com`);

  // ── 5. Build documents ────────────────────────────────────────────────────
  const tenantData = {
    tenantId: tenantSlug,
    tenantSlug,
    displayName: orgName,
    orderWeb: {
      hostname: `${tenantSlug}.pideahora.com`,
    },
    lastApp: {
      organizationId: orgId,
    },
    online: {
      enabled: true,
    },
    branding: {
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
    },
    features: {
      qrEnabled: true,
      deliveryEnabled: catalogIds.qr_delivery !== null,
      pickupEnabled:   catalogIds.qr_pickup   !== null,
      tableQrEnabled:  catalogIds.qr_table    !== null,
    },
  };

  const locationData = {
    locationKey,
    slug: locationKey,
    displayName: locName,
    lastApp: {
      organizationId: orgId,
      locationId:     locId,
      brandId:        brandId,
    },
    geo: {
      lat: null,
      lng: null,
    },
    catalogsByChannel: {
      kiosk:       { catalogId: null },
      qr_delivery: { catalogId: catalogIds.qr_delivery },
      qr_pickup:   { catalogId: catalogIds.qr_pickup   },
      qr_table:    { catalogId: catalogIds.qr_table    },
    },
    online: {
      enabled:        true,
      deliveryEnabled: catalogIds.qr_delivery !== null,
      pickupEnabled:   catalogIds.qr_pickup   !== null,
      tableQrEnabled:  catalogIds.qr_table    !== null,
    },
    timezone: 'Europe/Madrid',
  };

  // ── 6. Write Firestore ────────────────────────────────────────────────────
  const db = getFirestoreDb(env);
  const tenantRef   = db.collection('tenants').doc(tenantSlug);
  const locationRef = tenantRef.collection('locations').doc(locationKey);

  console.log(`\nWriting Firestore:`);

  console.log(`  /tenants/${tenantSlug}`);
  await tenantRef.set(tenantData);
  console.log(`  ✓ /tenants/${tenantSlug}`);

  console.log(`  /tenants/${tenantSlug}/locations/${locationKey}`);
  await locationRef.set(locationData);
  console.log(`  ✓ /tenants/${tenantSlug}/locations/${locationKey}`);

  // ── 7. Update .env ────────────────────────────────────────────────────────
  console.log(`\nUpdating apps/qr-pedidos/.env:`);
  updateQrPedidosEnv(tenantSlug, locationKey);

  console.log('\n✅ Seed completed.');
  console.log(`\nTest with:`);
  console.log(`  curl -i "http://127.0.0.1:3005/api/tenant/config?tenant=${tenantSlug}"`);
  console.log(`  curl -i "http://127.0.0.1:3005/api/tenant/bootstrap?tenant=${tenantSlug}&locationKey=${locationKey}&orderMode=delivery"`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
