import React, { useState } from 'react';
import type { LocalConfig, SetupOption, SetupOptions, SetupSelectionPayload } from '../api';
import { getSetupOptions, runAutoSetup, saveSetupSelection } from '../api';

interface Props {
  config: LocalConfig;
  onConfigChange: (c: LocalConfig) => void;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="status-row">
      <span className="status-row-label">{label}</span>
      <span className={`pill ${ok ? 'pill-green' : 'pill-red'}`}>{ok ? 'Configurado' : 'No configurado'}</span>
    </div>
  );
}

function IdRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-row">
      <span className="status-row-label">{label}</span>
      {value ? <span className="mono-id">{value}</span> : <span className="pill pill-gray">—</span>}
    </div>
  );
}

function SelectList({
  label,
  items,
  selectedId,
  onSelect,
  disabled,
}: {
  label: string;
  items: SetupOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="setup-select-group">
      <span className="setup-select-label">{label}</span>
      <select
        className="setup-select"
        value={selectedId}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">— Seleccionar —</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name || item.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function SetupTab({ config, onConfigChange }: Props) {
  const [options, setOptions] = useState<SetupOptions | null>(null);
  const [selection, setSelection] = useState<SetupSelectionPayload>({
    organizationId: config.lastApp.organizationId,
    locationId: config.lastApp.locationId,
    brandId: config.lastApp.brandId,
    catalogId: config.lastApp.catalogId,
  });
  const [loading, setLoading] = useState<'options' | 'save' | 'auto' | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function loadOptions() {
    setLoading('options');
    setError('');
    setSaved('');
    try {
      const data = await getSetupOptions();
      setOptions(data);
      // Prefill selection from returned selected values
      setSelection({
        organizationId: data.selected.organizationId || config.lastApp.organizationId,
        locationId: data.selected.locationId || config.lastApp.locationId,
        brandId: data.selected.brandId || config.lastApp.brandId,
        catalogId: data.selected.catalogId || config.lastApp.catalogId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar opciones');
    } finally {
      setLoading(null);
    }
  }

  async function handleSaveSelection() {
    setLoading('save');
    setError('');
    setSaved('');
    try {
      const updated = await saveSetupSelection(selection);
      onConfigChange(updated);
      setSaved('Selección guardada correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar selección');
    } finally {
      setLoading(null);
    }
  }

  async function handleAutoSetup() {
    if (!selection.organizationId || !selection.locationId) {
      setError('Selecciona organización y location antes de auto configurar.');
      return;
    }
    setLoading('auto');
    setError('');
    setSaved('');
    try {
      const updated = await runAutoSetup(selection.organizationId, selection.locationId);
      onConfigChange(updated);
      setSaved('Auto configuración completada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en auto configuración');
    } finally {
      setLoading(null);
    }
  }

  const tokenOk = config.lastApp.tokenConfigured;
  const setupOk = config.setupCompleted;

  // Filter locations by selected org (backend may not do this, so we pass all)
  const locations = options?.locations ?? [];
  const brands = options?.brands ?? [];

  return (
    <div className="tab-content">
      <div className="section-title">Estado del sistema</div>

      <div className="card">
        <div className="status-list">
          <div className="status-row">
            <span className="status-row-label">Token Last.app</span>
            {tokenOk ? (
              <span className="pill pill-green">Configurado {config.lastApp.tokenMasked}</span>
            ) : (
              <span className="pill pill-red">No configurado</span>
            )}
          </div>
          <IdRow label="Organization" value={config.lastApp.organizationId} />
          <IdRow label="Location"     value={config.lastApp.locationId} />
          <IdRow label="Brand"        value={config.lastApp.brandId} />
          <IdRow label="Catalog"      value={config.lastApp.catalogId} />
          <StatusPill ok={setupOk} label="Setup completado" />
        </div>

        {!tokenOk && (
          <div className="infobox infobox-warn">
            <strong>Token no configurado.</strong> Añade la variable de entorno{' '}
            <code>LAST_TOKEN</code> en <code>apps/local-server/.env</code> y reinicia el backend.
          </div>
        )}
      </div>

      <div className="section-title">Selección de organización y local</div>

      <div className="card">
        <button
          className="btn btn-secondary"
          onClick={loadOptions}
          disabled={loading === 'options'}
        >
          {loading === 'options' ? 'Cargando…' : 'Cargar opciones de Last'}
        </button>

        {options && (
          <>
            {options.organizations.length === 0 && tokenOk && (
              <p className="hint">No se encontraron organizaciones.</p>
            )}

            <SelectList
              label="Organización"
              items={options.organizations}
              selectedId={selection.organizationId ?? ''}
              onSelect={(id) => setSelection((p) => ({ ...p, organizationId: id }))}
              disabled={loading !== null}
            />

            <SelectList
              label="Location"
              items={locations}
              selectedId={selection.locationId ?? ''}
              onSelect={(id) => setSelection((p) => ({ ...p, locationId: id }))}
              disabled={loading !== null}
            />

            <SelectList
              label="Brand"
              items={brands}
              selectedId={selection.brandId ?? ''}
              onSelect={(id) => setSelection((p) => ({ ...p, brandId: id }))}
              disabled={loading !== null}
            />

            {(selection.catalogId) && (
              <div className="setup-select-group">
                <span className="setup-select-label">Catalog ID</span>
                <span className="mono-id">{selection.catalogId}</span>
              </div>
            )}

            <div className="btn-row">
              <button
                className="btn btn-primary"
                onClick={handleSaveSelection}
                disabled={loading !== null}
              >
                {loading === 'save' ? 'Guardando…' : 'Guardar selección'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleAutoSetup}
                disabled={loading !== null || !selection.organizationId || !selection.locationId}
              >
                {loading === 'auto' ? 'Configurando…' : 'Auto configurar'}
              </button>
            </div>
          </>
        )}

        {error && <p className="msg msg-error">{error}</p>}
        {saved && <p className="msg msg-success">{saved}</p>}
      </div>
    </div>
  );
}
