import type { RuntimeConfig } from '../config.js';
import {
  getTableQrMappingById,
  getTableQrMappingByQrToken
} from '../db.js';
import {
  fetchFloorplans,
  fetchLocation,
  findLastTableById,
  HttpError
} from '../last-app.js';

export async function resolveLastTable(
  config: RuntimeConfig,
  lastTableId: string
) {
  const floorplans = await fetchFloorplans(config);
  const table = findLastTableById(floorplans, lastTableId);

  if (!table) {
    throw new HttpError(400, 'Last table not found', {
      code: 'last_table_not_found'
    });
  }

  return table;
}

export async function resolveOrderSessionTableContext(
  tableId: string | undefined,
  lastTableId: string | undefined,
  tableNameSnapshot: string | undefined
) {
  if (!tableId && !lastTableId && !tableNameSnapshot) {
    return {
      tableId: null,
      lastTableId: null,
      tableNameSnapshot: null
    };
  }

  if (!tableId) {
    throw new HttpError(400, 'tableId is required when QR table context is provided', {
      code: 'table_context_invalid',
      missingFields: ['tableId']
    });
  }

  const mapping = getTableQrMappingById(tableId);
  if (!mapping || !mapping.enabled) {
    throw new HttpError(404, 'QR table mapping not found', {
      code: 'qr_invalid'
    });
  }

  if (lastTableId && mapping.lastTableId !== lastTableId) {
    throw new HttpError(409, 'Table mapping mismatch', {
      code: 'table_context_invalid'
    });
  }

  if (tableNameSnapshot && mapping.tableNameSnapshot && mapping.tableNameSnapshot !== tableNameSnapshot) {
    throw new HttpError(409, 'Table snapshot mismatch', {
      code: 'table_context_invalid'
    });
  }

  return {
    tableId: mapping.id,
    lastTableId: mapping.lastTableId,
    tableNameSnapshot: mapping.tableNameSnapshot ?? tableNameSnapshot ?? null
  };
}

export async function resolveTableByQrToken(qrToken: string, config: RuntimeConfig) {
  const normalizedToken = qrToken.trim();

  if (!normalizedToken) {
    throw new HttpError(404, 'QR token not found', {
      code: 'qr_invalid'
    });
  }

  const mapping = getTableQrMappingByQrToken(normalizedToken);

  if (!mapping) {
    throw new HttpError(404, 'QR token not found', {
      code: 'qr_invalid'
    });
  }

  if (!mapping.enabled) {
    throw new HttpError(410, 'QR token expired', {
      code: 'qr_expired'
    });
  }

  const missingFields = [
    ['organizationId', config.lastApp.organizationId],
    ['locationId', config.lastApp.locationId],
    ['brandId', config.lastApp.brandId],
    ['catalogId', config.lastApp.catalogId]
  ].filter(([, value]) => !value);

  if (missingFields.length > 0) {
    throw new HttpError(409, 'Missing table resolution configuration', {
      code: 'table_config_invalid',
      missingFields: missingFields.map(([field]) => field)
    });
  }

  if (mapping.locationId !== config.lastApp.locationId) {
    throw new HttpError(409, 'Table location mismatch', {
      code: 'table_location_mismatch'
    });
  }

  const restaurantName = config.restaurantName || 'Restaurante';
  let tableName = mapping.tableNameSnapshot || 'Mesa';
  let locationName = restaurantName;

  try {
    const [location, floorplans] = await Promise.all([
      fetchLocation(config, config.lastApp.locationId),
      fetchFloorplans(config)
    ]);
    locationName = typeof location.name === 'string' && location.name.trim() ? location.name : restaurantName;
    tableName = findLastTableById(floorplans, mapping.lastTableId)?.name || tableName;
  } catch {
    // Fallback to snapshot when Last cannot provide the current table name.
  }

  return {
    organizationId: config.lastApp.organizationId,
    locationId: config.lastApp.locationId,
    brandId: config.lastApp.brandId,
    catalogId: config.lastApp.catalogId,
    tableId: mapping.id,
    lastTableId: mapping.lastTableId,
    tableName,
    locationName,
    restaurantName
  };
}
