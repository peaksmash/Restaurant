import React, { useEffect, useState } from 'react';
import type { LocalConfig } from '../api';
import { saveConfig } from '../api';

interface Props {
  config: LocalConfig;
  onConfigChange: (config: LocalConfig) => void;
}

function buildPrintHtml(restaurantName: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Prueba de impresión</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
      .ticket { width: 320px; margin: 0 auto; border: 2px dashed #d1d5db; padding: 20px; }
      h1 { font-size: 28px; margin: 0 0 12px; }
      h2 { font-size: 18px; margin: 20px 0 8px; }
      p { margin: 4px 0; }
      .muted { color: #6b7280; font-size: 14px; }
      .line { display: flex; justify-content: space-between; gap: 16px; }
      .total { font-size: 18px; font-weight: 700; border-top: 1px solid #d1d5db; padding-top: 10px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <div class="ticket">
      <h1>${restaurantName || 'Restaurante'}</h1>
      <p class="muted">Prueba de impresión</p>
      <h2>Comanda de ejemplo</h2>
      <div class="line"><span>1x Hamburguesa</span><span>8,50 €</span></div>
      <div class="line"><span>1x Patatas</span><span>3,20 €</span></div>
      <div class="line"><span>1x Refresco</span><span>2,40 €</span></div>
      <p class="muted">Sin cebolla. Mesa 4.</p>
      <div class="line total"><span>Total</span><span>14,10 €</span></div>
    </div>
    <script>window.print();</script>
  </body>
</html>`;
}

function modeLabel(mode: 'disabled' | 'browser' | 'escpos') {
  if (mode === 'browser') return 'Navegador';
  if (mode === 'escpos') return 'ESC/POS';
  return 'Desactivada';
}

function modeTone(mode: 'disabled' | 'browser' | 'escpos') {
  if (mode === 'escpos') return 'badge-green';
  if (mode === 'browser') return 'badge-blue';
  return 'badge-gray';
}

export function AdminPrintingTab({ config, onConfigChange }: Props) {
  const currentMode = config.printer?.mode ?? 'disabled';
  const currentEscpos = config.printer?.escpos ?? { host: '', port: 9100, configured: false };

  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [escposHost, setEscposHost] = useState(currentEscpos.host);
  const [escposPort, setEscposPort] = useState(String(currentEscpos.port || 9100));

  useEffect(() => {
    setEscposHost(config.printer?.escpos?.host ?? '');
    setEscposPort(String(config.printer?.escpos?.port || 9100));
  }, [config]);

  async function runAction(key: string, action: () => Promise<void>) {
    setSaving(key);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving('');
    }
  }

  async function setMode(mode: 'disabled' | 'browser' | 'escpos') {
    await runAction(`mode:${mode}`, async () => {
      const updated = await saveConfig({ printer: { mode } });
      onConfigChange(updated);
      setMessage(`Modo de impresión: ${modeLabel(mode)}.`);
    });
  }

  async function saveEscposConfig() {
    const portNum = parseInt(escposPort, 10);
    if (!escposHost.trim()) {
      setError('El host no puede estar vacío.');
      return;
    }
    if (!portNum || portNum <= 0 || portNum > 65535) {
      setError('Puerto inválido. Usa un valor entre 1 y 65535.');
      return;
    }
    await runAction('escpos:save', async () => {
      const updated = await saveConfig({
        printer: {
          mode: 'escpos',
          escpos: { host: escposHost.trim(), port: portNum }
        }
      });
      onConfigChange(updated);
      setMessage('Configuración ESC/POS guardada. Modo cambiado a ESC/POS.');
    });
  }

  function handlePrintTest() {
    const popup = window.open('', '_blank', 'width=420,height=720');
    if (!popup) {
      setError('No se pudo abrir la ventana de impresión.');
      return;
    }
    popup.document.write(buildPrintHtml(config.restaurantName));
    popup.document.close();
    setMessage('Se ha abierto una prueba de impresión en el navegador.');
  }

  return (
    <div className="tab-content">
      <div className="page-hero">
        <div>
          <h1>Impresión</h1>
          <p>Gestiona el modo de impresión de comandas del sistema.</p>
        </div>
        <span className={`badge ${modeTone(currentMode)}`}>{modeLabel(currentMode)}</span>
      </div>

      {message ? <div className="infobox infobox-info" style={{ marginBottom: 16 }}>{message}</div> : null}
      {error ? <div className="infobox infobox-warn" style={{ marginBottom: 16 }}>{error}</div> : null}

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Modo de impresión</h2>
            <p className="hint">Selecciona cómo se imprimen las comandas.</p>
          </div>
        </div>
        <div className="btn-row">
          <button
            className={`btn ${currentMode === 'disabled' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={saving !== ''}
            onClick={() => void setMode('disabled')}
          >
            {saving === 'mode:disabled' ? 'Guardando...' : 'Desactivada'}
          </button>
          <button
            className={`btn ${currentMode === 'browser' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={saving !== ''}
            onClick={() => void setMode('browser')}
          >
            {saving === 'mode:browser' ? 'Guardando...' : 'Navegador'}
          </button>
          <button
            className={`btn ${currentMode === 'escpos' ? 'btn-primary' : 'btn-secondary'}`}
            disabled={saving !== ''}
            onClick={() => void setMode('escpos')}
          >
            {saving === 'mode:escpos' ? 'Guardando...' : 'ESC/POS (impresora física)'}
          </button>
        </div>
      </section>

      <section className="card">
        <details className="config-panel" open={currentMode === 'escpos' || !currentEscpos.configured}>
          <summary>Configuración ESC/POS</summary>
          <div className="config-form">
            <div className="setup-field">
              <label className="setup-label" htmlFor="escpos-host">IP / Host de la impresora</label>
              <input
                id="escpos-host"
                className="setup-input"
                type="text"
                placeholder="192.168.1.100"
                value={escposHost}
                onChange={(e) => setEscposHost(e.target.value)}
              />
            </div>
            <div className="setup-field">
              <label className="setup-label" htmlFor="escpos-port">Puerto</label>
              <input
                id="escpos-port"
                className="setup-input"
                type="number"
                placeholder="9100"
                value={escposPort}
                onChange={(e) => setEscposPort(e.target.value)}
              />
            </div>
            <div className="btn-row">
              <button
                className="btn btn-primary"
                disabled={saving !== ''}
                onClick={() => void saveEscposConfig()}
              >
                {saving === 'escpos:save' ? 'Guardando...' : 'Guardar y activar ESC/POS'}
              </button>
            </div>
            {currentEscpos.configured ? (
              <div className="infobox infobox-info">
                Impresora configurada en {currentEscpos.host}:{currentEscpos.port}.
                El modo cambia automáticamente a ESC/POS al guardar.
              </div>
            ) : (
              <div className="infobox infobox-warn">
                Sin impresora configurada. Introduce la IP y puerto del dispositivo ESC/POS en tu red local.
              </div>
            )}
          </div>
        </details>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Prueba de impresión</h2>
            <p className="hint">Abre una comanda de ejemplo en el navegador.</p>
          </div>
        </div>
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handlePrintTest}>
            Imprimir prueba (navegador)
          </button>
        </div>
        {currentMode === 'escpos' && currentEscpos.configured ? (
          <div className="infobox infobox-info">
            Modo ESC/POS activo. Las comandas reales se envían por TCP a {currentEscpos.host}:{currentEscpos.port}.
          </div>
        ) : currentMode === 'escpos' && !currentEscpos.configured ? (
          <div className="infobox infobox-warn">
            Modo ESC/POS activo pero la impresora no está configurada. Añade host y puerto arriba.
          </div>
        ) : null}
      </section>
    </div>
  );
}
