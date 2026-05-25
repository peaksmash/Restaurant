import React, { useEffect, useMemo, useState } from 'react';
import type { AdminPaymentDevice, AdminPaymentJob, LocalConfig } from '../api';
import { createPaymentDevice, saveConfig, updatePaymentDevice } from '../api';
import { getDevicePresentation, getLocationGroups } from '../lib/adminDashboard';

interface Props {
  config: LocalConfig;
  paymentDevices: AdminPaymentDevice[];
  paymentJobs: AdminPaymentJob[];
  onConfigChange: (config: LocalConfig) => void;
  onRefresh: () => Promise<void>;
}

function badgeClass(tone: 'green' | 'amber' | 'gray' | 'red') {
  if (tone === 'green') return 'badge-green';
  if (tone === 'amber') return 'badge-blue';
  if (tone === 'red') return 'badge-red';
  return 'badge-gray';
}

function describeJobStatus(status: string) {
  if (status === 'queued') return 'Esperando turno de cobro';
  if (status === 'running') return 'Procesando cobro';
  if (status === 'completed') return 'Cobro completado';
  if (status === 'failed') return 'Error de cobro';
  if (status === 'cancelled') return 'Cobro cancelado';
  return status;
}

export function AdminPaymentsTab({
  config,
  paymentDevices,
  paymentJobs,
  onConfigChange,
  onRefresh,
}: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState(config.lastApp.locationId);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [queueOpen, setQueueOpen] = useState<Record<string, boolean>>({});

  // Artemis form state
  const [artemisBaseUrl, setArtemisBaseUrl] = useState('');
  const [artemisOwner, setArtemisOwner] = useState('com.local.kiosk');
  const [artemisKeyEnvName, setArtemisKeyEnvName] = useState('');
  const [artemisAllowInsecureTls, setArtemisAllowInsecureTls] = useState(false);

  // CashDro form state
  const [cashdroBaseUrl, setCashdroBaseUrl] = useState('');
  const [cashdroUsername, setCashdroUsername] = useState('');
  const [cashdroPassword, setCashdroPassword] = useState('');
  const [cashdroPosId, setCashdroPosId] = useState('');
  const [cashdroPosUser, setCashdroPosUser] = useState('');
  const [cashdroAllowInsecureTls, setCashdroAllowInsecureTls] = useState(true);

  const locationGroups = useMemo(
    () => getLocationGroups(config, paymentDevices, paymentJobs),
    [config, paymentDevices, paymentJobs]
  );

  useEffect(() => {
    if (!locationGroups.some((group) => group.id === selectedLocationId)) {
      setSelectedLocationId(locationGroups[0]?.id ?? config.lastApp.locationId);
    }
  }, [config.lastApp.locationId, locationGroups, selectedLocationId]);

  const selectedGroup =
    locationGroups.find((group) => group.id === selectedLocationId) ?? locationGroups[0] ?? null;
  const cardDevice = getDevicePresentation(
    'artemis',
    selectedGroup?.devices ?? [],
    selectedGroup?.jobs ?? []
  );
  const cashDevice = getDevicePresentation(
    'cashdro',
    selectedGroup?.devices ?? [],
    selectedGroup?.jobs ?? []
  );

  // Init Artemis fields from existing device configJson
  useEffect(() => {
    const device = cardDevice.device;
    const cfg = device?.configJson ? JSON.parse(device.configJson as string) : {};
    setArtemisBaseUrl(cfg.baseUrl ?? '');
    setArtemisOwner(cfg.owner ?? 'com.local.kiosk');
    setArtemisKeyEnvName(cfg.keyEnvName ?? '');
    setArtemisAllowInsecureTls(cfg.allowInsecureTls ?? false);
  }, [selectedGroup, paymentDevices]); // eslint-disable-line react-hooks/exhaustive-deps

  // Init CashDro fields from config
  useEffect(() => {
    const cashdro = config.kiosk.payment.cashdro;
    setCashdroBaseUrl(cashdro.baseUrl ?? '');
    setCashdroUsername(cashdro.username ?? '');
    setCashdroPassword('');
    setCashdroPosId(cashdro.posId ?? '');
    setCashdroPosUser(cashdro.posUser ?? '');
    setCashdroAllowInsecureTls(cashdro.allowInsecureTls ?? true);
  }, [config]);

  async function runAction(key: string, action: () => Promise<void>) {
    setSaving(key);
    setError('');
    setMessage('');
    try {
      await action();
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving('');
    }
  }

  async function toggleDemoMode(enabled: boolean) {
    await runAction(`demo:${enabled}`, async () => {
      const updated = await saveConfig({ paymentsSimulated: enabled });
      onConfigChange(updated);
      setMessage(enabled ? 'Modo demo activado.' : 'Modo demo desactivado.');
    });
  }

  async function createDemoDevice(provider: 'artemis' | 'cashdro') {
    if (!selectedGroup) return;
    await runAction(`create:${provider}`, async () => {
      await createPaymentDevice({
        locationId: selectedGroup.id,
        provider,
        displayName: provider === 'artemis' ? 'Tarjeta principal' : 'Efectivo principal',
        mode: 'demo',
        configured: true,
        isActive: true,
      });
      setMessage('Dispositivo de prueba creado.');
    });
  }

  async function activateDemo(device: AdminPaymentDevice) {
    await runAction(`demo-device:${device.id}`, async () => {
      await updatePaymentDevice(device.id, {
        mode: 'demo',
        configured: true,
        isActive: true,
      });
      setMessage('Modo demo activado para este dispositivo.');
    });
  }

  async function toggleDevice(device: AdminPaymentDevice, isActive: boolean) {
    await runAction(`toggle:${device.id}:${isActive}`, async () => {
      await updatePaymentDevice(device.id, { isActive });
      setMessage(isActive ? 'Dispositivo activado.' : 'Dispositivo desactivado.');
    });
  }

  function renderDeviceCard(summary: ReturnType<typeof getDevicePresentation>) {
    const device = summary.device;
    const isBusy = Boolean(device && saving.includes(device.id));
    const queueJobs = (selectedGroup?.jobs ?? [])
      .filter((job) => (device ? job.deviceId === device.id : false))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    const isArtemis = summary.provider === 'artemis';
    const isCashdro = summary.provider === 'cashdro';

    return (
      <section className="card payment-card" key={summary.provider}>
        <div className="card-header">
          <div>
            <h2>{summary.title}</h2>
            <p className="hint">{summary.subtitle}</p>
          </div>
          <span className={`badge ${badgeClass(summary.setupTone)}`}>{summary.setupStatus}</span>
        </div>

        <div className="status-list">
          <div className="status-row">
            <span className="status-row-label">Estado del dispositivo</span>
            <span className={`badge ${badgeClass(summary.availabilityTone)}`}>{summary.availabilityLabel}</span>
          </div>
          <div className="status-row">
            <span className="status-row-label">Cola</span>
            <span className="badge badge-gray">{summary.queueLabel}</span>
          </div>
        </div>

        {summary.latestFailure ? (
          <div className="infobox infobox-warn">Última incidencia: {summary.latestFailure}</div>
        ) : null}

        <div className="btn-row">
          {!device ? (
            <button
              className="btn btn-primary"
              onClick={() => void createDemoDevice(summary.provider)}
              disabled={Boolean(saving)}
            >
              Crear dispositivo de prueba
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => void activateDemo(device)}
                disabled={Boolean(saving) || isBusy}
              >
                Activar demo
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => void toggleDevice(device, !device.isActive)}
                disabled={Boolean(saving) || isBusy}
              >
                {device.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </>
          )}
          <button
            className="btn btn-secondary"
            onClick={() =>
              setQueueOpen((current) => ({ ...current, [summary.provider]: !current[summary.provider] }))
            }
          >
            Ver cola
          </button>
        </div>

        {/* Artemis real config */}
        {isArtemis && !device ? (
          <details className="config-panel">
            <summary>Conectar datáfono real</summary>
            <div className="config-form">
              <div className="setup-field">
                <label className="setup-label">URL del datáfono</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="http://192.168.1.100:2091"
                  value={artemisBaseUrl}
                  onChange={(e) => setArtemisBaseUrl(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Owner</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="com.local.kiosk"
                  value={artemisOwner}
                  onChange={(e) => setArtemisOwner(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Variable ENV con API key</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="ARTEMIS_TEST_API_KEY"
                  value={artemisKeyEnvName}
                  onChange={(e) => setArtemisKeyEnvName(e.target.value)}
                />
                <p className="hint">Escribe el nombre de la variable de entorno del servidor, no el valor de la clave.</p>
              </div>
              <div className="setup-field">
                <label className="setup-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={artemisAllowInsecureTls}
                    onChange={(e) => setArtemisAllowInsecureTls(e.target.checked)}
                  />
                  Permitir TLS no seguro (red local)
                </label>
                <p className="hint">Actívalo si el datáfono usa IP local en lugar de dominio (evita error de certificado)</p>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={Boolean(saving)}
                  onClick={() => {
                    if (!artemisBaseUrl.trim()) {
                      setError('La URL del datáfono es obligatoria.');
                      return;
                    }
                    if (!selectedGroup) return;
                    void runAction('artemis:create-real', async () => {
                      await createPaymentDevice({
                        locationId: selectedGroup.id,
                        provider: 'artemis',
                        displayName: 'Tarjeta principal',
                        mode: 'real',
                        configured: true,
                        isActive: true,
                        configJson: {
                          baseUrl: artemisBaseUrl.trim(),
                          owner: artemisOwner.trim(),
                          keyEnvName: artemisKeyEnvName.trim(),
                          allowInsecureTls: artemisAllowInsecureTls,
                        },
                      });
                      setMessage('Datáfono real creado y conectado.');
                    });
                  }}
                >
                  Crear y conectar
                </button>
              </div>
            </div>
          </details>
        ) : null}

        {isArtemis && device ? (
          <details className="config-panel">
            <summary>Configurar datáfono real</summary>
            <div className="config-form">
              <div className="setup-field">
                <label className="setup-label">URL del datáfono</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="http://192.168.1.100:2091"
                  value={artemisBaseUrl}
                  onChange={(e) => setArtemisBaseUrl(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Owner</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="com.local.kiosk"
                  value={artemisOwner}
                  onChange={(e) => setArtemisOwner(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Variable ENV con API key</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="ARTEMIS_TEST_API_KEY"
                  value={artemisKeyEnvName}
                  onChange={(e) => setArtemisKeyEnvName(e.target.value)}
                />
                <p className="hint">Escribe el nombre de la variable de entorno del servidor, no el valor de la clave.</p>
              </div>
              <div className="setup-field">
                <label className="setup-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={artemisAllowInsecureTls}
                    onChange={(e) => setArtemisAllowInsecureTls(e.target.checked)}
                  />
                  Permitir TLS no seguro (red local)
                </label>
                <p className="hint">Actívalo si el datáfono usa IP local en lugar de dominio (evita error de certificado)</p>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={Boolean(saving) || isBusy}
                  onClick={() => {
                    if (!artemisBaseUrl.trim()) {
                      setError('La URL del datáfono es obligatoria.');
                      return;
                    }
                    void runAction('artemis:save-real', async () => {
                      await updatePaymentDevice(device.id, {
                        mode: 'real',
                        configured: true,
                        configJson: {
                          baseUrl: artemisBaseUrl.trim(),
                          owner: artemisOwner.trim(),
                          keyEnvName: artemisKeyEnvName.trim(),
                          allowInsecureTls: artemisAllowInsecureTls,
                        },
                      });
                      setMessage('Configuración del datáfono guardada.');
                    });
                  }}
                >
                  Guardar configuración
                </button>
              </div>
            </div>
          </details>
        ) : null}

        {/* CashDro real config */}
        {isCashdro && !device ? (
          <details className="config-panel">
            <summary>Conectar CashDro real</summary>
            <div className="config-form">
              <div className="setup-field">
                <label className="setup-label">URL del servidor CashDro</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="http://192.168.1.50:8080"
                  value={cashdroBaseUrl}
                  onChange={(e) => setCashdroBaseUrl(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Usuario</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="admin"
                  value={cashdroUsername}
                  onChange={(e) => setCashdroUsername(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Contraseña</label>
                <input
                  className="setup-input"
                  type="password"
                  value={cashdroPassword}
                  onChange={(e) => setCashdroPassword(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">POS ID</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="1"
                  value={cashdroPosId}
                  onChange={(e) => setCashdroPosId(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">POS User</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="user"
                  value={cashdroPosUser}
                  onChange={(e) => setCashdroPosUser(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">
                  <input
                    type="checkbox"
                    checked={cashdroAllowInsecureTls}
                    onChange={(e) => setCashdroAllowInsecureTls(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  Permitir TLS no seguro (red local)
                </label>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={Boolean(saving)}
                  onClick={() => {
                    if (!cashdroBaseUrl.trim() || !cashdroUsername.trim()) {
                      setError('La URL y el usuario son obligatorios.');
                      return;
                    }
                    if (!selectedGroup) return;
                    void runAction('cashdro:create-real', async () => {
                      const updated = await saveConfig({
                        kiosk: {
                          payment: {
                            cashdro: {
                              baseUrl: cashdroBaseUrl.trim(),
                              username: cashdroUsername.trim(),
                              password: cashdroPassword,
                              posId: cashdroPosId.trim(),
                              posUser: cashdroPosUser.trim(),
                              allowInsecureTls: cashdroAllowInsecureTls,
                            },
                          },
                        },
                      });
                      onConfigChange(updated);
                      await createPaymentDevice({
                        locationId: selectedGroup.id,
                        provider: 'cashdro',
                        displayName: 'Efectivo principal',
                        mode: 'real',
                        configured: true,
                        isActive: true,
                      });
                      setMessage('CashDro real creado y conectado.');
                    });
                  }}
                >
                  Crear y conectar
                </button>
              </div>
            </div>
          </details>
        ) : null}

        {isCashdro && device ? (
          <details className="config-panel">
            <summary>Configurar CashDro</summary>
            <div className="config-form">
              <div className="setup-field">
                <label className="setup-label">URL del servidor CashDro</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="http://192.168.1.50:8080"
                  value={cashdroBaseUrl}
                  onChange={(e) => setCashdroBaseUrl(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Usuario</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="admin"
                  value={cashdroUsername}
                  onChange={(e) => setCashdroUsername(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">Contraseña</label>
                <input
                  className="setup-input"
                  type="password"
                  placeholder="••••••••"
                  value={cashdroPassword}
                  onChange={(e) => setCashdroPassword(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">POS ID</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="1"
                  value={cashdroPosId}
                  onChange={(e) => setCashdroPosId(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">POS User</label>
                <input
                  className="setup-input"
                  type="text"
                  placeholder="user"
                  value={cashdroPosUser}
                  onChange={(e) => setCashdroPosUser(e.target.value)}
                />
              </div>
              <div className="setup-field">
                <label className="setup-label">
                  <input
                    type="checkbox"
                    checked={cashdroAllowInsecureTls}
                    onChange={(e) => setCashdroAllowInsecureTls(e.target.checked)}
                    style={{ marginRight: 6 }}
                  />
                  Permitir TLS no seguro (red local)
                </label>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-primary"
                  disabled={Boolean(saving) || isBusy}
                  onClick={() => {
                    if (!cashdroBaseUrl.trim() || !cashdroUsername.trim()) {
                      setError('La URL y el usuario son obligatorios.');
                      return;
                    }
                    void runAction('cashdro:save', async () => {
                      const body: Record<string, unknown> = {
                        baseUrl: cashdroBaseUrl.trim(),
                        username: cashdroUsername.trim(),
                        posId: cashdroPosId.trim(),
                        posUser: cashdroPosUser.trim(),
                        allowInsecureTls: cashdroAllowInsecureTls,
                      };
                      if (cashdroPassword) {
                        body.password = cashdroPassword;
                      }
                      const updated = await saveConfig({ kiosk: { payment: { cashdro: body } } });
                      onConfigChange(updated);
                      setMessage('Configuración de CashDro guardada.');
                    });
                  }}
                >
                  Guardar configuración
                </button>
              </div>
            </div>
          </details>
        ) : null}

        {queueOpen[summary.provider] ? (
          <div className="queue-panel">
            {queueJobs.length === 0 ? (
              <p className="hint">No hay cobros recientes para este dispositivo.</p>
            ) : (
              queueJobs.map((job) => (
                <div key={job.id} className="queue-row">
                  <div>
                    <strong>{describeJobStatus(job.status)}</strong>
                    <p className="hint">Pedido {job.orderSessionId.slice(0, 8)}</p>
                  </div>
                  <span className={`badge ${job.status === 'failed' ? 'badge-red' : job.status === 'completed' ? 'badge-green' : 'badge-gray'}`}>
                    {describeJobStatus(job.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <div className="tab-content">
      <div className="page-hero">
        <div>
          <h1>Pagos</h1>
          <p>Configura cómo van a pagar los clientes.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Modo demo de pagos</h2>
            <p className="hint">Sirve para probar pedidos sin cobrar dinero real.</p>
          </div>
          <span className={`badge ${config.paymentsSimulated ? 'badge-blue' : 'badge-gray'}`}>
            {config.paymentsSimulated ? 'Activado' : 'Desactivado'}
          </span>
        </div>
        {config.paymentsDemoForced ? (
          <div className="infobox infobox-warn">
            Modo demo forzado por configuración del servidor.
          </div>
        ) : null}
        <div className="btn-row">
          <button
            className="btn btn-primary"
            onClick={() => void toggleDemoMode(true)}
            disabled={config.paymentsDemoForced || saving.startsWith('demo:') || config.paymentsSimulated}
          >
            Activar modo demo
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => void toggleDemoMode(false)}
            disabled={config.paymentsDemoForced || saving.startsWith('demo:') || !config.paymentsSimulated}
          >
            Desactivar modo demo
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Dispositivos por local</h2>
            <p className="hint">
              Los kioskos de este local comparten estos dispositivos. Si uno está cobrando, los demás esperan turno.
            </p>
          </div>
        </div>

        {locationGroups.length > 1 ? (
          <label className="setup-select-group">
            <span className="setup-select-label">Selecciona local</span>
            <select
              className="setup-select"
              value={selectedGroup?.id ?? ''}
              onChange={(event) => setSelectedLocationId(event.target.value)}
            >
              {locationGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="infobox infobox-info">{selectedGroup?.label ?? 'Local actual'}</div>
        )}
      </section>

      <div className="dashboard-grid">
        {renderDeviceCard(cardDevice)}
        {renderDeviceCard(cashDevice)}
      </div>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Disponibilidad del kiosko</h2>
            <p className="hint">Qué métodos de pago puede usar el kiosko en este momento.</p>
          </div>
        </div>
        {(() => {
          const paymentsSimulated = config.paymentsSimulated;
          const devices = selectedGroup?.devices ?? [];
          const kioskArtemisOk =
            paymentsSimulated || devices.some((d) => d.provider === 'artemis' && d.isActive);
          const kioskCashdroOk =
            paymentsSimulated || devices.some((d) => d.provider === 'cashdro' && d.isActive);
          if (!kioskArtemisOk && !kioskCashdroOk) {
            return (
              <div className="infobox infobox-warn">
                Falta configurar métodos de pago para que el kiosko pueda cobrar.
              </div>
            );
          }
          return (
            <div className="status-list">
              {paymentsSimulated ? (
                <div className="infobox infobox-info">
                  Modo demo activado: el kiosko puede probar pagos sin cobrar dinero real.
                </div>
              ) : null}
              <div className="status-row">
                <span className="status-row-label">Tarjeta (Kiosko)</span>
                <span className={`badge ${kioskArtemisOk ? 'badge-green' : 'badge-gray'}`}>
                  {kioskArtemisOk ? 'Disponible' : 'No disponible'}
                </span>
              </div>
              <div className="status-row">
                <span className="status-row-label">Efectivo (Kiosko)</span>
                <span className={`badge ${kioskCashdroOk ? 'badge-green' : 'badge-gray'}`}>
                  {kioskCashdroOk ? 'Disponible' : 'No disponible'}
                </span>
              </div>
            </div>
          );
        })()}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <h2>Efectivo manual de emergencia</h2>
            <p className="hint">Úsalo solo si el dispositivo automático falla.</p>
          </div>
          <span className="badge badge-gray">Disponible</span>
        </div>
      </section>

      {error ? <p className="msg msg-error">{error}</p> : null}
      {message ? <p className="msg msg-success">{message}</p> : null}
    </div>
  );
}
