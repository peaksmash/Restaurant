import { randomUUID } from 'node:crypto';
import * as net from 'node:net';
import type { PrintJobRecord } from '../db.js';
import {
  createPrintJobRecord,
  getLatestPrintJobByTicketId,
  getOperationalTicketById,
  getSettingsRow,
} from '../db.js';
import { HttpError } from '../last-app.js';
import type { OperationalTicket } from '@kiosk/types';
import { Resvg } from '@resvg/resvg-js';
import { getOperationalTicket, setTicketPrintStatus } from './operationalTicketService.js';
import { renderTicketSvg } from './visualTicketTemplate.js';

export type PrinterMode = 'disabled' | 'browser' | 'escpos';

function getPrinterMode(): PrinterMode {
  const envMode = process.env.PRINTER_MODE?.trim().toLowerCase();
  if (envMode === 'browser') return 'browser';
  if (envMode === 'escpos') return 'escpos';

  try {
    const row = getSettingsRow();
    if (row.printerMode === 'browser') return 'browser';
    if (row.printerMode === 'escpos') return 'escpos';
  } catch {
    // DB not ready
  }

  return 'disabled';
}

// Epson TM-M30 @ 203 DPI: print area = 72mm = 576 dots
const ESCPOS_PRINT_WIDTH_PX = 576;

function svgToEscPosRasterBuffer(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: ESCPOS_PRINT_WIDTH_PX },
    background: 'white',
  });
  const rendered = resvg.render();
  const pixels = rendered.pixels; // Uint8Array RGBA
  const width = rendered.width;
  const height = rendered.height;

  const ESC = 0x1b;
  const GS = 0x1d;

  const chunks: Buffer[] = [];

  // Init printer
  chunks.push(Buffer.from([ESC, 0x40]));

  // GS v 0 — raster bit image
  // xL, xH = bytes per line = width/8
  const bytesPerLine = Math.ceil(width / 8);
  const xL = bytesPerLine & 0xff;
  const xH = (bytesPerLine >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  chunks.push(Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]));

  // Raster data: 1 = black dot, 0 = white, MSB first
  const rasterData = Buffer.alloc(bytesPerLine * height, 0);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      // Luminance — dark pixel = print dot
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const isDark = a > 127 && lum < 128;
      if (isDark) {
        const byteIndex = row * bytesPerLine + Math.floor(col / 8);
        const bitIndex = 7 - (col % 8);
        rasterData[byteIndex] |= 1 << bitIndex;
      }
    }
  }
  chunks.push(rasterData);

  // 4 line feeds + partial cut
  chunks.push(Buffer.from([ESC, 0x64, 4])); // print and feed 4 lines
  chunks.push(Buffer.from([GS, 0x56, 0x01])); // partial cut

  return Buffer.concat(chunks);
}

function sendToEscPosPrinter(svg: string): Promise<void> {
  const row = getSettingsRow();
  const host = row.escposHost?.trim();
  const port = row.escposPort || 9100;

  if (!host) {
    throw new HttpError(503, 'ESC/POS printer not configured', { code: 'printer_connection_failed' });
  }

  const buffer = svgToEscPosRasterBuffer(svg);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;

    const cleanup = (err?: Error) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };

    socket.setTimeout(5000);
    socket.on('timeout', () => cleanup(new HttpError(503, 'Printer connection timed out', { code: 'printer_connection_failed' })));
    socket.on('error', (err) => cleanup(new HttpError(503, `Printer error: ${err.message}`, { code: 'printer_connection_failed' })));

    socket.connect(port, host, () => {
      socket.write(buffer, (err) => {
        if (err) {
          cleanup(new HttpError(503, `Printer write error: ${err.message}`, { code: 'printer_connection_failed' }));
        } else {
          cleanup();
        }
      });
    });
  });
}

function buildBrowserHtml(svg: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Vista previa de comanda</title>
    <style>
      body { margin: 0; padding: 24px; background: #f4f7fb; font-family: Arial, sans-serif; }
      .sheet { max-width: 760px; margin: 0 auto; }
      .note { margin-bottom: 16px; color: #475467; font-size: 14px; }
      .ticket { background: #ffffff; border-radius: 20px; padding: 12px; box-shadow: 0 20px 50px rgba(16,24,40,.08); }
      svg { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <p class="note">Vista previa de comanda</p>
      <div class="ticket">${svg}</div>
      <script>window.print();</script>
    </div>
  </body>
</html>`;
}

function createBasePrintJob(ticketId: string, status: PrintJobRecord['status'], mode: string, payloadJson: string, lastError: string | null, printedAt: string | null) {
  const timestamp = new Date().toISOString();
  return createPrintJobRecord({
    printJobId: randomUUID(),
    ticketId,
    status,
    mode,
    payloadJson,
    attempts: 1,
    lastError,
    createdAt: timestamp,
    updatedAt: timestamp,
    printedAt,
  });
}

export async function printOperationalTicket(ticketId: string, options?: { force?: boolean }) {
  const ticket = getOperationalTicket(ticketId);
  if (!ticket) {
    throw new HttpError(404, 'Operational ticket not found', { code: 'ticket_not_found' });
  }

  const latest = getLatestPrintJobByTicketId(ticketId);
  if (
    !options?.force &&
    latest &&
    (latest.status === 'pending' || latest.status === 'printing' || latest.status === 'printed')
  ) {
    return {
      ticket,
      printJob: latest,
      mode: latest.mode,
      previewSvg: renderTicketSvg(ticket),
      previewHtml: latest.mode === 'browser' ? (JSON.parse(latest.payloadJson).html as string) : null,
      reused: true,
      message: 'La comanda ya estaba preparada para imprimir.',
    };
  }

  const mode = getPrinterMode();
  const previewSvg = renderTicketSvg(ticket);
  const previewHtml = buildBrowserHtml(previewSvg);
  const payload = JSON.stringify({
    ticketId: ticket.ticketId,
    mode,
    svg: previewSvg,
    html: previewHtml,
  });

  if (mode === 'disabled') {
    const printJob = createBasePrintJob(
      ticket.ticketId,
      'failed',
      mode,
      payload,
      'Impresora no configurada',
      null
    );
    setTicketPrintStatus(ticket.ticketId, 'failed');
    return {
      ticket: getOperationalTicketById(ticket.ticketId) ?? ticket,
      printJob,
      mode,
      previewSvg,
      previewHtml,
      reused: false,
      message: 'Impresora no configurada',
    };
  }

  if (mode === 'escpos') {
    try {
      await sendToEscPosPrinter(previewSvg);
      const printJob = createBasePrintJob(
        ticket.ticketId,
        'printed',
        mode,
        payload,
        null,
        new Date().toISOString()
      );
      setTicketPrintStatus(ticket.ticketId, 'printed');
      return {
        ticket: getOperationalTicketById(ticket.ticketId) ?? ticket,
        printJob: getLatestPrintJobByTicketId(ticket.ticketId) ?? printJob,
        mode,
        previewSvg,
        previewHtml: null, // no abrir diálogo de navegador en modo ESC/POS
        reused: false,
        message: 'Comanda enviada a la impresora',
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al conectar con la impresora';
      const printJob = createBasePrintJob(
        ticket.ticketId,
        'failed',
        mode,
        payload,
        errorMessage,
        null
      );
      setTicketPrintStatus(ticket.ticketId, 'failed');
      return {
        ticket: getOperationalTicketById(ticket.ticketId) ?? ticket,
        printJob,
        mode,
        previewSvg,
        previewHtml: null,
        reused: false,
        message: errorMessage,
      };
    }
  }

  const printJob = createBasePrintJob(
    ticket.ticketId,
    'printed',
    mode,
    payload,
    null,
    new Date().toISOString()
  );
  setTicketPrintStatus(ticket.ticketId, 'printed');

  return {
    ticket: getOperationalTicketById(ticket.ticketId) ?? ticket,
    printJob: getLatestPrintJobByTicketId(ticket.ticketId) ?? printJob,
    mode,
    previewSvg,
    previewHtml,
    reused: false,
    message: 'Comanda lista para imprimir',
  };
}
