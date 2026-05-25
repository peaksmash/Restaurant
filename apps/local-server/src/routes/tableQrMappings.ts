import type { FastifyInstance } from 'fastify';
import { readRuntimeConfig } from '../config.js';
import {
  createTableQrMapping,
  getActiveTableQrMappingByLastTableId,
  getTableQrMappingById,
  listTableQrMappings,
  regenerateTableQrToken,
  setTableQrMappingEnabled,
  updateTableQrMapping
} from '../db.js';
import { HttpError } from '../last-app.js';
import {
  resolveLastTable,
  resolveTableByQrToken
} from '../services/tableQrMappingService.js';

export function registerTableQrMappingRoutes(app: FastifyInstance) {
  app.get('/api/table-qr-mappings', async () => {
    return listTableQrMappings();
  });

  app.post<{ Body: { lastTableId?: string; tableNameSnapshot?: string } }>('/api/table-qr-mappings', async (request) => {
    const config = readRuntimeConfig();

    if (!config.lastApp.locationId) {
      throw new HttpError(409, 'Missing table mapping configuration', {
        code: 'table_config_invalid',
        missingFields: ['locationId']
      });
    }

    const lastTableId = request.body?.lastTableId?.trim();
    if (!lastTableId) {
      throw new HttpError(400, 'Missing lastTableId', {
        missingFields: ['lastTableId']
      });
    }

    const existingActive = getActiveTableQrMappingByLastTableId(lastTableId);
    if (existingActive) {
      throw new HttpError(409, 'An active QR mapping already exists for this table', {
        code: 'table_qr_mapping_conflict',
        lastTableId
      });
    }

    const lastTable = await resolveLastTable(config, lastTableId);
    const tableNameSnapshot = request.body?.tableNameSnapshot?.trim() || lastTable.name;

    return createTableQrMapping({
      locationId: config.lastApp.locationId,
      lastTableId,
      tableNameSnapshot
    });
  });

  app.patch<{ Params: { id: string }; Body: { lastTableId?: string; tableNameSnapshot?: string } }>(
    '/api/table-qr-mappings/:id',
    async (request) => {
      const current = getTableQrMappingById(request.params.id);
      if (!current) {
        throw new HttpError(404, 'Table QR mapping not found');
      }

      const config = readRuntimeConfig();
      const lastTableId = request.body?.lastTableId?.trim() || current.lastTableId;
      if (!lastTableId) {
        throw new HttpError(400, 'Missing lastTableId', {
          missingFields: ['lastTableId']
        });
      }

      if (current.enabled) {
        const existingActive = getActiveTableQrMappingByLastTableId(lastTableId);
        if (existingActive && existingActive.id !== current.id) {
          throw new HttpError(409, 'An active QR mapping already exists for this table', {
            code: 'table_qr_mapping_conflict',
            lastTableId
          });
        }
      }

      let tableNameSnapshot: string | null | undefined;
      if (request.body?.tableNameSnapshot !== undefined || lastTableId !== current.lastTableId) {
        const lastTable = await resolveLastTable(config, lastTableId);
        tableNameSnapshot = request.body?.tableNameSnapshot?.trim() || lastTable.name;
      }

      return updateTableQrMapping(current.id, {
        lastTableId,
        tableNameSnapshot
      });
    }
  );

  app.post<{ Params: { id: string } }>('/api/table-qr-mappings/:id/regenerate-token', async (request) => {
    const mapping = regenerateTableQrToken(request.params.id);
    if (!mapping) {
      throw new HttpError(404, 'Table QR mapping not found');
    }

    return mapping;
  });

  app.post<{ Params: { id: string } }>('/api/table-qr-mappings/:id/enable', async (request) => {
    const current = getTableQrMappingById(request.params.id);
    if (!current) {
      throw new HttpError(404, 'Table QR mapping not found');
    }

    const existingActive = getActiveTableQrMappingByLastTableId(current.lastTableId);
    if (existingActive && existingActive.id !== current.id) {
      throw new HttpError(409, 'An active QR mapping already exists for this table', {
        code: 'table_qr_mapping_conflict',
        lastTableId: current.lastTableId
      });
    }

    return setTableQrMappingEnabled(current.id, true);
  });

  app.post<{ Params: { id: string } }>('/api/table-qr-mappings/:id/disable', async (request) => {
    const mapping = setTableQrMappingEnabled(request.params.id, false);
    if (!mapping) {
      throw new HttpError(404, 'Table QR mapping not found');
    }

    return mapping;
  });

  app.get<{ Params: { qrToken: string } }>('/api/tables/resolve/:qrToken', async (request) => {
    const config = readRuntimeConfig();
    return resolveTableByQrToken(request.params.qrToken, config);
  });
}
