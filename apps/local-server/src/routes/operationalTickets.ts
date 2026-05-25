import type { FastifyInstance } from 'fastify';
import type { OrderSource, PrintStatus } from '@kiosk/types';
import { HttpError } from '../last-app.js';
import { listLiveLastOrders } from '../services/lastLiveOrdersService.js';
import {
  getOperationalTicket,
  listOperationalTickets,
  markTicketSoundPlayed,
  upsertOperationalTicketFromLastOrder,
} from '../services/operationalTicketService.js';
import { printOperationalTicket } from '../services/printService.js';
import { renderTicketSvg } from '../services/visualTicketTemplate.js';

async function refreshTicketsFromLast(input: { activeOnly?: boolean; since?: string }) {
  const items = await listLiveLastOrders({
    open: input.activeOnly ? true : false,
    since: input.since,
    limit: input.activeOnly ? 100 : 200,
  });

  for (const item of items) {
    upsertOperationalTicketFromLastOrder(item);
  }
}

export function registerOperationalTicketRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: {
      source?: string;
      printStatus?: string;
      since?: string;
      activeOnly?: string;
    };
  }>('/api/operational-tickets', async (request) => {
    const activeOnly = request.query.activeOnly === 'true';
    try {
      await refreshTicketsFromLast({
        activeOnly,
        since: request.query.since,
      });
    } catch {
      // Preserve existing tickets even if Last is temporarily unavailable.
    }

    return {
      items: listOperationalTickets({
        source: request.query.source as OrderSource | undefined,
        printStatus: request.query.printStatus as PrintStatus | undefined,
        since: request.query.since,
        activeOnly,
      }),
      polledAt: new Date().toISOString(),
    };
  });

  app.get<{ Params: { ticketId: string } }>('/api/operational-tickets/:ticketId', async (request) => {
    const ticket = getOperationalTicket(request.params.ticketId);
    if (!ticket) {
      throw new HttpError(404, 'Operational ticket not found', { code: 'ticket_not_found' });
    }

    return {
      ticket,
      previewSvg: renderTicketSvg(ticket),
    };
  });

  app.post<{ Params: { ticketId: string } }>('/api/operational-tickets/:ticketId/sound-played', async (request) => {
    const ticket = markTicketSoundPlayed(request.params.ticketId);
    if (!ticket) {
      throw new HttpError(404, 'Operational ticket not found', { code: 'ticket_not_found' });
    }

    return { ticket };
  });

  app.post<{
    Params: { ticketId: string };
    Body: { force?: boolean };
  }>('/api/operational-tickets/:ticketId/print', async (request) => {
    return printOperationalTicket(request.params.ticketId, { force: Boolean(request.body?.force) });
  });

  app.post<{ Params: { ticketId: string } }>('/api/operational-tickets/:ticketId/reprint', async (request) => {
    return printOperationalTicket(request.params.ticketId, { force: true });
  });
}
