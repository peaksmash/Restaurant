import React, { useState } from 'react';
import type { LocalConfig } from '../api';
import { saveConfig } from '../api';

interface Props {
  config: LocalConfig;
  onConfigChange: (config: LocalConfig) => void;
}

export function BrandTab({ config, onConfigChange }: Props) {
  const [logoUrl, setLogoUrl] = useState(config.logoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await saveConfig({ logoUrl });
      onConfigChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = logoUrl.trim();

  return (
    <div className="tab-content">
      <h2 className="tab-title">Marca</h2>
      <p className="tab-subtitle">Personaliza la identidad visual del kiosko.</p>

      <div className="card" style={{ maxWidth: 560 }}>
        <h3 className="card-section-title">Logo del restaurante</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          Introduce la URL de tu logo (PNG, JPG o SVG). Se mostrará en la pantalla de bienvenida del kiosko.
        </p>

        {/* Preview */}
        <div style={{
          width: 140,
          height: 140,
          borderRadius: 16,
          overflow: 'hidden',
          border: '2px solid var(--border)',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          {previewUrl && !imgError ? (
            <img
              src={previewUrl}
              alt="Logo preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <span style={{ fontSize: 48, fontWeight: 900, color: '#d1d5db' }}>
              {(config.restaurantName?.trim()[0] ?? 'R').toUpperCase()}
            </span>
          )}
        </div>

        <div className="field-row" style={{ flexDirection: 'column', gap: 8 }}>
          <label className="field-label">URL del logo</label>
          <input
            className="field-input"
            type="url"
            placeholder="https://ejemplo.com/logo.png"
            value={logoUrl}
            onChange={(e) => { setLogoUrl(e.target.value); setImgError(false); }}
          />
        </div>

        {error && <p className="msg msg-error" style={{ marginTop: 12 }}>{error}</p>}
        {saved && <p className="msg msg-success" style={{ marginTop: 12 }}>Logo guardado correctamente.</p>}

        <div style={{ marginTop: 20 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar logo'}
          </button>
        </div>
      </div>
    </div>
  );
}
