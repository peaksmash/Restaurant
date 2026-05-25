import React, { useState } from 'react';
import type { Location, LocalConfig, Organization } from '../api';
import { getLocations, getOrganizations, setupAuto } from '../api';

interface Props {
  onSetupComplete: (config: LocalConfig) => void;
}

export function SetupWizard({ onSetupComplete }: Props) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState<'orgs' | 'locations' | 'setup' | null>(null);
  const [error, setError] = useState('');

  async function loadOrgs() {
    setLoading('orgs');
    setError('');
    setOrgs([]);
    setSelectedOrg(null);
    setLocations([]);
    setSelectedLocation(null);
    try {
      const data = await getOrganizations();
      setOrgs(data);
      if (data.length === 0) setError('No se encontraron organizaciones para este token.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar organizaciones');
    } finally {
      setLoading(null);
    }
  }

  async function selectOrg(org: Organization) {
    setSelectedOrg(org);
    setLocations([]);
    setSelectedLocation(null);
    setLoading('locations');
    setError('');
    try {
      const data = await getLocations(org.id);
      setLocations(data);
      if (data.length === 0) setError('No se encontraron locations para esta organización.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar locations');
    } finally {
      setLoading(null);
    }
  }

  async function runSetup() {
    if (!selectedOrg || !selectedLocation) return;
    setLoading('setup');
    setError('');
    try {
      const config = await setupAuto(selectedOrg.id, selectedLocation.id);
      onSetupComplete(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al configurar el local');
    } finally {
      setLoading(null);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Configurar local</h2>
      </div>

      {/* Step 1 — Load organizations */}
      <div className="wizard-step">
        <span className="step-label">1. Cargar organizaciones</span>
        <button
          className="btn btn-secondary"
          onClick={loadOrgs}
          disabled={loading === 'orgs'}
        >
          {loading === 'orgs' ? 'Cargando…' : 'Cargar organizaciones'}
        </button>
      </div>

      {orgs.length > 0 && (
        <div className="wizard-step">
          <span className="step-label">2. Selecciona una organización</span>
          <div className="list">
            {orgs.map((org) => (
              <button
                key={org.id}
                className={`list-item${selectedOrg?.id === org.id ? ' selected' : ''}`}
                onClick={() => selectOrg(org)}
                disabled={loading === 'locations'}
              >
                <span className="list-item-name">{org.name ?? org.id}</span>
                <span className="list-item-id">{org.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loading === 'locations' && (
        <p className="hint loading-inline">Cargando locations…</p>
      )}

      {locations.length > 0 && (
        <div className="wizard-step">
          <span className="step-label">3. Selecciona un local</span>
          <div className="list">
            {locations.map((loc) => (
              <button
                key={loc.id}
                className={`list-item${selectedLocation?.id === loc.id ? ' selected' : ''}`}
                onClick={() => setSelectedLocation(loc)}
              >
                <span className="list-item-name">{loc.name ?? loc.id}</span>
                <span className="list-item-id">{loc.id}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className="wizard-step wizard-action">
          <div className="selected-summary">
            Local seleccionado: <strong>{selectedLocation.name ?? selectedLocation.id}</strong>
          </div>
          <button
            className="btn btn-primary"
            onClick={runSetup}
            disabled={loading === 'setup'}
          >
            {loading === 'setup' ? 'Configurando…' : 'Configurar este local'}
          </button>
        </div>
      )}

      {error && <p className="msg msg-error">{error}</p>}
    </section>
  );
}
