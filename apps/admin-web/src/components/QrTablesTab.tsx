import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminTableQrMapping, LastTableListItem } from '../api';
import {
  createTableQrMapping,
  disableTableQrMapping,
  enableTableQrMapping,
  getLastTables,
  getTableQrMappings,
  regenerateTableQrToken,
} from '../api';
import { buildQrDataUrl } from '../lib/qrCode';

function getActiveOrLatestMapping(mappings: AdminTableQrMapping[], lastTableId: string) {
  const matches = mappings
    .filter((mapping) => mapping.lastTableId === lastTableId)
    .sort((a, b) => {
      if (a.enabled !== b.enabled) {
        return a.enabled ? -1 : 1;
      }

      return b.updatedAt.localeCompare(a.updatedAt);
    });

  return matches[0] ?? null;
}

function maskQrToken(qrToken: string) {
  if (qrToken.length <= 10) {
    return qrToken;
  }

  return `${qrToken.slice(0, 6)}...${qrToken.slice(-4)}`;
}

function buildQrPath(qrToken: string) {
  return `/?qrToken=${encodeURIComponent(qrToken)}`;
}

function sanitizeFileNameSegment(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

async function downloadTableQrPng(input: {
  tableName: string;
  fileNameBase: string;
  qrValue: string;
  visibleCode: string;
}) {
  const qrDataUrl = await buildQrDataUrl(input.qrValue, 520);
  const qrImage = new Image();
  qrImage.src = qrDataUrl;

  await new Promise<void>((resolve, reject) => {
    qrImage.onload = () => resolve();
    qrImage.onerror = () => reject(new Error('No se pudo generar el QR.'));
  });

  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo preparar la descarga del QR.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.font = '700 64px Arial';
  ctx.fillText(input.tableName, canvas.width / 2, 120);

  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 2;
  ctx.strokeRect(260, 220, 680, 680);
  ctx.drawImage(qrImage, 290, 250, 620, 620);

  ctx.fillStyle = '#111111';
  ctx.font = '700 34px Arial';
  ctx.fillText('Escanea este QR para abrir la mesa', canvas.width / 2, 980);

  ctx.fillStyle = '#4b5563';
  ctx.font = '600 30px Arial';
  ctx.fillText('Código / ruta', canvas.width / 2, 1060);

  ctx.fillStyle = '#111111';
  ctx.font = '600 24px monospace';
  const code = input.visibleCode;
  const maxWidth = 920;
  const words = code.split(/(?<=\/)|(?<=\?)/g);
  const lines: string[] = [];
  let currentLine = '';

  for (const part of words) {
    const nextLine = currentLine ? `${currentLine}${part}` : part;
    if (ctx.measureText(nextLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = part;
    } else {
      currentLine = nextLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, 1110 + index * 34);
  });

  const link = document.createElement('a');
  link.download = `qr-mesa-${sanitizeFileNameSegment(input.fileNameBase)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

interface Props {
  onDataChange?: () => void;
}

export function QrTablesTab({ onDataChange }: Props) {
  const [tables, setTables] = useState<LastTableListItem[]>([]);
  const [mappings, setMappings] = useState<AdminTableQrMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [tablesData, mappingsData] = await Promise.all([getLastTables(), getTableQrMappings()]);
      setTables(tablesData);
      setMappings(mappingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar mesas QR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(
    () =>
      tables
        .map((table) => ({
          table,
          mapping: getActiveOrLatestMapping(mappings, table.id),
        }))
        .sort((a, b) => {
          const floorplanA = a.table.floorplanName ?? '';
          const floorplanB = b.table.floorplanName ?? '';
          if (floorplanA !== floorplanB) {
            return floorplanA.localeCompare(floorplanB);
          }

          return a.table.name.localeCompare(b.table.name);
        }),
    [mappings, tables]
  );

  async function runAction(key: string, action: () => Promise<void>) {
    setBusyKey(key);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la accion.');
    } finally {
      setBusyKey('');
    }
  }

  async function handleCreate(table: LastTableListItem) {
    await runAction(`create:${table.id}`, async () => {
      await createTableQrMapping({
        lastTableId: table.id,
        tableNameSnapshot: table.name,
      });
      setMessage(`QR creado para ${table.name}.`);
      await loadData();
      onDataChange?.();
    });
  }

  async function handleCopyQr(mapping: AdminTableQrMapping) {
    const qrPath = buildQrPath(mapping.qrToken);
    try {
      await navigator.clipboard.writeText(qrPath);
      setMessage(`Path QR copiado para ${mapping.tableNameSnapshot || mapping.lastTableId}.`);
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  }

  async function handleDownloadQr(mapping: AdminTableQrMapping) {
    try {
      const tableLabel = mapping.tableNameSnapshot?.trim() || mapping.lastTableId;
      const qrPath = buildQrPath(mapping.qrToken);
      await downloadTableQrPng({
        tableName: `Mesa ${tableLabel}`,
        fileNameBase: mapping.tableNameSnapshot?.trim() || mapping.lastTableId,
        qrValue: qrPath,
        visibleCode: qrPath,
      });
      setMessage(`QR descargado para ${tableLabel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo descargar el QR.');
    }
  }

  async function handleToggle(mapping: AdminTableQrMapping, enable: boolean) {
    await runAction(`${enable ? 'enable' : 'disable'}:${mapping.id}`, async () => {
      if (enable) {
        await enableTableQrMapping(mapping.id);
        setMessage(`QR activado para ${mapping.tableNameSnapshot || mapping.lastTableId}.`);
      } else {
        await disableTableQrMapping(mapping.id);
        setMessage(`QR desactivado para ${mapping.tableNameSnapshot || mapping.lastTableId}.`);
      }
      await loadData();
      onDataChange?.();
    });
  }

  async function handleRegenerate(mapping: AdminTableQrMapping) {
    if (!window.confirm(`Se regenerara el token QR de ${mapping.tableNameSnapshot || mapping.lastTableId}. El QR actual dejara de funcionar. Continuar?`)) {
      return;
    }

    await runAction(`regen:${mapping.id}`, async () => {
      await regenerateTableQrToken(mapping.id);
      setMessage(`Token regenerado para ${mapping.tableNameSnapshot || mapping.lastTableId}.`);
      await loadData();
      onDataChange?.();
    });
  }

  return (
    <div className="tab-content">
      <div className="section-title">QR por mesa</div>

      <div className="card">
        <div className="card-header">
          <h2>Mesas reales de Last</h2>
          <button className="btn btn-secondary" onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Actualizando...' : 'Recargar'}
          </button>
        </div>

        <div className="infobox infobox-info">
          Last sigue siendo el owner de las mesas. Aqui solo gestionamos el mapping entre una mesa real de Last y su QR.
          Si no hay base publica configurada, el copiado usa el path <code>/?qrToken=...</code>.
        </div>

        {error && <p className="msg msg-error">{error}</p>}
        {message && <p className="msg msg-success">{message}</p>}

        {rows.length === 0 && !loading ? (
          <p className="hint">No se encontraron mesas reales en Last para este local.</p>
        ) : (
          <div className="qr-table-list">
            {rows.map(({ table, mapping }) => {
              const createBusy = busyKey === `create:${table.id}`;
              const enableBusy = mapping ? busyKey === `enable:${mapping.id}` : false;
              const disableBusy = mapping ? busyKey === `disable:${mapping.id}` : false;
              const regenerateBusy = mapping ? busyKey === `regen:${mapping.id}` : false;

              return (
                <div key={table.id} className="qr-table-row">
                  <div className="qr-table-main">
                    <div className="qr-table-title-row">
                      <h3>{table.name}</h3>
                      <span className={`badge ${mapping ? (mapping.enabled ? 'badge-green' : 'badge-red') : 'badge-gray'}`}>
                        {mapping ? (mapping.enabled ? 'QR activo' : 'QR desactivado') : 'Sin QR'}
                      </span>
                    </div>
                    <p className="hint">
                      {table.floorplanName ? `${table.floorplanName} · ` : ''}
                      {typeof table.seats === 'number' ? `${table.seats} plazas` : 'Mesa sin plazas informadas'}
                    </p>
                    <div className="qr-table-meta">
                      <span className="mono-id">Last ID: {table.id}</span>
                      {mapping && <span className="mono-id">Token: {maskQrToken(mapping.qrToken)}</span>}
                    </div>
                    {mapping && (
                      <>
                        <p className="hint">Snapshot: {mapping.tableNameSnapshot || table.name}</p>
                        <p className="hint">
                          Path QR: <code>{buildQrPath(mapping.qrToken)}</code>
                        </p>
                      </>
                    )}
                  </div>

                  <div className="qr-table-actions">
                    {!mapping && (
                      <button className="btn btn-primary" onClick={() => void handleCreate(table)} disabled={createBusy}>
                        {createBusy ? 'Creando...' : 'Generar QR'}
                      </button>
                    )}

                    {mapping && (
                      <>
                        <button className="btn btn-secondary" onClick={() => void handleCopyQr(mapping)}>
                          Copiar URL QR
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => void handleDownloadQr(mapping)}
                          disabled={!mapping.enabled}
                        >
                          Descargar QR
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => void handleRegenerate(mapping)}
                          disabled={regenerateBusy}
                        >
                          {regenerateBusy ? 'Regenerando...' : 'Regenerar token'}
                        </button>
                        {mapping.enabled ? (
                          <button
                            className="btn btn-danger"
                            onClick={() => void handleToggle(mapping, false)}
                            disabled={disableBusy}
                          >
                            {disableBusy ? 'Desactivando...' : 'Desactivar'}
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            onClick={() => void handleToggle(mapping, true)}
                            disabled={enableBusy}
                          >
                            {enableBusy ? 'Activando...' : 'Activar'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
