import type { FastifyInstance } from 'fastify';
import type { OperationalStatus } from '@kiosk/types';
import { readRuntimeConfig } from '../config.js';
import {
  extractTablesFromFloorplans,
  fetchFloorplans,
  fetchLocation,
  fetchLocations,
  fetchOrganizations
} from '../last-app.js';
import { listLiveLastOrders, updateLiveLastOrderStatus } from '../services/lastLiveOrdersService.js';
import { upsertOperationalTicketFromLastOrder } from '../services/operationalTicketService.js';

export function registerLastRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      open?: 'true' | 'false';
      since?: string;
      limit?: string;
    };
  }>('/api/last/live-orders', async (request) => {
    const open =
      request.query.open === 'true'
        ? true
        : request.query.open === 'false'
          ? false
          : undefined;
    const parsedLimit = Number.parseInt(request.query.limit ?? '', 10);

    const items = await listLiveLastOrders({
      open,
      since: request.query.since,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
    items.forEach((item) => {
      upsertOperationalTicketFromLastOrder(item);
    });

    return { items };
  });

  app.patch<{
    Params: { tabId: string };
    Body: { operationalStatus?: OperationalStatus };
  }>('/api/last/live-orders/:tabId/status', async (request) => {
    return updateLiveLastOrderStatus(request.params.tabId, request.body?.operationalStatus as OperationalStatus);
  });

  app.get('/api/last/tables', async () => {
    const config = readRuntimeConfig();
    const floorplans = await fetchFloorplans(config);
    return extractTablesFromFloorplans(floorplans);
  });

  app.get('/api/last/organizations', async () => {
    const config = readRuntimeConfig();
    return fetchOrganizations(config);
  });

  app.get<{ Querystring: { organizationId?: string } }>('/api/last/locations', async (request) => {
    const config = readRuntimeConfig();
    return fetchLocations(config, request.query.organizationId ?? '');
  });

  app.get<{ Params: { locationId: string } }>('/api/last/location/:locationId', async (request) => {
    const config = readRuntimeConfig();
    return fetchLocation(config, request.params.locationId);
  });
}
